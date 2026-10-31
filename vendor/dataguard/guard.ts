// The DataGuard: sequences the pure decisions over the ports, one partition transaction at a time.
import { z } from "zod";
import type { Command, State } from "./define.ts";
import { decideHead, type Fate, mayReview, messageOf, reviewNeeded } from "./engine/decide.ts";
import { admitted, type CommandEvent, type CommandState, transition } from "./engine/states.ts";
import { DataGuardError, Refusal } from "./errors.ts";
import {
  type Clock,
  type CommandRecord,
  type CommandUpdate,
  type GuardStore,
  type Message,
  type PartitionTx,
  systemClock,
} from "./ports.ts";

/** How long a review may hold its partition's head before the command is rejected: 72 h. */
export const REVIEW_TTL_MS = 72 * 3_600_000;

/** What the DataGuard runs on. */
export interface DataGuardOptions {
  /** The queue, the aggregates and the messages. */
  readonly store: GuardStore;
  /** Every command the product accepts. */
  readonly commands: readonly Command[];
  /** The time; the machine's by default. */
  readonly clock?: Clock;
  /** How long a review may hold its partition's head; `REVIEW_TTL_MS` by default. */
  readonly reviewTtlMs?: number;
}

/** Who submits a command, and what they saw. */
export interface Author {
  /** The author: the messages about the command go to them. */
  readonly author: string;
  /** Their roles: an author holding a reviewer role changes a critical field alone. */
  readonly roles?: readonly string[];
  /** The values they saw, field by field: an overwrite of another value asks them first. */
  readonly declared?: unknown;
}

/** A command, queued. */
export interface Submitted {
  /** Its id. */
  readonly id: string;
  /** `queued`, or `awaiting_review`. */
  readonly state: CommandState;
  /** The partition to `process`. */
  readonly partition: string;
}

/** What happened to a head command in `process`. */
export interface Outcome {
  /** The command. */
  readonly id: string;
  /** `applied`, `rejected` or `awaiting_confirmation`. */
  readonly state: CommandState;
  /** For an applied command: the fast path (a pure addition) or the resolver. */
  readonly path?: "fast" | "resolver";
  /** For an applied command: the instance's version it wrote. */
  readonly version?: number;
  /** For a rejected one: why. */
  readonly reason?: string;
}

/** What one `process` did. */
export interface Drained {
  /** The partition processed. */
  readonly partition: string;
  /** Each head settled, in order. */
  readonly outcomes: readonly Outcome[];
  /** The command awaiting a review at the head, holding the partition; null when the line is empty. */
  readonly waitingOn: string | null;
}

const Submitter = z.object({
  author: z.string().min(1),
  roles: z.array(z.string()).default([]),
  declared: z.record(z.string(), z.unknown()).default({}),
});

type Step = { readonly done: true; readonly waitingOn: string | null } | Outcome;

/**
 * The write side's one frontier: every mutation enters the queue of its aggregate instance, and
 * only the head of a queue is judged, on the real state, in one transaction.
 */
export class DataGuard {
  readonly #store: GuardStore;
  readonly #clock: Clock;
  readonly #commands: ReadonlyMap<string, Command>;
  readonly #reviewTtlMs: number;

  constructor(options: DataGuardOptions) {
    this.#store = options.store;
    this.#clock = options.clock ?? systemClock;
    this.#reviewTtlMs = options.reviewTtlMs ?? REVIEW_TTL_MS;
    const commands = new Map<string, Command>();
    for (const command of options.commands) {
      if (commands.has(command.id)) {
        throw new DataGuardError("misconfigured", `command ${command.id} registered twice`);
      }
      commands.set(command.id, command);
    }
    this.#commands = commands;
  }

  /**
   * Queues a command at the end of its aggregate instance's line: `awaiting_review` when it
   * touches a critical field its author may not change alone, `queued` otherwise. Throws
   * `DataGuardError` for an unknown command or an invalid payload; nothing is queued then.
   */
  async submit(command: string, payload: unknown, by: Author): Promise<Submitted> {
    const definition = this.#definition(command);
    const parsed = definition.payload.safeParse(payload);
    if (!parsed.success) {
      throw new DataGuardError("invalid_payload", z.prettifyError(parsed.error));
    }
    const submitter = Submitter.safeParse(by);
    if (!submitter.success) {
      throw new DataGuardError("invalid_payload", z.prettifyError(submitter.error));
    }
    const { author, roles, declared } = submitter.data;
    const target = definition.target(parsed.data);
    if (target.length === 0) throw new DataGuardError("invalid_payload", "the target is empty");
    const aggregate = definition.aggregate.name;
    const partition = `${aggregate}/${target}`;
    const need = reviewNeeded(definition, roles);
    const state = admitted(Object.keys(need).length > 0);
    const now = this.#clock.now();
    return this.#store.partition(partition, async (tx) => {
      const record = await tx.commands.insert({
        partition,
        aggregate,
        target,
        command: definition.id,
        payload: payload ?? null,
        declared,
        author,
        roles,
        state,
        createdAt: now,
      });
      if (state === "awaiting_review") {
        const body = { command: definition.id, partition, fields: need };
        const recipients = new Set([
          author,
          ...Object.values(need).flatMap((allowed) => allowed.map((role) => `role:${role}`)),
        ]);
        for (const recipient of recipients) {
          await tx.notifier.tell({
            recipient,
            commandId: record.id,
            kind: "review_asked",
            body,
            createdAt: now,
          });
        }
      }
      return { id: record.id, state, partition };
    });
  }

  /**
   * Settles the heads of `partition` one transaction each, until its line is empty or its head
   * awaits a review. Throws when the store fails: the head then stays where it was.
   */
  async process(partition: string): Promise<Drained> {
    const outcomes: Outcome[] = [];
    for (;;) {
      const step = await this.#store.partition(partition, (tx) => this.#step(tx, partition));
      if ("done" in step) return { partition, outcomes, waitingOn: step.waitingOn };
      outcomes.push(step);
    }
  }

  /** Processes every partition with a command in line: what a periodic worker runs. */
  async processAll(): Promise<readonly Drained[]> {
    const drained: Drained[] = [];
    for (const partition of await this.#store.waiting())
      drained.push(await this.process(partition));
    return drained;
  }

  /**
   * The author's answer to an overwrite: `true` queues the command again at the end of its line,
   * declaring the values they were shown; `false` cancels it. Throws `not_now` unless the command
   * awaits confirmation. The caller checks that whoever answers is the author.
   */
  async confirm(id: string, overwrite: boolean): Promise<CommandRecord> {
    return this.#locked(id, async (tx, record) => {
      const event: CommandEvent = overwrite ? "confirm" : "decline";
      await this.#move(tx, record, event, {
        reason: overwrite ? null : "declined by its author",
        declared: overwrite ? { ...record.declared, ...record.conflict } : record.declared,
        requeue: overwrite,
      });
    });
  }

  /**
   * A reviewer's decision on a command awaiting review: approved, it waits in its place again;
   * refused, it is rejected. Throws `forbidden` unless `reviewerRoles` may review every critical
   * field it touches, and `not_now` unless it awaits a review.
   */
  async review(
    id: string,
    approve: boolean,
    reviewerRoles: readonly string[],
  ): Promise<CommandRecord> {
    return this.#locked(id, async (tx, record) => {
      if (record.state !== "awaiting_review") {
        throw new DataGuardError("not_now", `${id} is ${record.state}, not awaiting a review`);
      }
      const need = reviewNeeded(this.#definition(record.command), record.roles);
      if (!mayReview(need, reviewerRoles)) {
        throw new DataGuardError("forbidden", `these roles may not review ${id}`);
      }
      if (approve) {
        await this.#move(tx, record, "approve", {});
      } else {
        await this.#reject(tx, record, "review refused", []);
      }
    });
  }

  /** A command as the queue keeps it, or null. */
  async status(id: string): Promise<CommandRecord | null> {
    return this.#store.command(id);
  }

  /** The messages sent to `recipient` (an author, or `role:<name>`), oldest first. */
  async messages(recipient: string): Promise<readonly Message[]> {
    return this.#store.messages(recipient);
  }

  #definition(id: string): Command {
    const definition = this.#commands.get(id);
    if (!definition) throw new DataGuardError("unknown_command", `no command ${id}`);
    return definition;
  }

  /** Runs `work` on command `id`, read again under its partition's lock; answers it after. */
  async #locked(
    id: string,
    work: (tx: PartitionTx, record: CommandRecord) => Promise<void>,
  ): Promise<CommandRecord> {
    const found = await this.#store.command(id);
    if (!found) throw new DataGuardError("not_found", `no command ${id}`);
    return this.#store.partition(found.partition, async (tx) => {
      const record = await tx.commands.get(id);
      if (!record) throw new DataGuardError("not_found", `no command ${id}`);
      await work(tx, record);
      return (await tx.commands.get(id)) ?? record;
    });
  }

  /** Judges the head of `partition`, inside its transaction. */
  async #step(tx: PartitionTx, partition: string): Promise<Step> {
    const head = await tx.commands.head(partition);
    if (!head) return { done: true, waitingOn: null };
    const definition = this.#commands.get(head.command);
    if (!definition) return this.#reject(tx, head, `unknown command ${head.command}`, []);
    if (head.state === "awaiting_review") {
      const waited = this.#clock.now().getTime() - head.updatedAt.getTime();
      if (waited < this.#reviewTtlMs) return { done: true, waitingOn: head.id };
      return this.#reject(tx, head, `review not decided within ${duration(this.#reviewTtlMs)}`, []);
    }
    const payload = definition.payload.safeParse(head.payload);
    if (!payload.success) {
      return this.#reject(tx, head, `payload no longer valid: ${payload.error.message}`, []);
    }
    const snapshot = await tx.aggregates.load(head.aggregate, head.target);
    const fate: Fate = decideHead({
      command: definition,
      payload: payload.data,
      declared: head.declared,
      snapshot,
    });
    if (fate.kind === "reject") {
      return this.#reject(
        tx,
        head,
        fate.reason,
        fate.violations.map((v) => v.id),
      );
    }
    if (fate.kind === "confirm") {
      await this.#move(tx, head, "stale", { conflict: fate.conflict });
      const fields: Record<string, unknown> = {};
      for (const [field, current] of Object.entries(fate.conflict)) {
        fields[field] = { declared: head.declared[field] ?? null, current };
      }
      await this.#tell(tx, head, "confirmation_asked", { fields });
      return { id: head.id, state: "awaiting_confirmation" };
    }
    let version: number;
    try {
      version = await tx.aggregates.apply(
        head.aggregate,
        head.target,
        fate.change,
        snapshot.version,
      );
    } catch (error) {
      if (error instanceof Refusal) return this.#reject(tx, head, messageOf(error), []);
      throw error;
    }
    if (version !== snapshot.version + 1) {
      throw new DataGuardError(
        "version_conflict",
        `${partition} wrote version ${version}, expected ${snapshot.version + 1}: a write bypassed the DataGuard`,
      );
    }
    await this.#move(tx, head, "apply", { version });
    await this.#tell(tx, head, "applied", { version, path: fate.path });
    return { id: head.id, state: "applied", path: fate.path, version };
  }

  async #reject(
    tx: PartitionTx,
    record: CommandRecord,
    reason: string,
    violations: readonly string[],
  ): Promise<Outcome> {
    await this.#move(tx, record, "reject", { reason });
    await this.#tell(tx, record, "rejected", { reason, violations });
    return { id: record.id, state: "rejected", reason };
  }

  async #move(
    tx: PartitionTx,
    record: CommandRecord,
    event: CommandEvent,
    change: Partial<Omit<CommandUpdate, "state" | "updatedAt">>,
  ): Promise<void> {
    const state = transition(record.state, event);
    if (state === null) {
      throw new DataGuardError("not_now", `${record.id} is ${record.state}: cannot ${event}`);
    }
    await tx.commands.update(record.id, {
      state,
      reason: change.reason ?? null,
      conflict: change.conflict ?? null,
      version: change.version ?? null,
      declared: change.declared ?? record.declared,
      updatedAt: this.#clock.now(),
      requeue: change.requeue ?? false,
    });
  }

  async #tell(
    tx: PartitionTx,
    record: CommandRecord,
    kind: Message["kind"],
    body: State,
  ): Promise<void> {
    await tx.notifier.tell({
      recipient: record.author,
      commandId: record.id,
      kind,
      body: { command: record.command, partition: record.partition, ...body },
      createdAt: this.#clock.now(),
    });
  }
}

/** A duration as a person reads it: hours when whole, seconds otherwise. */
function duration(ms: number): string {
  return ms % 3_600_000 === 0 ? `${ms / 3_600_000}h` : `${Math.ceil(ms / 1000)}s`;
}
