// The stores on PostgreSQL: a queue table, a message table, and the product's own aggregate tables
// reached through its adapters — all in one transaction per partition step, under an advisory lock.
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import type { Change, Snapshot } from "./engine/decide.ts";
import { STATES } from "./engine/states.ts";
import { DataGuardError, Refusal } from "./errors.ts";
import type {
  CommandRecord,
  CommandStore,
  GuardStore,
  Message,
  Notifier,
  PartitionTx,
} from "./ports.ts";

/** The DataGuard's own tables; additive, safe to run again. */
export const SCHEMA = `
CREATE SEQUENCE IF NOT EXISTS dg_seq;
CREATE TABLE IF NOT EXISTS dg_commands (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  seq         bigint NOT NULL UNIQUE,
  partition   text NOT NULL,
  aggregate   text NOT NULL,
  target      text NOT NULL,
  command     text NOT NULL,
  payload     jsonb NOT NULL,
  declared    jsonb NOT NULL,
  author      text NOT NULL,
  roles       jsonb NOT NULL,
  state       text NOT NULL CHECK (state IN (${STATES.map((s) => `'${s}'`).join(", ")})),
  reason      text,
  conflict    jsonb,
  version     integer,
  created_at  timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS dg_commands_in_line
  ON dg_commands (partition, seq) WHERE state IN ('queued', 'awaiting_review');
CREATE TABLE IF NOT EXISTS dg_messages (
  id          bigserial PRIMARY KEY,
  recipient   text NOT NULL,
  command_id  text NOT NULL REFERENCES dg_commands (id),
  kind        text NOT NULL,
  body        jsonb NOT NULL,
  created_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS dg_messages_recipient ON dg_messages (recipient, id);
`;

/** A product's aggregate in its own tables, reached inside the guard's transaction. */
export interface AggregateAdapter {
  /** The instance `id` as stored now: `{ version: 0, state: null }` when there is none. */
  load(client: PoolClient, id: string): Promise<Snapshot>;
  /**
   * Writes `change` on instance `id`, which must be at `expectedVersion` (0: no row yet), and
   * answers the version written, `expectedVersion + 1`. A removal keeps a tombstone at that
   * version (or deletes the row, when versions may restart). Throw `Refusal` to refuse the write:
   * whatever it wrote is rolled back and the command rejected.
   */
  apply(client: PoolClient, id: string, change: Change, expectedVersion: number): Promise<number>;
}

const LOCK_PREFIX = "dataguard:";

/** Creates the DataGuard's tables, once, even when several servers start together. */
export async function migrate(pool: Pool): Promise<void> {
  const client = await pool.connect();
  let broken = false;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      `${LOCK_PREFIX}migrate`,
    ]);
    await client.query(SCHEMA);
    await client.query("COMMIT");
  } catch (error) {
    broken = await rollback(client);
    throw error;
  } finally {
    client.release(broken);
  }
}

const Row = z.object({
  id: z.string(),
  seq: z.coerce.number().int(),
  partition: z.string(),
  aggregate: z.string(),
  target: z.string(),
  command: z.string(),
  payload: z.unknown(),
  declared: z.record(z.string(), z.unknown()),
  author: z.string(),
  roles: z.array(z.string()),
  state: z.enum(STATES),
  reason: z.string().nullable(),
  conflict: z.record(z.string(), z.unknown()).nullable(),
  version: z.number().int().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

const MessageRow = z.object({
  id: z.coerce.number().int(),
  recipient: z.string(),
  command_id: z.string(),
  kind: z.enum(["review_asked", "confirmation_asked", "applied", "rejected"]),
  body: z.record(z.string(), z.unknown()),
  created_at: z.date(),
});

function toRecord(row: unknown): CommandRecord {
  const { created_at, updated_at, ...rest } = Row.parse(row);
  return { ...rest, createdAt: created_at, updatedAt: updated_at };
}

/** A JSON parameter: jsonb columns are written from text, never from pg's array encoding. */
function jsonb(value: unknown): string {
  return JSON.stringify(value ?? null);
}

/** The DataGuard's store on PostgreSQL: the queue and messages in its tables, the aggregates in the product's. */
export class PostgresStore implements GuardStore {
  readonly #pool: Pool;
  readonly #adapters: Readonly<Record<string, AggregateAdapter>>;

  constructor(pool: Pool, adapters: Readonly<Record<string, AggregateAdapter>>) {
    this.#pool = pool;
    this.#adapters = adapters;
  }

  async partition<T>(partition: string, work: (tx: PartitionTx) => Promise<T>): Promise<T> {
    const client = await this.#pool.connect();
    let broken = false;
    try {
      await client.query("BEGIN");
      // Serializes every step of this partition, across processes: submissions take their place
      // in line, and the head is judged, one at a time; other partitions run in parallel.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
        `${LOCK_PREFIX}${partition}`,
      ]);
      const result = await work({
        commands: commands(client),
        aggregates: {
          load: (aggregate, target) => this.#adapter(aggregate).load(client, target),
          apply: (aggregate, target, change, expected) =>
            applying(client, this.#adapter(aggregate), target, change, expected),
        },
        notifier: notifier(client),
      });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      broken = await rollback(client);
      throw error;
    } finally {
      client.release(broken);
    }
  }

  async command(id: string): Promise<CommandRecord | null> {
    const { rows } = await this.#pool.query("SELECT * FROM dg_commands WHERE id = $1", [id]);
    return rows[0] === undefined ? null : toRecord(rows[0]);
  }

  async messages(recipient: string): Promise<readonly Message[]> {
    const { rows } = await this.#pool.query(
      "SELECT * FROM dg_messages WHERE recipient = $1 ORDER BY id",
      [recipient],
    );
    return rows.map((row) => {
      const m = MessageRow.parse(row);
      return {
        id: m.id,
        recipient: m.recipient,
        commandId: m.command_id,
        kind: m.kind,
        body: m.body,
        createdAt: m.created_at,
      };
    });
  }

  async waiting(): Promise<readonly string[]> {
    const { rows } = await this.#pool.query(
      `SELECT partition FROM dg_commands WHERE state IN ('queued', 'awaiting_review')
       GROUP BY partition ORDER BY min(seq)`,
    );
    return rows.map((row) => z.object({ partition: z.string() }).parse(row).partition);
  }

  #adapter(aggregate: string): AggregateAdapter {
    const adapter = this.#adapters[aggregate];
    if (!adapter)
      throw new DataGuardError("misconfigured", `no adapter for aggregate ${aggregate}`);
    return adapter;
  }
}

function commands(client: PoolClient): CommandStore {
  return {
    insert: async (c) => {
      const { rows } = await client.query(
        `INSERT INTO dg_commands (seq, partition, aggregate, target, command, payload, declared,
           author, roles, state, created_at, updated_at)
         VALUES (nextval('dg_seq'), $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8::jsonb, $9, $10, $10)
         RETURNING *`,
        [
          c.partition,
          c.aggregate,
          c.target,
          c.command,
          jsonb(c.payload),
          jsonb(c.declared),
          c.author,
          jsonb(c.roles),
          c.state,
          c.createdAt,
        ],
      );
      return toRecord(rows[0]);
    },
    get: async (id) => {
      const { rows } = await client.query("SELECT * FROM dg_commands WHERE id = $1", [id]);
      return rows[0] === undefined ? null : toRecord(rows[0]);
    },
    head: async (partition) => {
      const { rows } = await client.query(
        `SELECT * FROM dg_commands WHERE partition = $1 AND state IN ('queued', 'awaiting_review')
         ORDER BY seq LIMIT 1`,
        [partition],
      );
      return rows[0] === undefined ? null : toRecord(rows[0]);
    },
    update: async (id, u) => {
      const { rowCount } = await client.query(
        `UPDATE dg_commands SET state = $2, reason = $3, conflict = $4::jsonb, version = $5,
           declared = $6::jsonb, updated_at = $7,
           seq = CASE WHEN $8 THEN nextval('dg_seq') ELSE seq END
         WHERE id = $1`,
        [
          id,
          u.state,
          u.reason,
          u.conflict === null ? null : jsonb(u.conflict),
          u.version,
          jsonb(u.declared),
          u.updatedAt,
          u.requeue,
        ],
      );
      if (rowCount !== 1) throw new DataGuardError("not_found", `no command ${id}`);
    },
  };
}

function notifier(client: PoolClient): Notifier {
  return {
    tell: async (m) => {
      await client.query(
        `INSERT INTO dg_messages (recipient, command_id, kind, body, created_at)
         VALUES ($1, $2, $3, $4::jsonb, $5)`,
        [m.recipient, m.commandId, m.kind, jsonb(m.body), m.createdAt],
      );
    },
  };
}

/** Runs the adapter's write under a savepoint: a refusal undoes it and leaves the transaction usable. */
async function applying(
  client: PoolClient,
  adapter: AggregateAdapter,
  target: string,
  change: Change,
  expected: number,
): Promise<number> {
  await client.query("SAVEPOINT dg_apply");
  try {
    const version = await adapter.apply(client, target, change, expected);
    await client.query("RELEASE SAVEPOINT dg_apply");
    return version;
  } catch (error) {
    if (error instanceof Refusal) await client.query("ROLLBACK TO SAVEPOINT dg_apply");
    throw error;
  }
}

/** Rolls back; answers true when the connection is unusable and must not go back to the pool. */
async function rollback(client: PoolClient): Promise<boolean> {
  try {
    await client.query("ROLLBACK");
    return false;
  } catch {
    return true;
  }
}
