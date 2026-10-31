// The one step vocabulary: the review's mock player and the product's test runner read the same
// sentences. A step outside it is `free`, which a gate flags so no rule stays unplayable.
import type { Feature, StepAction } from "./contracts.ts";

// A double-quoted value; `\"` and `\\` are its only escapes, and it never spans lines.
const Q = String.raw`"((?:[^"\\\n]|\\.)*)"`;
const QUOTED = String.raw`"(?:[^"\\\n]|\\.)*"`;
// A field name: letters of any script (a French model has `prénom`), digits, `_`, `.`, `-`.
const FIELD = String.raw`[\p{L}_][\p{L}\p{N}_.-]*`;
const PAIRS = String.raw`${FIELD}\s+${QUOTED}(?:\s+and\s+${FIELD}\s+${QUOTED})*`;

const sentence = (body: string) => new RegExp(`^${body}$`, "iu");

const OPEN_ON = sentence(String.raw`I\s+am\s+on\s+${Q}`);
const OPEN = sentence(String.raw`I\s+open\s+${Q}`);
const AS_ROLE = sentence(String.raw`I\s+am\s+(?:an?\s+)?${Q}`);
const CLICK = sentence(String.raw`I\s+click\s+${Q}`);
const FILL = sentence(String.raw`I\s+fill\s+${Q}\s+with\s+${Q}`);
const SELECT = sentence(String.raw`I\s+select\s+${Q}\s+in\s+${Q}`);
const SEE_PAGE = sentence(String.raw`I\s+see\s+the\s+page\s+${Q}`);
const SEE_TEXT = sentence(String.raw`I\s+see\s+the\s+text\s+${Q}`);
const SEE = sentence(String.raw`I\s+see\s+${Q}`);
const NOT_SEE = sentence(String.raw`I\s+do\s+not\s+see\s+${Q}`);
const DATA_ABSENT = sentence(String.raw`there\s+is\s+no\s+${Q}(?:\s+with\s+(${PAIRS}))?`);
const DATA_EXISTS = sentence(String.raw`there\s+is\s+(?:an?\s+)?${Q}(?:\s+with\s+(${PAIRS}))?`);
const DATA_HAS = sentence(String.raw`the\s+${Q}(?:\s+with\s+(${PAIRS}))?\s+has\s+(${PAIRS})`);
const REFUSED = sentence(
  String.raw`the\s+command(?:\s+${Q})?\s+is\s+refused(?:\s+because\s+${Q})?`,
);
const PAIR = new RegExp(String.raw`(?:^|\s+and\s+)(${FIELD})\s+${Q}`, "giuy");

function unquote(value: string): string {
  return value.replace(/\\(["\\])/g, "$1");
}

function quote(value: string): string {
  return `"${value.replace(/[\\"]/g, "\\$&")}"`;
}

function one(re: RegExp, text: string): string | null {
  const m = re.exec(text);
  return m === null ? null : unquote(m[1] ?? "");
}

function two(re: RegExp, text: string): [string, string] | null {
  const m = re.exec(text);
  return m === null ? null : [unquote(m[1] ?? ""), unquote(m[2] ?? "")];
}

// "a user", "an admin": a leading u mostly sounds like "you".
function article(word: string): string {
  return /^[aeio]/i.test(word) ? "an" : "a";
}

/** The `field "value"` pairs of a clause; null when a field repeats, which is ambiguous. */
function pairs(clause: string | undefined): Record<string, string> | null {
  if (clause === undefined) return {};
  const entries: Array<[string, string]> = [];
  PAIR.lastIndex = 0;
  for (const m of clause.matchAll(PAIR)) entries.push([m[1] ?? "", unquote(m[2] ?? "")]);
  if (new Set(entries.map(([k]) => k)).size !== entries.length) return null;
  return Object.fromEntries(entries);
}

function renderPairs(record: Record<string, string>): string {
  return Object.entries(record)
    .map(([k, v]) => `${k} ${quote(v)}`)
    .join(" and ");
}

function withClause(record: Record<string, string>): string {
  return Object.keys(record).length === 0 ? "" : ` with ${renderPairs(record)}`;
}

/** Reads a step's text as an action of the vocabulary; anything else is `free`. */
export function parseStep(text: string): StepAction {
  const t = text.trim();
  const free: StepAction = { kind: "free", text: t };
  if (t.includes("\n")) return free;
  const opened = one(OPEN_ON, t) ?? one(OPEN, t);
  if (opened !== null) return { kind: "open", page: opened };
  const role = one(AS_ROLE, t);
  if (role !== null) return { kind: "as-role", role };
  const clicked = one(CLICK, t);
  if (clicked !== null) return { kind: "click", el: clicked };
  const filled = two(FILL, t);
  if (filled !== null) return { kind: "fill", el: filled[0], value: filled[1] };
  const selected = two(SELECT, t);
  if (selected !== null) return { kind: "select", el: selected[1], value: selected[0] };
  const page = one(SEE_PAGE, t);
  if (page !== null) return { kind: "see-page", page };
  const seenText = one(SEE_TEXT, t);
  if (seenText !== null) return { kind: "see-text", text: seenText };
  const seen = one(SEE, t);
  if (seen !== null) return { kind: "see", el: seen };
  const unseen = one(NOT_SEE, t);
  if (unseen !== null) return { kind: "not-see", el: unseen };

  for (const [re, kind] of [
    [DATA_ABSENT, "data-absent"],
    [DATA_EXISTS, "data-exists"],
  ] as const) {
    const m = re.exec(t);
    if (m === null) continue;
    const where = pairs(m[2]);
    return where === null ? free : { kind, entity: unquote(m[1] ?? ""), where };
  }
  const has = DATA_HAS.exec(t);
  if (has !== null) {
    const where = pairs(has[2]);
    const set = pairs(has[3]);
    if (where === null || set === null) return free;
    return { kind: "data-has", entity: unquote(has[1] ?? ""), where, set };
  }
  const refused = REFUSED.exec(t);
  if (refused !== null) {
    const action: StepAction = { kind: "refused" };
    if (refused[1] !== undefined) action.action = unquote(refused[1]);
    if (refused[2] !== undefined) action.reason = unquote(refused[2]);
    return action;
  }
  return free;
}

/**
 * Writes an action as the vocabulary's sentence: `parseStep(renderStep(a))` equals `a` for every
 * kind but `free`, given field names of letters, digits, `_.-` (not first) and a `data-has` that
 * sets something.
 */
export function renderStep(action: StepAction): string {
  switch (action.kind) {
    case "as-role":
      return `I am ${article(action.role)} ${quote(action.role)}`;
    case "open":
      return `I am on ${quote(action.page)}`;
    case "click":
      return `I click ${quote(action.el)}`;
    case "fill":
      return `I fill ${quote(action.el)} with ${quote(action.value)}`;
    case "select":
      return `I select ${quote(action.value)} in ${quote(action.el)}`;
    case "see-page":
      return `I see the page ${quote(action.page)}`;
    case "see":
      return `I see ${quote(action.el)}`;
    case "not-see":
      return `I do not see ${quote(action.el)}`;
    case "see-text":
      return `I see the text ${quote(action.text)}`;
    case "data-exists":
      return `there is ${article(action.entity)} ${quote(action.entity)}${withClause(action.where)}`;
    case "data-absent":
      return `there is no ${quote(action.entity)}${withClause(action.where)}`;
    case "data-has":
      return `the ${quote(action.entity)}${withClause(action.where)} has ${renderPairs(action.set)}`;
    case "refused": {
      const named = action.action === undefined ? "" : ` ${quote(action.action)}`;
      const because = action.reason === undefined ? "" : ` because ${quote(action.reason)}`;
      return `the command${named} is refused${because}`;
    }
    case "free":
      return action.text;
  }
}

/** The page a step opens or checks, if it names one. */
export function stepPage(action: StepAction): string | null {
  return action.kind === "open" || action.kind === "see-page" ? action.page : null;
}

/** The mock element a step targets, if it names one. */
export function stepElement(action: StepAction): string | null {
  switch (action.kind) {
    case "click":
    case "fill":
    case "select":
    case "see":
    case "not-see":
      return action.el;
    default:
      return null;
  }
}

/** True for a step played on a screen (as opposed to data, a role or a refused command). */
export function isUiStep(action: StepAction): boolean {
  return stepPage(action) !== null || stepElement(action) !== null || action.kind === "see-text";
}

/** A step outside the vocabulary, where it stands. */
export interface VocabularyProblem {
  file: string;
  line: number;
  text: string;
}

/** Every step outside the vocabulary (an outline's rows count once per distinct text). */
export function vocabularyProblems(features: readonly Feature[]): VocabularyProblem[] {
  const out: VocabularyProblem[] = [];
  for (const feature of features) {
    const seen = new Set<string>();
    const steps = [feature.background, ...feature.scenarios.map((s) => s.steps)].flat();
    for (const step of steps) {
      if (parseStep(step.text).kind !== "free") continue;
      const key = `${step.line}\u0000${step.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ file: feature.file, line: step.line, text: step.text });
    }
  }
  // Code-point order, not the locale's: the same list on every machine.
  return out.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
}
