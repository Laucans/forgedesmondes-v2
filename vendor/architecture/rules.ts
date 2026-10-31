// Rules are derived from the `.feature` files, never stored apart: tags say what a scenario is,
// its steps say which pages and elements it plays on.
import { type Feature, type Rule, type RuleDeclared, UnitIdSchema } from "./contracts.ts";
import { isUiStep, parseStep, stepElement, stepPage } from "./vocabulary.ts";

/** A rule id tag: `@R12` written by people, `@G-…` generated from the mock-up, `@B-…` base pack. */
const ID_TAG = /^@(R[1-9][0-9]*|[GB]-[A-Za-z0-9][A-Za-z0-9._-]*)$/;
const VALUED = ["role", "page", "el", "component", "unit"] as const;
const FLAGS = new Set(["journey", "business", "conform", "contested", "generated", "base"]);
// An outline expands to one scenario per row; each row is its own rule, `R5.1`, `R5.2`…
const OUTLINE_ROW = /\(row (\d+)\)$/;

type Valued = (typeof VALUED)[number];

/** The rules a set of features declares, and every problem met on the way. */
export interface RuleSet {
  rules: Rule[];
  problems: string[];
}

function pushUnique(list: string[], value: string): void {
  if (!list.includes(value)) list.push(value);
}

/** Derives the rules of a set of features: tags (a feature's are inherited) plus steps. */
export function rulesOf(features: readonly Feature[]): RuleSet {
  const rules: Rule[] = [];
  const problems: string[] = [];
  const where = new Map<string, string>();

  for (const feature of features) {
    for (const scenario of feature.scenarios) {
      const at = `${feature.file}:${scenario.line}`;
      const problem = (message: string) => problems.push(`${at}: ${message}`);
      const ids: string[] = [];
      const flags = new Set<string>();
      const valued: Record<Valued, string[]> = {
        role: [],
        page: [],
        el: [],
        component: [],
        unit: [],
      };

      for (const tag of [...new Set([...feature.tags, ...scenario.tags])]) {
        const id = ID_TAG.exec(tag);
        if (id !== null) {
          ids.push(id[1] ?? "");
          continue;
        }
        const name = tag.slice(1);
        if (FLAGS.has(name)) {
          flags.add(name);
          continue;
        }
        const colon = name.indexOf(":");
        const prefix = VALUED.find((p) => p === name.slice(0, colon));
        const value = name.slice(colon + 1);
        if (colon < 0 || prefix === undefined) {
          problem(`unknown tag ${tag}`);
        } else if (value === "") {
          problem(`${tag} names nothing`);
        } else if (prefix === "unit" && !UnitIdSchema.safeParse(value).success) {
          problem(`${tag}: a unit is system.name`);
        } else {
          pushUnique(valued[prefix], value);
        }
      }

      const steps = [...feature.background, ...scenario.steps];
      const actions = steps.map((s) => parseStep(s.text));
      for (const action of actions) {
        if (action.kind === "as-role") pushUnique(valued.role, action.role);
        const page = stepPage(action);
        if (page !== null) pushUnique(valued.page, page);
        const el = stepElement(action);
        if (el !== null) pushUnique(valued.el, el);
      }

      if (flags.has("journey") && flags.has("business")) problem("both @journey and @business");
      if (flags.has("conform") && flags.has("contested")) problem("both @conform and @contested");
      if (ids.length > 1) problem(`several ids: ${ids.join(", ")}`);
      const base = ids[0];
      if (base === undefined) {
        problem(`scenario "${scenario.name}" has no @R<n> id`);
        continue;
      }
      const row = OUTLINE_ROW.exec(scenario.name);
      const id = row === null ? base : `${base}.${row[1]}`;
      const first = where.get(id);
      if (first !== undefined) {
        problem(`duplicate id ${id}, first at ${first}`);
        continue;
      }
      where.set(id, at);

      const family: Rule["family"] = flags.has("journey")
        ? "journey"
        : flags.has("business")
          ? "business"
          : actions.some(isUiStep)
            ? "journey"
            : "business";
      const declared: RuleDeclared = flags.has("contested")
        ? "contested"
        : flags.has("conform")
          ? "conform"
          : "active";
      rules.push({
        id,
        title: scenario.name,
        family,
        file: feature.file,
        // A rule plays alone, so the background's steps come first, as Gherkin runs them.
        scenario: { ...scenario, steps },
        roles: valued.role,
        pages: valued.page,
        elements: valued.el,
        components: valued.component,
        units: valued.unit,
        declared,
        generated: flags.has("generated"),
        base: flags.has("base"),
      });
    }
  }
  return { rules, problems };
}
