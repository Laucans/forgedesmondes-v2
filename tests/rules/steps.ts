// Plays one step of the rules' vocabulary on the real app in a browser, as the mock player plays
// it on the mock-up: a page is a route, an element is its `data-el`, a data step goes through the
// server's rules endpoints, a refusal is the last command the app sent.

import type { Locator, Page } from "playwright";
import type { GherkinStep, StepAction } from "#architecture";

/** A step as played. */
export interface StepResult {
  passed: boolean;
  detail: string;
}

/** One scenario's state: the browser page, the app's address, the role, whether a page is open. */
export interface Scenario {
  page: Page;
  base: string;
  role: string;
  opened: boolean;
}

/** How long an expectation may take to come true, in ms. */
export const EXPECT_MS = 4000;

const ok = (detail: string): StepResult => ({ passed: true, detail });
const ko = (detail: string): StepResult => ({ passed: false, detail });

const byEl = (page: Page, el: string): Locator => page.locator(`[data-el=${JSON.stringify(el)}]`);

/** Waits until the app answered every request it sent, twice in a row. */
export async function settle(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () => {
        const app = (window as unknown as { __app?: { busy: number; ready: boolean } }).__app;
        return app?.ready && app.busy === 0;
      },
      undefined,
      { timeout: 8000, polling: 25 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(40);
  await page
    .waitForFunction(
      () => (window as unknown as { __app?: { busy: number } }).__app?.busy === 0,
      undefined,
      { timeout: 8000, polling: 25 },
    )
    .catch(() => undefined);
}

/** Polls `probe` until it holds or `ms` ran out. */
async function eventually(probe: () => Promise<boolean>, ms = EXPECT_MS): Promise<boolean> {
  const end = Date.now() + ms;
  for (;;) {
    if (await probe()) return true;
    if (Date.now() > end) return false;
    await new Promise((r) => setTimeout(r, 50));
  }
}

async function visible(page: Page, el: string): Promise<Locator | null> {
  const all = byEl(page, el);
  const n = await all.count();
  for (let i = 0; i < n; i++) {
    const one = all.nth(i);
    if (await one.isVisible()) return one;
  }
  return null;
}

/** The first visible element `el`, waited for. */
async function waitVisible(page: Page, el: string): Promise<Locator | null> {
  let found: Locator | null = null;
  await eventually(async () => {
    found = await visible(page, el);
    return found !== null;
  });
  return found;
}

async function open(s: Scenario, target: string): Promise<void> {
  const query = new URLSearchParams({ as: s.role }).toString();
  await s.page.goto(`${s.base}/${encodeURIComponent(target)}?${query}`);
  s.opened = true;
  await settle(s.page);
}

async function inputOf(el: Locator): Promise<Locator> {
  const tag = await el.evaluate((n) => n.tagName);
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return el;
  return el.locator("input, textarea, select").first();
}

async function post(base: string, path: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as Record<string, unknown>;
}

/** Plays one step. */
export async function playStep(
  s: Scenario,
  step: GherkinStep,
  action: StepAction,
): Promise<StepResult> {
  const { page } = s;
  switch (action.kind) {
    case "as-role": {
      s.role = action.role;
      if (s.opened) {
        await page.evaluate((role) => localStorage.setItem("app.role", role), action.role);
        await page.reload();
        await settle(page);
      }
      return ok(`role ${action.role}`);
    }
    case "open": {
      await open(s, action.page);
      return ok(`opened /${action.page}`);
    }
    case "see-page": {
      const held = await eventually(
        async () => (await page.evaluate(() => document.body.dataset.page)) === action.page,
      );
      const at = await page.evaluate(() => document.body.dataset.page ?? "?");
      return held ? ok(`page ${action.page}`) : ko(`on page ${at}`);
    }
    case "click": {
      const el = await waitVisible(page, action.el);
      if (!el) return ko(`element ${action.el} is not on the page`);
      await el.click();
      await settle(page);
      return ok("clicked");
    }
    case "fill": {
      const el = await waitVisible(page, action.el);
      if (!el) return ko(`field ${action.el} is not on the page`);
      await (await inputOf(el)).fill(action.value);
      return ok(`"${action.value}" typed`);
    }
    case "select": {
      const list = await waitVisible(page, action.el);
      if (!list) return ko(`list ${action.el} is not on the page`);
      const tag = await list.evaluate((n) => n.tagName);
      if (tag === "SELECT") {
        await list
          .selectOption({ label: action.value })
          .catch(() => list.selectOption(action.value));
        await settle(page);
        return ok(`"${action.value}" chosen`);
      }
      const wanted = action.value.trim().toLowerCase();
      const rows = list.locator("[data-row-id]");
      let at = -1;
      await eventually(async () => {
        const texts = (await rows.allTextContents()).map((t) => t.trim().toLowerCase());
        at = texts.indexOf(wanted);
        if (at < 0) at = texts.findIndex((t) => t.includes(wanted));
        return at >= 0;
      });
      if (at < 0) return ko(`no row "${action.value}" in ${action.el} (rows carry data-row-id)`);
      await rows.nth(at).click();
      await settle(page);
      return ok(`"${action.value}" selected`);
    }
    case "see": {
      const held = await eventually(async () => (await visible(page, action.el)) !== null);
      return held ? ok("visible") : ko(`element ${action.el} is not visible`);
    }
    case "not-see": {
      const held = await eventually(async () => (await visible(page, action.el)) === null, 1500);
      return held ? ok("absent") : ko(`element ${action.el} is visible`);
    }
    case "see-text": {
      const held = await eventually(async () =>
        // innerText, not textContent: a text hidden from the role must not count as seen.
        // biome-ignore lint/performance/useDomNodeTextContent: visibility matters here
        (await page.evaluate(() => document.body.innerText)).includes(action.text),
      );
      return held ? ok(`text "${action.text}" shown`) : ko(`text "${action.text}" not shown`);
    }
    case "data-exists":
    case "data-absent":
    case "data-has": {
      const answer = await post(s.base, "/test/data", { keyword: step.keyword, action });
      if (step.keyword === "Given" && s.opened) {
        await page.reload();
        await settle(page);
      }
      return { passed: answer.passed === true, detail: String(answer.detail ?? answer.error) };
    }
    case "refused": {
      const last = (await page.evaluate(
        () =>
          (window as unknown as { __app?: { lastOutcome: unknown } }).__app?.lastOutcome ?? null,
      )) as { action: string; state: string; reason: string | null } | null;
      if (!last) return ko("no command was sent");
      if (last.state !== "rejected" && last.state !== "cancelled")
        return ko(`the last command (${last.action}) was ${last.state}`);
      if (action.action !== undefined && last.action !== action.action)
        return ko(`${last.action} was refused, not ${action.action}`);
      if (action.reason !== undefined && !(last.reason ?? "").includes(action.reason))
        return ko(`refused because "${last.reason ?? ""}"`);
      return ok(`refused: ${last.reason ?? ""}`);
    }
    case "free":
      return ko("a step outside the vocabulary");
  }
}
