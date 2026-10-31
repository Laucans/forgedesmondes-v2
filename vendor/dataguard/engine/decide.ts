// Pure decisions: what the head command's fate is, and who must review a command.
import type { Aggregate, Command, Kind, State } from "../define.ts";

/** An aggregate instance as its store holds it: version 0 and no state when it was never written. */
export interface Snapshot {
  /** Incremented by every applied command; 0 before the first. */
  readonly version: number;
  /** Null when the instance does not exist (never written, or removed). */
  readonly state: State | null;
}

/** What an applied command writes: the fields set, and the whole state after (null once removed). */
export interface Change {
  /** The command's kind. */
  readonly kind: Kind;
  /** The fields the plan wrote (empty for a removal). */
  readonly set: State;
  /** The state after the write: what the invariants were checked on. */
  readonly next: State | null;
}

/** An invariant that does not hold, and why. */
export interface Violation {
  /** The invariant's id. */
  readonly id: string;
  /** What its check answered. */
  readonly why: string;
}

/** The head command's fate. */
export type Fate =
  | { readonly kind: "apply"; readonly path: "fast" | "resolver"; readonly change: Change }
  | { readonly kind: "confirm"; readonly conflict: State }
  | { readonly kind: "reject"; readonly reason: string; readonly violations: readonly Violation[] };

/** What the head is judged on: the command, the author's payload and declared values, the real state. */
export interface Head {
  /** The command's definition. */
  readonly command: Command;
  /** The payload, parsed. */
  readonly payload: unknown;
  /** The values the author saw, field by field. */
  readonly declared: State;
  /** The aggregate instance as its store holds it now, inside the guard's transaction. */
  readonly snapshot: Snapshot;
}

/**
 * Decides the head: a pure addition takes the fast path (invariants only); anything that meets
 * existing data goes through the resolver (overwrites the author did not see, then invariants).
 */
export function decideHead(head: Head): Fate {
  const { command, payload, declared, snapshot } = head;
  const current = snapshot.state;
  const name = command.aggregate.name;
  if (current === null && command.kind !== "add") {
    return reject(`${name} does not exist`);
  }
  if (command.kind === "remove") {
    const fields = [...new Set([...Object.keys(current ?? {}), ...Object.keys(declared)])];
    const conflict = command.relative ? null : overwritten(declared, current ?? {}, fields, false);
    if (conflict) return { kind: "confirm", conflict };
    return { kind: "apply", path: "resolver", change: { kind: "remove", set: {}, next: null } };
  }
  let set: State;
  try {
    // A change never reaches its plan without a state: refused above.
    set =
      command.kind === "add"
        ? command.plan(current, payload)
        : command.plan(current ?? {}, payload);
  } catch (error) {
    return reject(`plan failed: ${messageOf(error)}`);
  }
  const touches: readonly string[] = command.touches;
  const undeclared = Object.keys(set).filter((field) => !touches.includes(field));
  if (undeclared.length > 0) {
    return reject(`${command.id} writes undeclared field(s): ${undeclared.sort().join(", ")}`);
  }
  // Dynamic classification: an addition that meets an existing instance is a mutation.
  const path = command.kind === "add" && current === null ? "fast" : "resolver";
  if (path === "resolver" && !command.relative) {
    const conflict = overwritten(declared, current ?? {}, Object.keys(set), command.kind === "add");
    if (conflict) return { kind: "confirm", conflict };
  }
  const next = { ...(current ?? {}), ...set };
  const violations = judge(command.aggregate, next);
  if (violations.length > 0) {
    return {
      kind: "reject",
      reason: violations.map((v) => `${v.id}: ${v.why}`).join("; "),
      violations,
    };
  }
  return { kind: "apply", path, change: { kind: command.kind, set, next } };
}

/**
 * Among `fields`, those whose value in `current` is not what the author declared, with their value
 * now. A field the author declared nothing for is not compared — unless `unseen` (an addition: the
 * author saw no instance, so any value already there is one they did not see).
 */
export function overwritten(
  declared: State,
  current: State,
  fields: readonly string[],
  unseen: boolean,
): State | null {
  const conflict: Record<string, unknown> = {};
  for (const field of fields) {
    const said = Object.hasOwn(declared, field);
    if (!said && !unseen) continue;
    const now = current[field];
    if (!same(said ? declared[field] : null, now)) conflict[field] = now ?? null;
  }
  return Object.keys(conflict).length > 0 ? conflict : null;
}

/** The invariants of `aggregate` that `state` breaks; a check that throws counts as broken. */
export function judge(aggregate: Aggregate, state: State): Violation[] {
  const violations: Violation[] = [];
  for (const invariant of aggregate.invariants) {
    let why: string | null;
    try {
      why = invariant.check(state);
    } catch (error) {
      why = `check failed: ${messageOf(error)}`;
    }
    if (why !== null) violations.push({ id: invariant.id, why });
  }
  return violations;
}

/**
 * The critical fields `command` touches that an author holding `roles` may not change alone,
 * each with the roles allowed to review it. Empty when no review is needed.
 */
export function reviewNeeded(
  command: Command,
  roles: readonly string[],
): Readonly<Record<string, readonly string[]>> {
  const { critical, reviewers } = command.aggregate;
  const need: Record<string, readonly string[]> = {};
  for (const field of command.touches) {
    if (!critical.includes(field)) continue;
    const allowed = reviewers[field] ?? [];
    if (!allowed.some((role) => roles.includes(role))) need[field] = allowed;
  }
  return need;
}

/** True when a reviewer holding `roles` may decide every field of `need`. */
export function mayReview(
  need: Readonly<Record<string, readonly string[]>>,
  roles: readonly string[],
): boolean {
  return Object.values(need).every((allowed) => allowed.some((role) => roles.includes(role)));
}

/** JSON equality: key order ignored, an absent value equal to null. */
export function same(a: unknown, b: unknown): boolean {
  return canonical(a ?? null) === canonical(b ?? null);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => canonical(v ?? null)).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function reject(reason: string): Fate {
  return { kind: "reject", reason, violations: [] };
}

/** The message of whatever was thrown. */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
