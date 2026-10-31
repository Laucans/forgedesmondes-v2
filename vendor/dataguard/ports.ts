// The DataGuard's ports: the queue, the aggregates, the messages and the clock it runs on.
import type { State } from "./define.ts";
import type { Change, Snapshot } from "./engine/decide.ts";
import type { CommandState } from "./engine/states.ts";

/** A command as the queue keeps it. */
export interface CommandRecord {
  /** Given by the store. */
  readonly id: string;
  /** Its place in line: the head of a partition is its lowest `seq` in line. */
  readonly seq: number;
  /** `<aggregate>/<target>`: one queue per aggregate instance. */
  readonly partition: string;
  /** The aggregate's name. */
  readonly aggregate: string;
  /** The aggregate instance's id. */
  readonly target: string;
  /** The command's id. */
  readonly command: string;
  /** The author's payload, as submitted (parsed again at the head). */
  readonly payload: unknown;
  /** The values the author saw; an overwrite they confirm adds what they were shown. */
  readonly declared: State;
  /** Who submitted it: the messages go to them. */
  readonly author: string;
  /** The author's roles when they submitted it: they decide whether it needs a review. */
  readonly roles: readonly string[];
  /** Where it stands. */
  readonly state: CommandState;
  /** Why it was rejected or cancelled. */
  readonly reason: string | null;
  /** While awaiting confirmation: the values it would overwrite, as they are now. */
  readonly conflict: State | null;
  /** Once applied: the aggregate instance's version it wrote. */
  readonly version: number | null;
  /** When it was submitted. */
  readonly createdAt: Date;
  /** When its state last moved. */
  readonly updatedAt: Date;
}

/** A command entering the queue; the store gives its id and its place. */
export type NewCommand = Omit<
  CommandRecord,
  "id" | "seq" | "reason" | "conflict" | "version" | "updatedAt"
>;

/** A command's next state, whole: every mutable field is written. */
export interface CommandUpdate {
  /** The new state. */
  readonly state: CommandState;
  /** Why, for a rejection or a cancellation. */
  readonly reason: string | null;
  /** What it would overwrite, while awaiting confirmation. */
  readonly conflict: State | null;
  /** The version it wrote, once applied. */
  readonly version: number | null;
  /** The values the author saw. */
  readonly declared: State;
  /** When this happened. */
  readonly updatedAt: Date;
  /** True to send it to the end of its partition's line (a new `seq`). */
  readonly requeue: boolean;
}

/** What a message tells its recipient. */
export type MessageKind = "review_asked" | "confirmation_asked" | "applied" | "rejected";

/** A message about a command, before the store numbers it. */
export interface NewMessage {
  /** An author, or `role:<name>` for the reviewers of a role. */
  readonly recipient: string;
  /** The command it is about. */
  readonly commandId: string;
  /** What it says. */
  readonly kind: MessageKind;
  /** The details: the conflict, the version, the reason. */
  readonly body: State;
  /** When it was sent. */
  readonly createdAt: Date;
}

/** A message as the store keeps it. */
export interface Message extends NewMessage {
  /** Increasing: a recipient reads its messages in this order. */
  readonly id: number;
}

/** The queue, inside a partition's transaction. */
export interface CommandStore {
  /** Adds a command at the end of its partition's line. */
  insert(command: NewCommand): Promise<CommandRecord>;
  /** A command by id, or null. */
  get(id: string): Promise<CommandRecord | null>;
  /** The oldest command of `partition` still in line (queued or awaiting review), or null. */
  head(partition: string): Promise<CommandRecord | null>;
  /** Moves a command. */
  update(id: string, update: CommandUpdate): Promise<void>;
}

/** The aggregates, inside a partition's transaction. */
export interface AggregateStore {
  /** An aggregate instance as stored now. */
  load(aggregate: string, target: string): Promise<Snapshot>;
  /**
   * Writes `change` on the instance at `expectedVersion` and answers the version written
   * (`expectedVersion + 1`). Throws `Refusal` to refuse the write, having undone what it wrote.
   */
  apply(
    aggregate: string,
    target: string,
    change: Change,
    expectedVersion: number,
  ): Promise<number>;
}

/** Where messages go: written with the transaction that decides them, never without it. */
export interface Notifier {
  /** Sends one message. */
  tell(message: NewMessage): Promise<void>;
}

/** What a partition's transaction can reach. */
export interface PartitionTx {
  /** The queue. */
  readonly commands: CommandStore;
  /** The aggregates. */
  readonly aggregates: AggregateStore;
  /** The messages. */
  readonly notifier: Notifier;
}

/** The store the DataGuard runs on: one transaction per partition step, serialized per partition. */
export interface GuardStore {
  /**
   * Runs `work` in one transaction holding `partition`'s lock — across every process sharing the
   * store — and commits it; rolls everything back when `work` throws.
   */
  partition<T>(partition: string, work: (tx: PartitionTx) => Promise<T>): Promise<T>;
  /** A command by id, read outside any lock. */
  command(id: string): Promise<CommandRecord | null>;
  /** The messages sent to `recipient`, oldest first. */
  messages(recipient: string): Promise<readonly Message[]>;
  /** The partitions with a command in line, the longest waiting first. */
  waiting(): Promise<readonly string[]>;
}

/** The time. */
export interface Clock {
  /** Now. */
  now(): Date;
}

/** The machine's clock. */
export const systemClock: Clock = { now: () => new Date() };
