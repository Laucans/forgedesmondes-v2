// Starts the product: `npm start` (PORT, HOST; DATABASE_URL for PostgreSQL, else memory loaded
// from mock/fixtures; APP_TEST=1 opens the rules' endpoints). Owned by the harness.
import { resolve } from "node:path";
import { connect, migrate, PostgresTables, tableAdapter } from "./postgres.ts";
import { importServerCode, readProductFiles } from "./product.ts";
import { createApp, permits } from "./server.ts";
import { MemoryTables } from "./store.ts";
import { commandsOf, Writes } from "./writes.ts";

const root = resolve(import.meta.dirname, "../..");
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
const databaseUrl = process.env.DATABASE_URL;

const product = await readProductFiles(root);
const code = await importServerCode(product);
const { commands, writes, problems } = commandsOf(code.units, code.aggregates);
product.problems.push(...problems);
const mayTrigger = permits(product);

let app: ReturnType<typeof createApp>;
if (databaseUrl) {
  const pool = await connect(databaseUrl);
  const applied = await migrate(pool, root);
  if (applied.length > 0) console.log(`migrations applied: ${applied.join(", ")}`);
  const { PostgresStore } = await import("#dataguard");
  const adapters = Object.fromEntries(
    [...new Set(commands.map((c) => c.aggregate.name))].map((a) => [
      a,
      tableAdapter(product.model, a),
    ]),
  );
  const tables = new PostgresTables(pool, product.model);
  const side = new Writes(
    { model: product.model, tables, commands, writes, mayTrigger },
    new PostgresStore(pool, adapters),
  );
  app = createApp({
    product,
    units: code.units,
    tables,
    writes: side,
    store: "postgres",
    assets: resolve(root, "app/shell/dist"),
  });
} else {
  const tables = new MemoryTables(product.model);
  const side = new Writes({ model: product.model, tables, commands, writes, mayTrigger });
  const reset = () => {
    tables.load(product.fixtures);
    side.reseed(tables);
  };
  reset();
  app = createApp({
    product,
    units: code.units,
    tables,
    writes: side,
    store: "memory",
    ...(process.env.APP_TEST === "1" ? { test: { tables, reset } } : {}),
    assets: resolve(root, "app/shell/dist"),
  });
}

for (const problem of product.problems) console.error(`problem: ${problem}`);
app.listen(port, host, () => {
  const built = product.units.filter((u) => u.built).length;
  console.log(
    `app on http://${host}:${port} (${databaseUrl ? "postgres" : "memory"}, ${built}/${product.units.length} units built)`,
  );
});
const stop = () => {
  app.close(() => process.exit(0));
  app.closeAllConnections();
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
