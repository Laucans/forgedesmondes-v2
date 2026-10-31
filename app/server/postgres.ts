// The product's PostgreSQL (DATABASE_URL): its migrations, its rows, and the guard's adapters on
// its tables. Convention, as data/migrations writes them: one table per entity, named as the
// entity, one column per field, and an `version integer` column on every aggregate root.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pool, PoolClient } from "pg";
import type { DataModel } from "#architecture";
import { type AggregateAdapter, migrate as migrateGuard, Refusal, type Snapshot } from "#dataguard";
import type { Row } from "#kit/units.ts";
import { keyOf, matches, type Tables } from "./store.ts";
import { rootOf } from "./writes.ts";

const ident = (name: string) => `"${name.replaceAll('"', '""')}"`;

function column(value: unknown): unknown {
  return value !== null && typeof value === "object" && !(value instanceof Date)
    ? JSON.stringify(value)
    : value;
}

/** A row as the units read it: dates as ISO text, without the guard's version column. */
function rowOf(model: DataModel, entity: string, raw: Row): Row {
  const fields = new Set(model.entities.find((e) => e.name === entity)?.fields.map((f) => f.name));
  const out: Row = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === "version" && !fields.has("version")) continue;
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
}

/** Connects to DATABASE_URL, dates and big numbers read as text and numbers. */
export async function connect(url: string): Promise<Pool> {
  const pg = (await import("pg")).default;
  pg.types.setTypeParser(1082, (v: string) => v); // date
  pg.types.setTypeParser(20, (v: string) => Number(v)); // bigint
  pg.types.setTypeParser(1700, (v: string) => Number(v)); // numeric
  return new pg.Pool({ connectionString: url });
}

/** Applies data/migrations/*.sql in name order, once each, then the guard's own tables. */
export async function migrate(pool: Pool, root: string): Promise<string[]> {
  await pool.query(
    "create table if not exists app_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  let names: string[] = [];
  try {
    names = (await readdir(join(root, "data/migrations"))).filter((n) => n.endsWith(".sql")).sort();
  } catch {
    names = [];
  }
  const done = new Set(
    (await pool.query<{ name: string }>("select name from app_migrations")).rows.map((r) => r.name),
  );
  const applied: string[] = [];
  for (const name of names) {
    if (done.has(name)) continue;
    const sql = await readFile(join(root, "data/migrations", name), "utf8");
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into app_migrations (name) values ($1)", [name]);
      await client.query("commit");
      applied.push(name);
    } catch (e) {
      await client.query("rollback");
      throw new Error(`migration ${name}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      client.release();
    }
  }
  await migrateGuard(pool);
  return applied;
}

/** The rows in PostgreSQL. */
export class PostgresTables implements Tables {
  readonly #pool: Pool;
  readonly #model: DataModel;

  constructor(pool: Pool, model: DataModel) {
    this.#pool = pool;
    this.#model = model;
  }

  async list(entity: string, where: Row = {}): Promise<Row[]> {
    const { rows } = await this.#pool.query<Row>(`select * from ${ident(entity)}`);
    return rows.map((r) => rowOf(this.#model, entity, r)).filter((r) => matches(r, where));
  }

  async get(entity: string, id: string): Promise<Row | null> {
    const key = keyOf(this.#model, entity);
    const { rows } = await this.#pool.query<Row>(
      `select * from ${ident(entity)} where ${ident(key)}::text = $1`,
      [id],
    );
    return rows[0] ? rowOf(this.#model, entity, rows[0]) : null;
  }

  async put(entity: string, row: Row): Promise<void> {
    const key = keyOf(this.#model, entity);
    const cols = Object.keys(row);
    const values = cols.map((c) => column(row[c]));
    const updates = cols.filter((c) => c !== key).map((c) => `${ident(c)} = excluded.${ident(c)}`);
    await this.#pool.query(
      `insert into ${ident(entity)} (${cols.map(ident).join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})` +
        ` on conflict (${ident(key)}) do ${updates.length > 0 ? `update set ${updates.join(", ")}` : "nothing"}`,
      values,
    );
  }

  async delete(entity: string, id: string): Promise<void> {
    const key = keyOf(this.#model, entity);
    await this.#pool.query(`delete from ${ident(entity)} where ${ident(key)}::text = $1`, [id]);
  }
}

function refusing(e: unknown): never {
  const code = (e as { code?: unknown }).code;
  // A unique key or a reference the write breaks: a refusal, not a failure.
  if (code === "23505" || code === "23503" || code === "23502" || code === "23514")
    throw new Refusal(e instanceof Error ? e.message : String(e));
  throw e;
}

/** The guard's adapter for an aggregate: its root entity's table, versioned. */
export function tableAdapter(model: DataModel, aggregate: string): AggregateAdapter {
  const table = rootOf(model, aggregate);
  const key = keyOf(model, table);
  return {
    async load(client: PoolClient, id: string): Promise<Snapshot> {
      const { rows } = await client.query<Row>(
        `select * from ${ident(table)} where ${ident(key)}::text = $1`,
        [id],
      );
      const row = rows[0];
      if (!row) return { version: 0, state: null };
      return { version: Number(row.version ?? 1), state: rowOf(model, table, row) };
    },
    async apply(client, id, change, expectedVersion): Promise<number> {
      const version = expectedVersion + 1;
      try {
        if (change.next === null) {
          await client.query(
            `delete from ${ident(table)} where ${ident(key)}::text = $1 and version = $2`,
            [id, expectedVersion],
          );
          return version;
        }
        if (expectedVersion === 0) {
          const row: Row = { ...change.next, [key]: id, version };
          const cols = Object.keys(row);
          await client.query(
            `insert into ${ident(table)} (${cols.map(ident).join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})`,
            cols.map((c) => column(row[c])),
          );
          return version;
        }
        const cols = Object.keys(change.set).filter((c) => c !== key);
        const sets = [...cols.map((c, i) => `${ident(c)} = $${i + 3}`), `version = ${version}`];
        const result = await client.query(
          `update ${ident(table)} set ${sets.join(", ")} where ${ident(key)}::text = $1 and version = $2`,
          [id, expectedVersion, ...cols.map((c) => column(change.set[c]))],
        );
        if (result.rowCount !== 1) throw new Error(`${aggregate}/${id} moved under the guard`);
        return version;
      } catch (e) {
        return refusing(e);
      }
    },
  };
}
