// The product as the runtime reads it at start: its contracts, every unit by its manifest, the
// aggregates' code and the fixtures. A bad file never stops the start: it becomes a problem, and
// the units it concerns answer 501 until it is fixed.
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import {
  type DataModel,
  DataModelSchema,
  type MockPages,
  MockPagesSchema,
  type Surfaces,
  SurfacesSchema,
  type UnitManifest,
  UnitManifestSchema,
} from "#architecture";
import type { AggregateRules, Row } from "#kit/units.ts";

/** A unit as found on disk: its manifest, its entry file and whether that file holds code. */
export interface UnitFiles {
  manifest: UnitManifest;
  /** The unit's folder, relative to the product's root. */
  folder: string;
  /** The entry, relative to the root: `src/index.tsx` for a micro-ui or the shell, else `src/index.ts`. */
  entry: string | null;
  /** True once the entry has a default export: a unit without one is not built yet. */
  built: boolean;
}

/** The product's contracts and units, as read at start. */
export interface ProductFiles {
  root: string;
  model: DataModel;
  surfaces: Surfaces | null;
  mock: MockPages | null;
  units: UnitFiles[];
  /** Rows by entity, from `mock/fixtures/<entity>.json`. */
  fixtures: Record<string, Row[]>;
  problems: string[];
}

const UI_KINDS = new Set(["micro-ui", "shell"]);

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

/** Every `unit.json` under a folder, relative to the root, sorted. */
async function manifestsUnder(root: string, dir: string): Promise<string[]> {
  const out: string[] = [];
  let names: string[];
  try {
    names = await readdir(join(root, dir));
  } catch {
    return out;
  }
  for (const name of names.sort()) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (name === "unit.json") out.push(path);
    else if ((await stat(join(root, path))).isDirectory()) {
      out.push(...(await manifestsUnder(root, path)));
    }
  }
  return out;
}

/** A unit's entry file, relative to the root, or null when it has none yet. */
async function entryOf(root: string, folder: string, kind: string): Promise<string | null> {
  const names = UI_KINDS.has(kind) ? ["src/index.tsx", "src/index.ts"] : ["src/index.ts"];
  for (const name of names) {
    const path = join(folder, name);
    if (await exists(join(root, path))) return path;
  }
  return null;
}

/** Whether a unit's entry holds code: a default export, as every unit convention asks. */
export function holdsCode(source: string): boolean {
  return /^\s*export\s+default\b/m.test(source);
}

function parsed<T>(
  problems: string[],
  file: string,
  text: string | null,
  parse: (raw: unknown) => T,
): T | null {
  if (text === null) return null;
  try {
    return parse(JSON.parse(text));
  } catch (e) {
    problems.push(`${file}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** Reads the product at `root`: contracts, manifests, fixtures. Imports no code. */
export async function readProductFiles(root: string): Promise<ProductFiles> {
  const problems: string[] = [];
  const read = (file: string) => readOptional(join(root, file));
  const model =
    parsed(problems, "data/model.json", await read("data/model.json"), (raw) =>
      DataModelSchema.parse(raw),
    ) ?? DataModelSchema.parse({});
  const surfaces = parsed(problems, "surfaces.json", await read("surfaces.json"), (raw) =>
    SurfacesSchema.parse(raw),
  );
  const mock = parsed(problems, "mock/pages.json", await read("mock/pages.json"), (raw) =>
    MockPagesSchema.parse(raw),
  );

  const units: UnitFiles[] = [];
  const files = [...(await manifestsUnder(root, "units"))];
  if (await exists(join(root, "shell/unit.json"))) files.push("shell/unit.json");
  for (const file of files) {
    const manifest = parsed(problems, file, await read(file), (raw) =>
      UnitManifestSchema.parse(raw),
    );
    if (manifest === null) continue;
    if (units.some((u) => u.manifest.id === manifest.id)) {
      problems.push(`${file}: unit ${manifest.id} is declared twice`);
      continue;
    }
    const folder = relative(root, join(root, file, ".."));
    const entry = await entryOf(root, folder, manifest.kind);
    const source = entry === null ? null : await read(entry);
    units.push({ manifest, folder, entry, built: source !== null && holdsCode(source) });
  }

  const fixtures: Record<string, Row[]> = {};
  let names: string[] = [];
  try {
    names = await readdir(join(root, "mock/fixtures"));
  } catch {
    names = [];
  }
  for (const name of names.sort()) {
    if (!name.endsWith(".json")) continue;
    const file = `mock/fixtures/${name}`;
    const rows = parsed(problems, file, await read(file), (raw) => {
      if (!Array.isArray(raw)) throw new Error("a fixture is an array of rows");
      return raw.filter((r): r is Row => typeof r === "object" && r !== null && !Array.isArray(r));
    });
    if (rows !== null) fixtures[name.slice(0, -".json".length)] = rows;
  }
  return { root, model, surfaces, mock, units, fixtures, problems };
}

/** A unit's code once imported: its default export, or why it has none. */
export interface UnitCode {
  files: UnitFiles;
  /** The default export; undefined when the unit is not built or failed to load. */
  main: unknown;
  error: string | null;
}

/**
 * Imports the server side: every capability and data-capability that holds code, and the
 * aggregates' rules (`data/aggregates/<Aggregate>.ts`). Micro-uis and the shell are bundled for
 * the browser by app/shell/build.ts, never imported here.
 */
export async function importServerCode(product: ProductFiles): Promise<{
  units: Map<string, UnitCode>;
  aggregates: Map<string, AggregateRules>;
}> {
  const units = new Map<string, UnitCode>();
  for (const files of product.units) {
    if (UI_KINDS.has(files.manifest.kind)) continue;
    if (!files.built || files.entry === null) {
      units.set(files.manifest.id, { files, main: undefined, error: null });
      continue;
    }
    try {
      const module = (await import(pathToFileURL(join(product.root, files.entry)).href)) as {
        default?: unknown;
      };
      units.set(files.manifest.id, { files, main: module.default, error: null });
    } catch (e) {
      const error = `${files.manifest.id}: ${e instanceof Error ? e.message : String(e)}`;
      product.problems.push(error);
      units.set(files.manifest.id, { files, main: undefined, error });
    }
  }
  const aggregates = new Map<string, AggregateRules>();
  for (const a of product.model.aggregates) {
    const file = join(product.root, "data/aggregates", `${a.name}.ts`);
    if (!(await exists(file))) continue;
    try {
      const module = (await import(pathToFileURL(file).href)) as { default?: AggregateRules };
      if (module.default) aggregates.set(a.name, module.default);
      else product.problems.push(`data/aggregates/${a.name}.ts: no default export`);
    } catch (e) {
      product.problems.push(
        `data/aggregates/${a.name}.ts: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  return { units, aggregates };
}
