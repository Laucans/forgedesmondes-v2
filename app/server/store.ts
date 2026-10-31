// The product's rows, entity by entity: in memory (fixtures, tests, the rules) or in its
// PostgreSQL. Units read them through the read port; only the DataGuard writes them, except the
// rules' set-up steps, which write as fixtures do.
import type { DataModel, StepAction } from "#architecture";
import type { ReadPort, Row } from "#kit/units.ts";

/** The rows of every entity: what the read port reads and what the guard's writes land in. */
export interface Tables extends ReadPort {
  /** Writes a row whole, by its key. */
  put(entity: string, row: Row): Promise<void>;
  /** Removes a row by its key. */
  delete(entity: string, id: string): Promise<void>;
}

/** A value as the rules write it: text, `""` for nothing. */
export function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/** Whether a row holds every value of `where`, compared as text. */
export function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([k, v]) => asText(row[k]) === asText(v));
}

/** The key field of an entity: `id` unless the model names another. */
export function keyOf(model: DataModel, entity: string): string {
  return model.entities.find((e) => e.name === entity)?.key ?? "id";
}

/** The rules' text values, typed by the model's fields: `"false"` is a boolean for a bool. */
export function typed(model: DataModel, entity: string, values: Record<string, string>): Row {
  const fields = model.entities.find((e) => e.name === entity)?.fields ?? [];
  const out: Row = {};
  for (const [name, text] of Object.entries(values)) {
    const type = fields.find((f) => f.name === name)?.type;
    if (type === "bool") out[name] = text === "true";
    else if (
      (type === "int" || type === "number") &&
      text.trim() !== "" &&
      Number.isFinite(Number(text))
    )
      out[name] = Number(text);
    else if (type === "json") {
      try {
        out[name] = JSON.parse(text);
      } catch {
        out[name] = text;
      }
    } else out[name] = text;
  }
  return out;
}

/** The rows in memory, loaded from the fixtures. */
export class MemoryTables implements Tables {
  readonly #model: DataModel;
  #rows = new Map<string, Row[]>();

  constructor(model: DataModel) {
    this.#model = model;
  }

  /** Replaces every row with the fixtures' (a deep copy, so a scenario never edits them). */
  load(fixtures: Record<string, Row[]>): void {
    this.#rows = new Map(
      Object.entries(fixtures).map(([entity, rows]) => [entity, structuredClone(rows)]),
    );
  }

  /** Every row of an entity, as stored (not copied). */
  rows(entity: string): Row[] {
    let rows = this.#rows.get(entity);
    if (!rows) {
      rows = [];
      this.#rows.set(entity, rows);
    }
    return rows;
  }

  async list(entity: string, where: Row = {}): Promise<Row[]> {
    return structuredClone(this.rows(entity).filter((r) => matches(r, where)));
  }

  async get(entity: string, id: string): Promise<Row | null> {
    const key = keyOf(this.#model, entity);
    const row = this.rows(entity).find((r) => asText(r[key]) === id);
    return row ? structuredClone(row) : null;
  }

  async put(entity: string, row: Row): Promise<void> {
    const key = keyOf(this.#model, entity);
    const rows = this.rows(entity);
    const at = rows.findIndex((r) => asText(r[key]) === asText(row[key]));
    if (at >= 0) rows[at] = structuredClone(row);
    else rows.push(structuredClone(row));
  }

  async delete(entity: string, id: string): Promise<void> {
    const key = keyOf(this.#model, entity);
    const rows = this.rows(entity);
    const at = rows.findIndex((r) => asText(r[key]) === id);
    if (at >= 0) rows.splice(at, 1);
  }

  /** A key no row of the entity has, readable: from the row's first text value. */
  freshKey(entity: string, row: Row): string {
    const key = keyOf(this.#model, entity);
    const first = Object.values(row).find((v) => typeof v === "string" && v.trim() !== "");
    const base =
      asText(first)
        .normalize("NFD")
        .replace(/\p{M}+/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || entity;
    const taken = new Set(this.rows(entity).map((r) => asText(r[key])));
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    return id;
  }
}

/** A data step's verdict. */
export interface StepVerdict {
  passed: boolean;
  detail: string;
}

function described(where: Record<string, string>): string {
  const pairs = Object.entries(where).map(([k, v]) => `${k}=${v}`);
  return pairs.length > 0 ? ` (${pairs.join(", ")})` : "";
}

/**
 * Plays a data step of the rules, as the mock player does: a `Given` sets the scenario up (adds
 * the row it needs, removes the one it must not find), a `When` or a `Then` checks. Answers the
 * entities it wrote, so the caller can tell the write side.
 */
export async function playDataStep(
  tables: MemoryTables,
  model: DataModel,
  keyword: "Given" | "When" | "Then",
  action: StepAction,
): Promise<StepVerdict & { wrote: string[] }> {
  const ok = (detail: string, wrote: string[] = []) => ({ passed: true, detail, wrote });
  const ko = (detail: string) => ({ passed: false, detail, wrote: [] });
  if (action.kind !== "data-exists" && action.kind !== "data-absent" && action.kind !== "data-has")
    return ko(`not a data step: ${action.kind}`);
  const { entity } = action;
  const key = keyOf(model, entity);
  const where = typed(model, entity, action.where);
  const found = tables.rows(entity).filter((r) => matches(r, where));
  switch (action.kind) {
    case "data-exists": {
      if (keyword === "Given" && found.length === 0) {
        const row = { ...where };
        if (row[key] === undefined) row[key] = tables.freshKey(entity, row);
        await tables.put(entity, row);
        return ok(`${entity} row added for the scenario${described(action.where)}`, [entity]);
      }
      return found.length > 0
        ? ok(`${found.length} ${entity} row(s)${described(action.where)}`)
        : ko(`no ${entity} row${described(action.where)}`);
    }
    case "data-absent": {
      if (keyword === "Given") {
        for (const row of found) await tables.delete(entity, asText(row[key]));
        return ok(`${found.length} ${entity} row(s) removed for the scenario`, [entity]);
      }
      return found.length === 0
        ? ok(`no ${entity} row${described(action.where)}`)
        : ko(`${found.length} ${entity} row(s) still there${described(action.where)}`);
    }
    case "data-has": {
      const set = typed(model, entity, action.set);
      if (keyword === "Given") {
        if (found.length === 0) {
          const row = { ...where, ...set };
          if (row[key] === undefined) row[key] = tables.freshKey(entity, row);
          await tables.put(entity, row);
        }
        for (const row of found) await tables.put(entity, { ...row, ...set });
        return ok(`${entity} row set up for the scenario`, [entity]);
      }
      if (found.length === 0) return ko(`no ${entity} row${described(action.where)}`);
      if (found.some((r) => matches(r, set))) return ok(`${entity}${described(action.set)}`);
      const actual = Object.keys(action.set)
        .map((f) => `${f}=${asText(found[0]?.[f])}`)
        .join(", ");
      return ko(`expected${described(action.set)}, found (${actual})`);
    }
  }
}
