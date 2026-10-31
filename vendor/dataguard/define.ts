import type { z } from "zod";
import { DataGuardError } from "./errors.ts";

/** An aggregate instance's state: a JSON object (declare it with `type`, not `interface`). */
export type State = Readonly<Record<string, unknown>>;

/** A rule the aggregate's state must satisfy after every write. */
export interface Invariant<S extends State = State> {
  /** Stable name, quoted in a rejection's reason. */
  readonly id: string;
  /** Why `state` breaks the rule, or null when it holds. */
  check(state: S): string | null;
}

/** An aggregate: its invariants, its critical fields, and the roles allowed to review each. */
export interface Aggregate<S extends State = State> {
  /** Names the aggregate; a partition is `<name>/<target>`. */
  readonly name: string;
  /** Checked on the real state at the head, which alone decides. */
  readonly invariants: readonly Invariant<S>[];
  /** Fields whose change waits for a reviewer, unless its author holds a reviewer role. */
  readonly critical: readonly (keyof S & string)[];
  /** For each critical field, the roles allowed to review a change of it. */
  readonly reviewers: Readonly<Partial<Record<keyof S & string, readonly string[]>>>;
}

/** What a command does to its aggregate instance. */
export type Kind = "add" | "change" | "remove";

interface CommandCommon<S extends State, P> {
  /** Stable id, kept in the queue: renaming it strands the commands already queued. */
  readonly id: string;
  /** The aggregate the command writes. */
  readonly aggregate: Aggregate<S>;
  /** Parses the author's payload, at submission and again at the head. */
  readonly payload: z.ZodType<P>;
  /**
   * Every field the command may write: its review is decided on them, and a plan writing another
   * is rejected. A removal lists the critical fields it should be reviewed for (possibly none).
   */
  readonly touches: readonly (keyof S & string)[];
  /** True when the command composes with what is ahead (a deposit): it never asks to confirm an overwrite. */
  readonly relative?: boolean;
  /** The aggregate instance the payload names. */
  target(payload: P): string;
}

/** A pure addition: it creates the instance (fast path), or meets one already there (resolver). */
export interface AddCommand<S extends State = State, P = unknown> extends CommandCommon<S, P> {
  /** Discriminant. */
  readonly kind: "add";
  /** The fields written, given the state at the head (null when the instance does not exist). */
  plan(state: S | null, payload: P): Partial<S>;
}

/** A mutation of an existing instance: always through the resolver. */
export interface ChangeCommand<S extends State = State, P = unknown> extends CommandCommon<S, P> {
  /** Discriminant. */
  readonly kind: "change";
  /** The fields written, given the real state at the head. */
  plan(state: S, payload: P): Partial<S>;
}

/** The removal of an existing instance: always through the resolver. */
export interface RemoveCommand<S extends State = State, P = unknown> extends CommandCommon<S, P> {
  /** Discriminant. */
  readonly kind: "remove";
}

/** A typed command (a DataCapability): what it writes, on which aggregate, from which payload. */
export type Command<S extends State = State, P = unknown> =
  | AddCommand<S, P>
  | ChangeCommand<S, P>
  | RemoveCommand<S, P>;

const NAME = /^[A-Za-z][A-Za-z0-9_.-]*$/;

/** Checks an aggregate's definition once, at load: a critical field nobody may review would block forever. */
export function defineAggregate<S extends State>(aggregate: Aggregate<S>): Aggregate<S> {
  if (!NAME.test(aggregate.name)) {
    throw new DataGuardError("misconfigured", `aggregate name "${aggregate.name}" is not a name`);
  }
  const ids = aggregate.invariants.map((i) => i.id);
  const twice = ids.filter((id, n) => ids.indexOf(id) !== n);
  if (twice.length > 0) {
    throw new DataGuardError("misconfigured", `${aggregate.name}: invariant ${twice[0]} twice`);
  }
  for (const field of aggregate.critical) {
    const roles = aggregate.reviewers[field] ?? [];
    if (roles.length === 0) {
      throw new DataGuardError(
        "misconfigured",
        `${aggregate.name}.${field} is critical and no role may review it`,
      );
    }
  }
  return aggregate;
}

/** Checks a command's definition once, at load. */
export function defineCommand<S extends State, P>(command: AddCommand<S, P>): AddCommand<S, P>;
/** Checks a command's definition once, at load. */
export function defineCommand<S extends State, P>(
  command: ChangeCommand<S, P>,
): ChangeCommand<S, P>;
/** Checks a command's definition once, at load. */
export function defineCommand<S extends State, P>(
  command: RemoveCommand<S, P>,
): RemoveCommand<S, P>;
export function defineCommand<S extends State, P>(command: Command<S, P>): Command<S, P> {
  if (!NAME.test(command.id)) {
    throw new DataGuardError("misconfigured", `command id "${command.id}" is not a name`);
  }
  if (command.kind !== "remove" && command.touches.length === 0) {
    throw new DataGuardError("misconfigured", `${command.id} touches no field`);
  }
  return command;
}
