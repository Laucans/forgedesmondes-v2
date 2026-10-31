/** Why the DataGuard refused a call: the caller's mistake, never a verdict on a command. */
export type DataGuardErrorCode =
  | "misconfigured"
  | "unknown_command"
  | "invalid_payload"
  | "not_found"
  | "not_now"
  | "forbidden"
  | "version_conflict";

/** Raised when a call cannot be served; a command's own fate is a state, never this error. */
export class DataGuardError extends Error {
  override name = "DataGuardError";
  /** What went wrong, for a server to map onto a status code. */
  readonly code: DataGuardErrorCode;

  constructor(code: DataGuardErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** Thrown by an aggregate store's `apply` to refuse a write: the head command is rejected with this reason. */
export class Refusal extends Error {
  override name = "Refusal";
}
