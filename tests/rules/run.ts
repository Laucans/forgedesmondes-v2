// The rules suite: plays every rule of rules/*.feature on the real app (the server started on a
// scratch port with the fixtures, a headless Chromium) and writes .harness/rule-results.json,
// `{ "R1": "holds" | "red" | "pending" }`, which the harness's landing gate reads. A rule is
// pending while a unit it needs has no code. `npm run rules [-- R1 R2]`. Owned by the harness.
import { type ChildProcess, spawn } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { type Feature, parseFeature, parseStep, type Rule, rulesOf } from "#architecture";
import { readProductFiles } from "../../app/server/product.ts";
import { pendingBecause } from "./pending.ts";
import { playStep, type Scenario, type StepResult } from "./steps.ts";

type Verdict = "holds" | "red" | "pending";

/** A rule as played, for the report. */
interface Played {
  id: string;
  title: string;
  verdict: Verdict;
  why: string[];
  steps: Array<StepResult & { text: string }>;
}

const root = resolve(import.meta.dirname, "../..");

async function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const probe = createServer();
    probe.once("error", fail);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => done(port));
    });
  });
}

async function features(): Promise<Feature[]> {
  let names: string[] = [];
  try {
    names = (await readdir(join(root, "rules"))).filter((n) => n.endsWith(".feature")).sort();
  } catch {
    names = [];
  }
  return Promise.all(
    names.map(async (n) =>
      parseFeature(`rules/${n}`, await readFile(join(root, "rules", n), "utf8")),
    ),
  );
}

/** Starts the app with the rules' endpoints; resolves once /health answers. */
async function startApp(port: number): Promise<ChildProcess> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(port),
    HOST: "127.0.0.1",
    APP_TEST: "1",
  };
  delete env.DATABASE_URL;
  const child = spawn(process.execPath, [join(root, "app/server/main.ts")], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout?.on("data", (d: Buffer) => {
    output += d.toString();
  });
  child.stderr?.on("data", (d: Buffer) => {
    output += d.toString();
  });
  const end = Date.now() + 30_000;
  while (Date.now() < end) {
    if (child.exitCode !== null) throw new Error(`the app stopped at start:\n${output}`);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) {
        const problems = output.split("\n").filter((l) => l.startsWith("problem:"));
        for (const p of problems) console.error(p);
        return child;
      }
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error(`the app did not answer /health in 30 s:\n${output}`);
}

async function main(): Promise<number> {
  const only = new Set(process.argv.slice(2).filter((a) => !a.startsWith("-")));
  const product = await readProductFiles(root);
  const set = rulesOf(await features());
  for (const p of set.problems) console.error(`rules: ${p}`);
  const rules = set.rules.filter((r) => only.size === 0 || only.has(r.id));
  const defaultRole = product.surfaces?.roles[0]?.id ?? "user";

  const played: Played[] = [];
  const runnable: Rule[] = [];
  for (const rule of rules) {
    const why = pendingBecause(rule, product.mock, product.units);
    if (why.length > 0)
      played.push({ id: rule.id, title: rule.title, verdict: "pending", why, steps: [] });
    else runnable.push(rule);
  }

  if (runnable.length > 0) {
    const port = await freePort();
    const base = `http://127.0.0.1:${port}`;
    const app = await startApp(port);
    let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
    try {
      browser = await chromium.launch();
      for (const rule of runnable) {
        await fetch(`${base}/test/reset`, { method: "POST" });
        const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        const s: Scenario = { page, base, role: defaultRole, opened: false };
        const steps: Played["steps"] = [];
        let verdict: Verdict = "holds";
        for (const step of rule.scenario.steps) {
          let result: StepResult;
          try {
            result = await playStep(s, step, parseStep(step.text));
          } catch (e) {
            result = {
              passed: false,
              detail: e instanceof Error ? (e.message.split("\n")[0] ?? "") : String(e),
            };
          }
          steps.push({ ...result, text: `${step.keyword} ${step.text}` });
          if (!result.passed) {
            verdict = "red";
            break;
          }
        }
        const why =
          errors.length > 0 && verdict === "red" ? errors.map((e) => `page error: ${e}`) : [];
        played.push({ id: rule.id, title: rule.title, verdict, why, steps });
        await context.close();
      }
    } finally {
      await browser?.close();
      app.kill("SIGTERM");
    }
  }

  const results: Record<string, Verdict> = {};
  for (const p of played.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true })))
    results[p.id] = p.verdict;
  await mkdir(join(root, ".harness"), { recursive: true });
  await writeFile(
    join(root, ".harness/rule-results.json"),
    `${JSON.stringify(results, null, 2)}\n`,
  );
  await writeFile(join(root, ".harness/rule-report.json"), `${JSON.stringify(played, null, 2)}\n`);

  for (const p of played) {
    console.log(`${p.verdict.padEnd(7)} ${p.id}  ${p.title}`);
    for (const why of p.why) console.log(`          ${why}`);
    const failed = p.steps.find((s) => !s.passed);
    if (failed) console.log(`          ✗ ${failed.text}: ${failed.detail}`);
  }
  const count = (v: Verdict) => played.filter((p) => p.verdict === v).length;
  console.log(`\nrules: ${count("holds")} hold, ${count("red")} red, ${count("pending")} pending`);
  return count("red") > 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(2);
  },
);
