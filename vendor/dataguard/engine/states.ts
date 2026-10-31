/** Every state a queued command can be in. */
export const STATES = [
  "queued",
  "awaiting_confirmation",
  "awaiting_review",
  "applied",
  "rejected",
  "cancelled",
] as const;

/** Where a command stands in its partition's queue. */
export type CommandState = (typeof STATES)[number];

/** Every event that moves a command. */
export const EVENTS = ["apply", "stale", "reject", "confirm", "decline", "approve"] as const;

/**
 * What happens to a command: `apply`, `stale` and `reject` are the head's verdicts; `confirm` and
 * `decline` its author's answer to an overwrite; `approve` a reviewer's (a refusal is `reject`).
 */
export type CommandEvent = (typeof EVENTS)[number];

const MOVES: Readonly<Record<CommandState, Partial<Record<CommandEvent, CommandState>>>> = {
  queued: { apply: "applied", stale: "awaiting_confirmation", reject: "rejected" },
  // Set aside: it holds no place, and an overwrite confirmed queues it again at the end.
  awaiting_confirmation: { confirm: "queued", decline: "cancelled" },
  // Keeps its place: at the head it holds its partition until reviewed (or the review expires).
  awaiting_review: { approve: "queued", reject: "rejected" },
  applied: {},
  rejected: {},
  cancelled: {},
};

/** The state `event` moves `from` to, or null when the event cannot happen there. */
export function transition(from: CommandState, event: CommandEvent): CommandState | null {
  return MOVES[from][event] ?? null;
}

/** The state a command enters the queue in. */
export function admitted(needsReview: boolean): CommandState {
  return needsReview ? "awaiting_review" : "queued";
}

/** True for a state nothing moves out of. */
export function isFinal(state: CommandState): boolean {
  return EVENTS.every((event) => transition(state, event) === null);
}

/** True for the states that wait in line: the head is the oldest of them. */
export function isInLine(state: CommandState): boolean {
  return state === "queued" || state === "awaiting_review";
}
