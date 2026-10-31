// The unit conventions: what each kind of unit exports, and what it is given. The runtime (app/)
// loads every unit by its manifest and calls these exports, so no task ever wires the app.
// Owned by the harness: `harness upgrade-runtime` rewrites this file.
import type { ComponentType, ReactNode } from "react";
import type { z } from "zod";

/** A row of an entity of data/model.json, as the store and the fixtures hold it. */
export type Row = Record<string, unknown>;

/** Read access to the product's data, entity by entity. */
export interface ReadPort {
  /** The rows of an entity; `where` keeps the rows whose fields equal the values given. */
  list(entity: string, where?: Row): Promise<Row[]>;
  /** One row by its key, or null. */
  get(entity: string, id: string): Promise<Row | null>;
}

/** What a capability (and a data-capability's check) is given besides its input. */
export interface UnitContext {
  /** The product's data, read only. */
  data: ReadPort;
  /** The role of the person asking (an id of surfaces.json). */
  role: string;
  /** Who is asking. */
  user: string;
}

/**
 * A capability, `units/<system>/<name>/src/index.ts`: `export default capability(fn)`.
 * It reads, never writes; `POST /capabilities/<id>` with `{ "input": … }` answers `{ "output": … }`.
 */
export type Capability<I = unknown, O = unknown> = (input: I, ctx: UnitContext) => O | Promise<O>;

/** Types a capability; the function itself is the export. */
export function capability<I, O>(fn: Capability<I, O>): Capability<I, O> {
  return fn;
}

interface WriteCommon<P> {
  /** Parses the payload a micro-ui sends; a refused parse rejects the command with its message. */
  payload: z.ZodType<P>;
  /** The aggregate instance the payload names: its key (the root row's id). */
  target(payload: P): string;
  /** True when the write composes with others ahead of it (a counter): never asks to confirm. */
  relative?: boolean;
  /**
   * A refusal that needs other rows than the instance's (a unique name): the reason, or null.
   * Runs before the command is queued, so it is not serialized with other writes.
   */
  check?(payload: P, ctx: UnitContext): string | null | Promise<string | null>;
}

/** A data-capability that creates its instance. */
export interface AddWrite<S extends Row, P> extends WriteCommon<P> {
  /** Discriminant. */
  kind: "add";
  /** The fields written; `state` is null when the instance does not exist yet. */
  plan(state: S | null, payload: P): Partial<S>;
}

/** A data-capability that changes an existing instance. */
export interface ChangeWrite<S extends Row, P> extends WriteCommon<P> {
  /** Discriminant. */
  kind: "change";
  /** The fields written, given the instance's real state when its turn comes. */
  plan(state: S, payload: P): Partial<S>;
}

/** A data-capability that removes an instance. */
export interface RemoveWrite<P> extends WriteCommon<P> {
  /** Discriminant. */
  kind: "remove";
}

/**
 * A data-capability, `units/<system>/<name>/src/index.ts`: `export default dataCapability({…})`.
 * Its id, aggregate and the fields it may write come from its manifest (`touches`); the runtime
 * sends it through the DataGuard: queued per instance, judged on the real state, invariants of
 * `data/aggregates/<Aggregate>.ts` checked after the plan.
 */
export type DataCapability<S extends Row = Row, P = unknown> =
  | AddWrite<S, P>
  | ChangeWrite<S, P>
  | RemoveWrite<P>;

/** Types a data-capability. */
export function dataCapability<S extends Row, P>(def: AddWrite<S, P>): AddWrite<S, P>;
/** Types a data-capability. */
export function dataCapability<S extends Row, P>(def: ChangeWrite<S, P>): ChangeWrite<S, P>;
/** Types a data-capability. */
export function dataCapability<P>(def: RemoveWrite<P>): RemoveWrite<P>;
export function dataCapability<S extends Row, P>(def: DataCapability<S, P>): DataCapability<S, P> {
  return def;
}

/** An invariant of an aggregate: why the state breaks it, or null when it holds. */
export interface Invariant<S extends Row = Row> {
  /** The invariant's id in data/model.json. */
  id: string;
  /** Why `state` breaks it, or null. */
  check(state: S): string | null;
}

/**
 * An aggregate's code, `data/aggregates/<Aggregate>.ts`: `export default aggregate({…})`. Its
 * state is the root entity's row. An aggregate with no file runs with no invariant.
 */
export interface AggregateRules<S extends Row = Row> {
  /** Every invariant data/model.json declares for it, by the same id. */
  invariants?: Invariant<S>[];
  /** Fields whose change waits for a reviewer, unless the author holds a reviewer role. */
  critical?: (keyof S & string)[];
  /** For each critical field, the roles that may review it. */
  reviewers?: Partial<Record<keyof S & string, string[]>>;
}

/** Types an aggregate's rules. */
export function aggregate<S extends Row>(rules: AggregateRules<S>): AggregateRules<S> {
  return rules;
}

/** Where a command stands: the DataGuard's states. */
export type CommandState =
  | "queued"
  | "awaiting_review"
  | "awaiting_confirmation"
  | "applied"
  | "rejected"
  | "cancelled";

/** What became of a command a micro-ui sent. */
export interface Outcome {
  /** The data-capability's id. */
  action: string;
  /** The command's id; null when it was refused before entering the queue. */
  id: string | null;
  state: CommandState;
  /** Why it was rejected, when it was. */
  reason: string | null;
}

/** An element of a mock page, as pages.json declares it: what a micro-ui renders. */
export interface ElementSpec {
  /** The `data-el` the element keeps in the app: the rules click it by this id. */
  id: string;
  kind: "component" | "link" | "action" | "field" | "list" | "text";
  label: string;
  /** A link's page. */
  to?: string;
  /** An action's data-capability. */
  action?: string;
  /** Roles that see it; empty, every role. */
  roles: string[];
}

/** A page of the app: a mock page, one route `/<id>`. */
export interface PageSpec {
  id: string;
  title: string;
  /** One step for a main page (listed in the menu); its parent first for a detail page. */
  path: string[];
}

/** What every micro-ui is given by the runtime. */
export interface MicroUiProps {
  /** The current role. */
  role: string;
  /** The page it is mounted on. */
  page: string;
  /** The page's address parameters (`/<page>?id=…`). */
  params: Record<string, string>;
  /** Its own elements on this page, in the mock's order. */
  elements: ElementSpec[];
  /** Grows after every applied command: data read before it may be stale. */
  version: number;
  /** Calls a capability of the manifest's `needs`. */
  call<T = unknown>(capability: string, input?: unknown): Promise<T>;
  /** Sends a data-capability of the manifest's `actions`; resolves once it is judged. */
  command(dataCapability: string, payload: unknown, declared?: Row): Promise<Outcome>;
  /** Goes to a page. */
  navigate(page: string, params?: Record<string, string>): void;
}

/**
 * A micro-ui, `units/<system>/<name>/src/index.tsx`: `export default microUi(Component)`. It is
 * mounted on every page its manifest lists in `screens`, in the order of its elements there.
 */
export type MicroUi = ComponentType<MicroUiProps>;

/** Types a micro-ui. */
export function microUi(component: MicroUi): MicroUi {
  return component;
}

/** What the shell is given: the page, the pages, the role, and the page's micro-uis to frame. */
export interface ShellProps {
  role: string;
  /** Every role of surfaces.json. */
  roles: string[];
  setRole(role: string): void;
  /** The page shown (the error page for an unknown address). */
  page: PageSpec;
  /** The shell's own elements on this page (the site menu and its links), in the mock's order. */
  elements: ElementSpec[];
  /** Every page, in pages.json's order. */
  pages: PageSpec[];
  /** The page a user lands on. */
  home: string;
  navigate(page: string, params?: Record<string, string>): void;
  /** The page's micro-uis, mounted by the runtime. */
  children: ReactNode;
}

/** The shell, `shell/src/index.tsx`: `export default shell(Component)`. */
export type Shell = ComponentType<ShellProps>;

/** Types the shell. */
export function shell(component: Shell): Shell {
  return component;
}
