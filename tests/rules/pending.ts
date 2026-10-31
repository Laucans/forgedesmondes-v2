// Which units a rule needs, and whether they are built: a rule is `pending` while one of them has
// no code, so a milestone half built reads as half built, not as red.
import type { MockPages, Rule } from "#architecture";
import type { UnitFiles } from "../../app/server/product.ts";

/**
 * The units a rule needs: its `@unit` tags, the owner (`component`) of every element its steps
 * use, the data-capability of every action it clicks, and the capabilities those micro-uis call.
 */
export function unitsNeeded(
  rule: Rule,
  mock: MockPages | null,
  units: readonly UnitFiles[],
): string[] {
  const shell = units.find((u) => u.manifest.kind === "shell")?.manifest.id;
  const needed = new Set<string>(rule.units);
  const pages = mock?.pages ?? [];
  const ownPages = pages.filter((p) => rule.pages.includes(p.id));
  for (const el of rule.elements) {
    const found =
      ownPages.flatMap((p) => p.elements).find((e) => e.id === el) ??
      pages.flatMap((p) => p.elements).find((e) => e.id === el);
    if (!found) continue;
    if (found.component) needed.add(found.component === "shell" && shell ? shell : found.component);
    if (found.kind === "action" && found.action) needed.add(found.action);
  }
  for (const id of [...needed]) {
    const unit = units.find((u) => u.manifest.id === id);
    if (unit?.manifest.kind === "micro-ui") for (const cap of unit.manifest.needs) needed.add(cap);
  }
  return [...needed].sort();
}

/** Why a rule cannot run yet: the units it needs with no manifest or no code; empty when it can. */
export function pendingBecause(
  rule: Rule,
  mock: MockPages | null,
  units: readonly UnitFiles[],
): string[] {
  const out: string[] = [];
  for (const id of unitsNeeded(rule, mock, units)) {
    const unit = units.find((u) => u.manifest.id === id);
    if (!unit) out.push(`${id} has no manifest`);
    else if (!unit.built) out.push(`${id} is not built`);
  }
  return out;
}
