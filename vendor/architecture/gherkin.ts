// A small Gherkin parser, the subset the product's rules use. Strict on purpose: a line it does
// not understand is an error at its file:line, never silently a description, so a misspelt
// keyword cannot drop a step from a rule.
import type { Feature, GherkinStep, Scenario } from "./contracts.ts";

/** Raised when a `.feature` file does not parse; the message starts with `file:line`. */
export class GherkinError extends Error {
  override name = "GherkinError";
  /** The file that failed. */
  readonly file: string;
  /** The 1-based line of the failure. */
  readonly line: number;
  constructor(file: string, line: number, message: string) {
    super(`${file}:${line}: ${message}`);
    this.file = file;
    this.line = line;
  }
}

type Keyword = GherkinStep["keyword"];

const STEP_LINE = /^(Given|When|Then|And|But|\*)(?:\s+(.*))?$/;

interface ExamplesDraft {
  tags: string[];
  header: string[] | null;
  rows: Array<{ cells: string[]; line: number }>;
}

interface BlockDraft {
  kind: "background" | "scenario" | "outline";
  name: string;
  tags: string[];
  line: number;
  steps: GherkinStep[];
  examples: ExamplesDraft[];
}

type KeywordLine =
  | { kind: "feature" | "background" | "scenario" | "outline" | "examples"; rest: string }
  | { kind: "rule"; rest: string };

const KEYWORDS: Array<[string, KeywordLine["kind"]]> = [
  ["Feature:", "feature"],
  ["Background:", "background"],
  ["Scenario Outline:", "outline"],
  ["Scenario Template:", "outline"],
  ["Scenario:", "scenario"],
  ["Example:", "scenario"],
  ["Examples:", "examples"],
  ["Scenarios:", "examples"],
  ["Rule:", "rule"],
];

function keywordLine(trimmed: string): KeywordLine | null {
  for (const [prefix, kind] of KEYWORDS) {
    if (trimmed.startsWith(prefix)) return { kind, rest: trimmed.slice(prefix.length).trim() };
  }
  return null;
}

function primary(word: string): Keyword | null {
  return word === "Given" || word === "When" || word === "Then" ? word : null;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/** The cells of a table row (`| a | b |`), escapes kept; null when the row is malformed. */
function tableCells(trimmed: string): string[] | null {
  const cells: string[] = [];
  let cell = "";
  for (let i = 1; i < trimmed.length; i++) {
    const c = trimmed.charAt(i);
    if (c === "\\" && i + 1 < trimmed.length) {
      cell += c + trimmed.charAt(i + 1);
      i++;
    } else if (c === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += c;
    }
  }
  if (cell.trim() !== "" || cells.length === 0) return null;
  return cells;
}

function tableRow(cells: readonly string[]): string {
  return `| ${cells.join(" | ")} |`;
}

function isCanonicalRow(line: string): boolean {
  if (!line.startsWith("|")) return false;
  const cells = tableCells(line);
  return cells !== null && tableRow(cells) === line;
}

function stripIndent(line: string, indent: number): string {
  let n = 0;
  while (n < indent && n < line.length && (line.charAt(n) === " " || line.charAt(n) === "\t")) n++;
  return line.slice(n);
}

function escapedDelimiter(delimiter: string): string {
  return delimiter
    .split("")
    .map((c) => `\\${c}`)
    .join("");
}

/** Parses one `.feature` file; an outline expands into one scenario per example row. */
export function parseFeature(file: string, text: string): Feature {
  // A lone CR ends a line too (classic Mac files): read as one line, a file would drop every rule.
  const lines = text.split(/\r\n|\r|\n/);
  const error = (line: number, message: string) => new GherkinError(file, line, message);

  let feature: { name: string; tags: string[] } | null = null;
  const description: string[] = [];
  let describing = false;
  let background: GherkinStep[] | null = null;
  const scenarios: Scenario[] = [];
  let pending: string[] = [];
  let pendingLine = 0;
  let block: BlockDraft | null = null;
  let examples: ExamplesDraft | null = null;
  // The last step, while a doc string or a table may still attach to it.
  let open: { step: GherkinStep; arg: "none" | "table" | "doc" } | null = null;
  let previous: Keyword | null = null;

  const takeTags = (): string[] => {
    const tags = unique(pending);
    pending = [];
    pendingLine = 0;
    return tags;
  };
  const noPendingTags = () => {
    if (pending.length > 0) {
      throw error(pendingLine, "tags precede a Feature, a Scenario or Examples");
    }
  };
  const close = () => {
    if (block !== null) {
      if (block.kind === "background") background = block.steps;
      else if (block.kind === "scenario") {
        scenarios.push({
          name: block.name,
          tags: block.tags,
          steps: block.steps,
          line: block.line,
        });
      } else scenarios.push(...expand(block, error));
    }
    block = null;
    examples = null;
    open = null;
    previous = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i] ?? "";
    const trimmed = raw.trim();

    if (trimmed.startsWith('"""') || trimmed.startsWith("```")) {
      noPendingTags();
      const delimiter = trimmed.slice(0, 3);
      if (open === null || open.arg !== "none") throw error(lineNo, "a doc string follows a step");
      const indent = raw.length - raw.trimStart().length;
      const content: string[] = [];
      let closed = false;
      for (i++; i < lines.length; i++) {
        const line = lines[i] ?? "";
        if (line.trim() === delimiter) {
          closed = true;
          break;
        }
        content.push(stripIndent(line, indent).split(escapedDelimiter(delimiter)).join(delimiter));
      }
      if (!closed) throw error(lineNo, "unterminated doc string");
      open.step.text += `\n${content.join("\n")}`;
      open.arg = "doc";
      continue;
    }
    if (trimmed === "") {
      if (describing) description.push("");
      continue;
    }
    if (trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("|")) {
      noPendingTags();
      const cells = tableCells(trimmed);
      if (cells === null) throw error(lineNo, "a table row starts and ends with |");
      if (examples !== null) {
        if (examples.header === null) {
          if (new Set(cells).size !== cells.length) throw error(lineNo, "duplicate column");
          examples.header = cells;
        } else if (cells.length !== examples.header.length) {
          throw error(lineNo, `${cells.length} cells, the header has ${examples.header.length}`);
        } else {
          examples.rows.push({ cells, line: lineNo });
        }
        continue;
      }
      if (open === null || open.arg === "doc") throw error(lineNo, "a table follows a step");
      open.step.text += `\n${tableRow(cells)}`;
      open.arg = "table";
      continue;
    }

    if (trimmed.startsWith("@")) {
      for (const token of trimmed.split(/\s+/)) {
        if (token.startsWith("#")) break;
        if (!/^@\S+$/.test(token)) throw error(lineNo, `not a tag: ${token}`);
        pending.push(token);
      }
      if (pendingLine === 0) pendingLine = lineNo;
      describing = false;
      continue;
    }

    const keyword = keywordLine(trimmed);
    if (keyword !== null) {
      describing = false;
      if (keyword.kind === "rule") throw error(lineNo, "Rule: blocks are not supported, use tags");
      if (keyword.kind === "feature") {
        if (feature !== null) throw error(lineNo, "a second Feature");
        feature = { name: keyword.rest, tags: takeTags() };
        describing = true;
        continue;
      }
      if (feature === null) throw error(lineNo, "expected Feature: first");
      if (keyword.kind === "background") {
        noPendingTags();
        if (background !== null || scenarios.length > 0 || block !== null) {
          throw error(lineNo, "one Background, before every scenario");
        }
        block = { kind: "background", name: "", tags: [], line: lineNo, steps: [], examples: [] };
        continue;
      }
      if (keyword.kind === "examples") {
        if (block === null || block.kind !== "outline") {
          throw error(lineNo, "Examples belong to a Scenario Outline");
        }
        examples = { tags: takeTags(), header: null, rows: [] };
        block.examples.push(examples);
        open = null;
        continue;
      }
      close();
      block = {
        kind: keyword.kind,
        name: keyword.rest,
        tags: takeTags(),
        line: lineNo,
        steps: [],
        examples: [],
      };
      continue;
    }

    const step = STEP_LINE.exec(trimmed);
    if (step !== null) {
      noPendingTags();
      if (block === null) throw error(lineNo, "a step belongs to a Background or a Scenario");
      if (examples !== null) throw error(lineNo, "a step after Examples");
      const word = step[1] ?? "";
      const body = (step[2] ?? "").trim();
      if (body === "") throw error(lineNo, `${word} needs text`);
      const keyword: Keyword = primary(word) ?? previous ?? "Given";
      const parsed: GherkinStep = { keyword, raw: word, text: body, line: lineNo };
      block.steps.push(parsed);
      open = { step: parsed, arg: "none" };
      previous = keyword;
      continue;
    }

    if (feature === null) throw error(lineNo, "expected Feature: first");
    if (describing) {
      description.push(trimmed);
      continue;
    }
    throw error(lineNo, `unexpected line: ${trimmed}`);
  }

  noPendingTags();
  close();
  if (feature === null) throw error(1, "no Feature:");
  while (description[0] === "") description.shift();
  while (description[description.length - 1] === "") description.pop();
  const parsed: { name: string; tags: string[] } = feature;
  return {
    file,
    name: parsed.name,
    description: description.join("\n"),
    tags: parsed.tags,
    background: background ?? [],
    scenarios,
  };
}

/** A table cell as a value: Gherkin reads `\|` as a pipe and `\\` as a backslash. */
function cellValue(cell: string): string {
  return cell.replace(/\\([|\\])/g, "$1");
}

function expand(
  outline: BlockDraft,
  error: (line: number, message: string) => GherkinError,
): Scenario[] {
  if (outline.examples.length === 0) throw error(outline.line, "a Scenario Outline needs Examples");
  const out: Scenario[] = [];
  let n = 0;
  for (const examples of outline.examples) {
    const header = examples.header ?? [];
    for (const row of examples.rows) {
      n++;
      const values = new Map(header.map((h, i) => [h, cellValue(row.cells[i] ?? "")]));
      const fill = (s: string) => s.replace(/<([^<>\n]+)>/g, (m, k: string) => values.get(k) ?? m);
      out.push({
        name: `${fill(outline.name)} (row ${n})`.trim(),
        tags: unique([...outline.tags, ...examples.tags]),
        steps: outline.steps.map((s) => ({ ...s, text: fill(s.text) })),
        line: row.line,
      });
    }
  }
  return out;
}

// ------------------------------------------------------------------ rendering

function titled(keyword: string, name: string): string {
  return name === "" ? keyword : `${keyword} ${name}`;
}

function stepWord(step: GherkinStep, previous: Keyword | null): string {
  const continues = previous === step.keyword || (previous === null && step.keyword === "Given");
  if ((step.raw === "And" || step.raw === "But" || step.raw === "*") && continues) return step.raw;
  return step.keyword;
}

function docDelimiter(content: string): string {
  if (!content.includes('"""') && !content.includes(escapedDelimiter('"""'))) return '"""';
  if (!content.includes("```") && !content.includes(escapedDelimiter("```"))) return "```";
  return '"""';
}

function stepLines(steps: readonly GherkinStep[], indent: string): string[] {
  const out: string[] = [];
  let previous: Keyword | null = null;
  for (const step of steps) {
    const [first = "", ...rest] = step.text.split("\n");
    out.push(`${indent}${stepWord(step, previous)} ${first}`);
    previous = step.keyword;
    if (rest.length === 0) continue;
    if (rest.every(isCanonicalRow)) {
      for (const row of rest) out.push(`${indent}  ${row}`);
      continue;
    }
    const delimiter = docDelimiter(rest.join("\n"));
    out.push(`${indent}  ${delimiter}`);
    for (const line of rest) {
      const escaped = line.split(delimiter).join(escapedDelimiter(delimiter));
      out.push(escaped === "" ? "" : `${indent}  ${escaped}`);
    }
    out.push(`${indent}  ${delimiter}`);
  }
  return out;
}

function scenarioLines(scenario: Scenario, indent: string): string[] {
  const out: string[] = [];
  if (scenario.tags.length > 0) out.push(`${indent}${scenario.tags.join(" ")}`);
  out.push(`${indent}${titled("Scenario:", scenario.name)}`);
  out.push(...stepLines(scenario.steps, `${indent}  `));
  return out;
}

/** Renders one scenario (tags, title, steps) at an indentation, for contexts and diffs. */
export function renderScenario(scenario: Scenario, indent = ""): string {
  return scenarioLines(scenario, indent).join("\n");
}

/** Renders a feature back to Gherkin: `parseFeature(f.file, renderFeature(f))` equals `f`. */
export function renderFeature(feature: Feature): string {
  const out: string[] = [];
  if (feature.tags.length > 0) out.push(feature.tags.join(" "));
  out.push(titled("Feature:", feature.name));
  if (feature.description !== "") {
    for (const line of feature.description.split("\n")) out.push(line === "" ? "" : `  ${line}`);
  }
  if (feature.background.length > 0) {
    out.push("", "  Background:", ...stepLines(feature.background, "    "));
  }
  for (const scenario of feature.scenarios) out.push("", ...scenarioLines(scenario, "  "));
  return `${out.join("\n")}\n`;
}
