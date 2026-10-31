// The stores in memory: what the tests run on, and the products' mock and test kit.
// One process only: the partition lock is a promise chain, the transaction a staging area.
import type { State } from "./define.ts";
import type { Change, Snapshot } from "./engine/decide.ts";
import { isInLine } from "./engine/states.ts";
import { DataGuardError, Refusal } from "./errors.ts";
import type {
  Clock,
  CommandRecord,
  CommandUpdate,
  GuardStore,
  Message,
  NewMessage,
  PartitionTx,
} from "./ports.ts";

/** Lets a test refuse a write as a product's tables would: the reason, or null to accept it. */
export type MemoryRefusal = (aggregate: string, target: string, change: Change) => string | null;

/** What a memory store starts with. */
export interface MemoryOptions {
  /** Refuses some writes, as a product's own tables may. */
  readonly refuse?: MemoryRefusal;
}

/** The queue, the aggregates and the messages in memory, with the same guarantees in one process. */
export class MemoryStore implements GuardStore {
  readonly #commands = new Map<string, CommandRecord>();
  readonly #aggregates = new Map<string, Snapshot>();
  readonly #messages: Message[] = [];
  readonly #locks = new Map<string, Promise<void>>();
  readonly #refuse: MemoryRefusal;
  #seq = 0;
  #ids = 0;

  constructor(options: MemoryOptions = {}) {
    this.#refuse = options.refuse ?? (() => null);
  }

  /** Writes an aggregate instance as fixtures would, bypassing the guard: version 1. */
  seed(aggregate: string, target: string, state: State): void {
    this.#aggregates.set(`${aggregate}/${target}`, { version: 1, state: json(state) });
  }

  /** An aggregate instance as stored. */
  aggregate(aggregate: string, target: string): Snapshot {
    return this.#aggregates.get(`${aggregate}/${target}`) ?? { version: 0, state: null };
  }

  async partition<T>(partition: string, work: (tx: PartitionTx) => Promise<T>): Promise<T> {
    const previous = this.#locks.get(partition) ?? Promise.resolve();
    const { promise: released, resolve: release } = Promise.withResolvers<void>();
    const mine = previous.then(() => released);
    this.#locks.set(partition, mine);
    await previous;
    try {
      const staged = new Staged(this.#commands, this.#aggregates, this.#refuse, () => ++this.#seq);
      const result = await work(staged.tx(() => `c_${++this.#ids}`));
      for (const [id, record] of staged.commands) this.#commands.set(id, record);
      for (const [key, snapshot] of staged.aggregates) this.#aggregates.set(key, snapshot);
      for (const message of staged.messages) {
        this.#messages.push({ ...message, id: this.#messages.length + 1 });
      }
      return result;
    } finally {
      release();
      if (this.#locks.get(partition) === mine) this.#locks.delete(partition);
    }
  }

  async command(id: string): Promise<CommandRecord | null> {
    return this.#commands.get(id) ?? null;
  }

  async messages(recipient: string): Promise<readonly Message[]> {
    return this.#messages.filter((m) => m.recipient === recipient);
  }

  async waiting(): Promise<readonly string[]> {
    const first = new Map<string, number>();
    for (const c of this.#commands.values()) {
      if (isInLine(c.state))
        first.set(c.partition, Math.min(first.get(c.partition) ?? c.seq, c.seq));
    }
    return [...first].sort(([, a], [, b]) => a - b).map(([partition]) => partition);
  }
}

/** One transaction's writes, kept apart until it commits; reads see them first. */
class Staged {
  readonly commands = new Map<string, CommandRecord>();
  readonly aggregates = new Map<string, Snapshot>();
  readonly messages: NewMessage[] = [];
  readonly #committed: ReadonlyMap<string, CommandRecord>;
  readonly #stored: ReadonlyMap<string, Snapshot>;
  readonly #refuse: MemoryRefusal;
  readonly #nextSeq: () => number;

  constructor(
    committed: ReadonlyMap<string, CommandRecord>,
    stored: ReadonlyMap<string, Snapshot>,
    refuse: MemoryRefusal,
    nextSeq: () => number,
  ) {
    this.#committed = committed;
    this.#stored = stored;
    this.#refuse = refuse;
    this.#nextSeq = nextSeq;
  }

  tx(nextId: () => string): PartitionTx {
    const get = (id: string) => this.commands.get(id) ?? this.#committed.get(id) ?? null;
    const load = (key: string) =>
      this.aggregates.get(key) ?? this.#stored.get(key) ?? { version: 0, state: null };
    return {
      commands: {
        insert: async (command) => {
          const record: CommandRecord = {
            ...command,
            id: nextId(),
            seq: this.#nextSeq(),
            payload: json(command.payload),
            declared: json(command.declared),
            roles: [...command.roles],
            reason: null,
            conflict: null,
            version: null,
            updatedAt: command.createdAt,
          };
          this.commands.set(record.id, record);
          return record;
        },
        get: async (id) => get(id),
        head: async (partition) => {
          let head: CommandRecord | null = null;
          for (const id of new Set([...this.#committed.keys(), ...this.commands.keys()])) {
            const c = get(id);
            if (c?.partition !== partition || !isInLine(c.state)) continue;
            if (head === null || c.seq < head.seq) head = c;
          }
          return head;
        },
        update: async (id, update: CommandUpdate) => {
          const record = get(id);
          if (!record) throw new DataGuardError("not_found", `no command ${id}`);
          const { requeue, ...fields } = update;
          this.commands.set(id, {
            ...record,
            ...fields,
            declared: json(fields.declared),
            conflict: fields.conflict === null ? null : json(fields.conflict),
            seq: requeue ? this.#nextSeq() : record.seq,
          });
        },
      },
      aggregates: {
        load: async (aggregate, target) => load(`${aggregate}/${target}`),
        apply: async (aggregate, target, change, expectedVersion) => {
          const key = `${aggregate}/${target}`;
          const current = load(key);
          if (current.version !== expectedVersion) {
            throw new DataGuardError("version_conflict", `${key} is at ${current.version}`);
          }
          const refused = this.#refuse(aggregate, target, change);
          if (refused !== null) throw new Refusal(refused);
          const version = expectedVersion + 1;
          this.aggregates.set(key, { version, state: change.next && json(change.next) });
          return version;
        },
      },
      notifier: {
        tell: async (message) => {
          this.messages.push({ ...message, body: json(message.body) });
        },
      },
    };
  }
}

/** A clock that moves only when told: for tests of the review's deadline. */
export class ManualClock implements Clock {
  #now: number;

  constructor(start = Date.UTC(2026, 0, 1)) {
    this.#now = start;
  }

  now(): Date {
    return new Date(this.#now);
  }

  /** Moves the time forward. */
  advance(ms: number): void {
    this.#now += ms;
  }
}

/** A JSON round trip: what a database would keep of a value. */
function json<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
