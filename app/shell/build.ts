// Bundles the front end into app/shell/dist (never committed): the host, the shell and every
// built micro-ui, found by their manifests. `npm run build`. Owned by the harness.
import { copyFile, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import * as esbuild from "esbuild";
import { readProductFiles } from "../server/product.ts";

/** Bundles the product at `root`; answers the units bundled and the problems met. */
export async function buildShell(root: string): Promise<{ bundled: string[]; problems: string[] }> {
  const product = await readProductFiles(root);
  const ui = product.units.filter(
    (u) => (u.manifest.kind === "micro-ui" || u.manifest.kind === "shell") && u.built && u.entry,
  );
  const lines = [`import { start } from "./app/shell/host.tsx";`];
  ui.forEach((u, i) => {
    lines.push(`import * as unit${i} from "./${u.entry}";`);
  });
  const registry = ui.map((u, i) => `  ${JSON.stringify(u.manifest.id)}: unit${i}.default,`);
  lines.push(`start({\n${registry.join("\n")}\n});`);

  const out = join(root, "app/shell/dist");
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await esbuild.build({
    stdin: { contents: lines.join("\n"), resolveDir: root, loader: "tsx", sourcefile: "app.tsx" },
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    outfile: join(out, "app.js"),
    sourcemap: true,
    logLevel: "warning",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  // The host page links app.css; a product with no stylesheet of its own gets an empty one.
  try {
    await stat(join(out, "app.css"));
  } catch {
    await writeFile(join(out, "app.css"), "");
  }
  await copyFile(join(root, "app/shell/index.html"), join(out, "index.html"));
  return { bundled: ui.map((u) => u.manifest.id), problems: product.problems };
}

if (import.meta.main) {
  const root = resolve(import.meta.dirname, "../..");
  const { bundled, problems } = await buildShell(root);
  for (const p of problems) console.error(`problem: ${p}`);
  console.log(`app/shell/dist: ${bundled.length} units bundled (${bundled.join(", ") || "none"})`);
}
