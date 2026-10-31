// The product's HTTP server: the wire protocol every unit is reached by, and the shell's assets.
//   GET  /health                   { ok, store, units, built, problems }
//   GET  /app/manifest             what the shell needs: pages, units, roles
//   POST /capabilities/<id>        { input } → { output }
//   POST /commands                 { command, payload, declared? } → the command's outcome
//   GET  /commands/<id>            its state;  POST /commands/<id>/confirm { overwrite }
//   GET  /messages                 the caller's messages
//   POST /test/reset, /test/data   the rules' set-up and data checks (APP_TEST=1, memory only)
// The caller's role and name come from the `x-app-role` / `x-app-user` headers: the product has
// no sign-in yet, so the role is trusted as given.
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { mayTrigger, type StepAction } from "#architecture";
import type { Capability, Row, UnitContext } from "#kit/units.ts";
import type { ProductFiles, UnitCode } from "./product.ts";
import { type MemoryTables, playDataStep, type Tables } from "./store.ts";
import type { Writes } from "./writes.ts";

/** What the server runs on. */
export interface AppOptions {
  product: ProductFiles;
  units: ReadonlyMap<string, UnitCode>;
  tables: Tables;
  writes: Writes;
  /** `memory` (fixtures) or `postgres`. */
  store: "memory" | "postgres";
  /** The rules' endpoints, memory only: reset to the fixtures, data steps. */
  test?: { tables: MemoryTables; reset(): void };
  /** Where the shell's bundle is (app/shell/dist). */
  assets: string;
}

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const TYPES: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".map": "application/json",
};

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 1_000_000) throw new HttpError(413, "body too large");
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return {};
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed))
      return parsed as Record<string, unknown>;
  } catch {
    // answered below
  }
  throw new HttpError(400, "the body is a JSON object");
}

/** The roles of surfaces.json, the first one being the default. */
function rolesOf(product: ProductFiles): string[] {
  return product.surfaces?.roles.map((r) => r.id) ?? [];
}

/** The shell's view of the product: pages with their elements, units and whether they are built. */
export function manifestOf(product: ProductFiles): unknown {
  return {
    home: product.mock?.home ?? null,
    pages:
      product.mock?.pages.map((p) => ({
        id: p.id,
        title: p.title,
        path: p.path,
        screen: p.screen ?? null,
        elements: p.elements,
      })) ?? [],
    units: product.units.map((u) => ({
      id: u.manifest.id,
      kind: u.manifest.kind,
      title: u.manifest.title,
      screens: u.manifest.screens,
      built: u.built,
    })),
    roles: rolesOf(product),
  };
}

/** Builds the server; `listen` is the caller's. */
export function createApp(options: AppOptions): Server {
  const { product, units } = options;
  const roles = rolesOf(product);

  const caller = (req: IncomingMessage) => {
    const header = (name: string) => {
      const v = req.headers[name];
      return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
    };
    const role = header("x-app-role") ?? roles[0] ?? "user";
    return { role, user: header("x-app-user") ?? role };
  };

  const capability = async (id: string, req: IncomingMessage, res: ServerResponse) => {
    const unit = units.get(id);
    if (unit?.files.manifest.kind !== "capability") throw new HttpError(404, `no capability ${id}`);
    if (unit.error) throw new HttpError(500, unit.error);
    if (typeof unit.main !== "function") throw new HttpError(501, `${id} is not built`);
    const { input } = await body(req);
    const who = caller(req);
    const ctx: UnitContext = { data: options.tables, role: who.role, user: who.user };
    try {
      const output = await (unit.main as Capability)(input, ctx);
      send(res, 200, { output: output ?? null });
    } catch (e) {
      throw new HttpError(500, `${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const command = async (req: IncomingMessage, res: ServerResponse) => {
    const b = await body(req);
    if (typeof b.command !== "string") throw new HttpError(400, "command: a data-capability id");
    const unit = units.get(b.command);
    if (unit?.files.manifest.kind !== "data-capability")
      throw new HttpError(404, `no data-capability ${b.command}`);
    const declared =
      typeof b.declared === "object" && b.declared !== null ? (b.declared as Row) : {};
    send(res, 200, await options.writes.send(b.command, b.payload, caller(req), declared));
  };

  const testData = async (req: IncomingMessage, res: ServerResponse) => {
    const test = options.test;
    if (!test)
      throw new HttpError(404, "the rules' endpoints need APP_TEST=1 and the memory store");
    const b = await body(req);
    const keyword = b.keyword === "Given" || b.keyword === "When" ? b.keyword : "Then";
    const verdict = await playDataStep(test.tables, product.model, keyword, b.action as StepAction);
    if (verdict.wrote.length > 0) options.writes.reseed(test.tables);
    send(res, 200, { passed: verdict.passed, detail: verdict.detail });
  };

  const asset = async (path: string, res: ServerResponse) => {
    const file =
      path === "/mock.css"
        ? join(product.root, "mock/mock.css")
        : normalize(join(options.assets, path));
    if (path !== "/mock.css" && !file.startsWith(options.assets + sep))
      throw new HttpError(404, path);
    try {
      const content = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
      res.end(content);
    } catch {
      throw new HttpError(404, path);
    }
  };

  const page = async (res: ServerResponse) => {
    try {
      const html = await readFile(join(options.assets, "index.html"));
      res.writeHead(200, { "content-type": TYPES[".html"] });
      res.end(html);
    } catch {
      res.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
      res.end("The shell is not built: run `npm run build`.");
    }
  };

  const route = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://app");
    const path = decodeURIComponent(url.pathname);
    const method = req.method ?? "GET";
    if (method === "GET" && path === "/health") {
      return send(res, 200, {
        ok: true,
        store: options.store,
        units: product.units.length,
        built: product.units.filter((u) => u.built).map((u) => u.manifest.id),
        problems: product.problems,
      });
    }
    if (method === "GET" && path === "/app/manifest") return send(res, 200, manifestOf(product));
    if (method === "POST" && path.startsWith("/capabilities/"))
      return capability(path.slice("/capabilities/".length), req, res);
    if (method === "POST" && path === "/commands") return command(req, res);
    const confirm = /^\/commands\/([^/]+)\/confirm$/.exec(path);
    if (method === "POST" && confirm) {
      const b = await body(req);
      const out = await options.writes.confirm(confirm[1] ?? "", b.overwrite === true);
      if (!out) throw new HttpError(404, "no such command");
      return send(res, 200, out);
    }
    const status = /^\/commands\/([^/]+)$/.exec(path);
    if (method === "GET" && status) {
      const out = await options.writes.status(status[1] ?? "");
      if (!out) throw new HttpError(404, "no such command");
      return send(res, 200, out);
    }
    if (method === "GET" && path === "/messages")
      return send(res, 200, await options.writes.messages(caller(req).user));
    if (method === "POST" && path === "/test/reset") {
      if (!options.test) throw new HttpError(404, "the rules' endpoints need APP_TEST=1");
      options.test.reset();
      return send(res, 200, { ok: true });
    }
    if (method === "POST" && path === "/test/data") return testData(req, res);
    if (method !== "GET") throw new HttpError(405, `${method} ${path}`);
    if (extname(path) !== "") return asset(path, res);
    return page(res);
  };

  return createServer((req, res) => {
    route(req, res).catch((e: unknown) => {
      const status = e instanceof HttpError ? e.status : 500;
      if (!res.headersSent)
        send(res, status, { error: e instanceof Error ? e.message : String(e) });
      else res.end();
    });
  });
}

/** Whether a role may trigger a data-capability, by surfaces.json; every role when it has none. */
export function permits(product: ProductFiles): (role: string, command: string) => boolean {
  return (role, command) => {
    const surfaces = product.surfaces;
    if (!surfaces) return true;
    const found = surfaces.roles.find((r) => r.id === role);
    return found !== undefined && mayTrigger(found, command);
  };
}
