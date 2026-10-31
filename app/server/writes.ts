// The write side: every data-capability becomes a DataGuard command (its id, aggregate and
// fields from its manifest, its payload, target and plan from its code), and every command goes
// through the guard. In memory the guard keeps its own instances; they are seeded from the rows
// and every applied write is copied back, so the read port sees it at once.

import type { DataModel } from "#architecture";
import {
  type Aggregate,
  type Command,
  DataGuard,
  DataGuardError,
  defineAggregate,
  type GuardStore,
  MemoryStore,
  type State,
} from "#dataguard";
import type { AggregateRules, DataCapability, Outcome, Row, UnitContext } from "#kit/units.ts";
import type { UnitCode } from "./product.ts";
import { asText, keyOf, type MemoryTables, type Tables } from "./store.ts";

/** The root entity of an aggregate: the model's, else the aggregate's name in lower camel case. */
export function rootOf(model: DataModel, aggregate: string): string {
  return (
    model.aggregates.find((a) => a.name === aggregate)?.root ??
    `${aggregate.charAt(0).toLowerCase()}${aggregate.slice(1)}`
  );
}

/** A data-capability's field names: its manifest's `touches`, `entity.field` read as `field`. */
export function fieldsOf(touches: readonly string[]): string[] {
  return touches.map((t) => (t.includes(".") ? t.slice(t.indexOf(".") + 1) : t));
}

function isWrite(value: unknown): value is DataCapability {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.kind === "add" || v.kind === "change" || v.kind === "remove") &&
    typeof v.target === "function" &&
    typeof v.payload === "object"
  );
}

/** The guard's commands, built from the data-capabilities that hold code; and what went wrong. */
export function commandsOf(
  units: ReadonlyMap<string, UnitCode>,
  rules: ReadonlyMap<string, AggregateRules>,
): { commands: Command[]; writes: Map<string, DataCapability>; problems: string[] } {
  const problems: string[] = [];
  const aggregates = new Map<string, Aggregate>();
  const aggregateOf = (name: string): Aggregate => {
    let found = aggregates.get(name);
    if (!found) {
      const r = rules.get(name) ?? {};
      found = defineAggregate<State>({
        name,
        invariants: (r.invariants ?? []) as Aggregate["invariants"],
        critical: r.critical ?? [],
        reviewers: r.reviewers ?? {},
      });
      aggregates.set(name, found);
    }
    return found;
  };
  const commands: Command[] = [];
  const writes = new Map<string, DataCapability>();
  for (const [id, unit] of units) {
    const { manifest } = unit.files;
    if (manifest.kind !== "data-capability" || unit.main === undefined) continue;
    if (!isWrite(unit.main)) {
      problems.push(
        `${id}: its default export is not a dataCapability({ kind, payload, target, … })`,
      );
      continue;
    }
    const def = unit.main;
    try {
      const common = {
        id,
        aggregate: aggregateOf(manifest.aggregate ?? ""),
        payload: def.payload,
        touches: fieldsOf(manifest.touches),
        target: (p: unknown) => def.target(p),
        ...(def.relative === undefined ? {} : { relative: def.relative }),
      };
      const command: Command =
        def.kind === "remove"
          ? { ...common, kind: "remove" }
          : def.kind === "add"
            ? { ...common, kind: "add", plan: (s, p) => def.plan(s as Row | null, p) as State }
            : { ...common, kind: "change", plan: (s, p) => def.plan(s as Row, p) as State };
      commands.push(command);
      writes.set(id, def);
    } catch (e) {
      problems.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { commands, writes, problems };
}

/** Who sends a command. */
export interface Sender {
  role: string;
  user: string;
}

/** The write side the HTTP server calls. */
export interface WriteSide {
  /** Judges a command at once: queued, judged at its partition's head, answered. */
  send(command: string, payload: unknown, by: Sender, declared?: Row): Promise<Outcome>;
  /** A command's state. */
  status(id: string): Promise<Outcome | null>;
  /** Confirms or declines an overwrite its author was asked about. */
  confirm(id: string, overwrite: boolean): Promise<Outcome | null>;
  /** The messages of a recipient. */
  messages(recipient: string): Promise<readonly unknown[]>;
}

interface Options {
  model: DataModel;
  tables: Tables;
  commands: readonly Command[];
  writes: ReadonlyMap<string, DataCapability>;
  /** Who may trigger what: false refuses before the queue. */
  mayTrigger(role: string, command: string): boolean;
}

function outcomeOf(
  action: string,
  record: { id: string; state: Outcome["state"]; reason: string | null },
): Outcome {
  return { action, id: record.id, state: record.state, reason: record.reason };
}

function refused(action: string, reason: string): Outcome {
  return { action, id: null, state: "rejected", reason };
}

/** The write side on a guard store: memory (mirrored into its tables) or PostgreSQL. */
export class Writes implements WriteSide {
  readonly #options: Options;
  #store: GuardStore;
  #guard: DataGuard;
  readonly #memory: boolean;

  constructor(options: Options, store?: GuardStore) {
    this.#options = options;
    this.#memory = store === undefined;
    this.#store = store ?? new MemoryStore();
    this.#guard = new DataGuard({ store: this.#store, commands: options.commands });
  }

  /** Memory only: seeds the guard's instances from the rows, its queue empty. */
  reseed(tables: MemoryTables): void {
    if (!this.#memory) return;
    const memory = new MemoryStore();
    const aggregates = new Set(this.#options.commands.map((c) => c.aggregate.name));
    for (const name of aggregates) {
      const root = rootOf(this.#options.model, name);
      const key = keyOf(this.#options.model, root);
      for (const row of tables.rows(root)) memory.seed(name, asText(row[key]), row);
    }
    this.#store = memory;
    this.#guard = new DataGuard({ store: memory, commands: this.#options.commands });
  }

  async send(command: string, payload: unknown, by: Sender, declared: Row = {}): Promise<Outcome> {
    const def = this.#options.writes.get(command);
    const known = this.#options.commands.find((c) => c.id === command);
    if (!def || !known) return refused(command, `${command} is not built`);
    if (!this.#options.mayTrigger(by.role, command))
      return refused(command, `the role ${by.role} may not trigger ${command}`);
    if (def.check) {
      const parsed = def.payload.safeParse(payload);
      if (parsed.success) {
        const ctx: UnitContext = { data: this.#options.tables, role: by.role, user: by.user };
        const reason = await def.check(parsed.data, ctx);
        if (reason !== null) return refused(command, reason);
      }
    }
    let submitted: { id: string; partition: string };
    try {
      submitted = await this.#guard.submit(command, payload, {
        author: by.user,
        roles: [by.role],
        declared,
      });
    } catch (e) {
      if (e instanceof DataGuardError) return refused(command, e.message);
      throw e;
    }
    await this.#drain(submitted.partition);
    const record = await this.#guard.status(submitted.id);
    return record ? outcomeOf(command, record) : refused(command, "the command was lost");
  }

  async status(id: string): Promise<Outcome | null> {
    const record = await this.#guard.status(id);
    return record ? outcomeOf(record.command, record) : null;
  }

  async confirm(id: string, overwrite: boolean): Promise<Outcome | null> {
    const record = await this.#guard.confirm(id, overwrite);
    await this.#drain(record.partition);
    return this.status(id);
  }

  messages(recipient: string): Promise<readonly unknown[]> {
    return this.#guard.messages(recipient);
  }

  /** Judges a partition's heads; in memory, copies every applied write into the rows. */
  async #drain(partition: string): Promise<void> {
    const drained = await this.#guard.process(partition);
    if (!this.#memory || !(this.#store instanceof MemoryStore)) return;
    if (!drained.outcomes.some((o) => o.state === "applied")) return;
    const at = partition.indexOf("/");
    const aggregate = partition.slice(0, at);
    const target = partition.slice(at + 1);
    const root = rootOf(this.#options.model, aggregate);
    const key = keyOf(this.#options.model, root);
    const snapshot = this.#store.aggregate(aggregate, target);
    if (snapshot.state === null) await this.#options.tables.delete(root, target);
    else await this.#options.tables.put(root, { ...snapshot.state, [key]: target });
  }
}
