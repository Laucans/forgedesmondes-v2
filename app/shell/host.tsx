// The front end's host: one route per mock page (`/<page>`), the shell around it, and on it every
// micro-ui whose manifest lists that page in `screens`, in the order of its elements in
// mock/pages.json. A unit not built yet shows a placeholder; one that throws shows its error and
// leaves the others standing. Owned by the harness: `harness upgrade-runtime` rewrites it.
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  StrictMode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { Link } from "#kit/ui.tsx";
import type {
  ElementSpec,
  MicroUi,
  MicroUiProps,
  Outcome,
  PageSpec,
  Shell,
  ShellProps,
} from "#kit/units.ts";

/** A mock element, with the unit it belongs to. */
type MockElement = ElementSpec & { component?: string };
/** A mock page, as the server's manifest gives it. */
type MockPage = PageSpec & { screen: string | null; elements: MockElement[] };

/** What `GET /app/manifest` answers. */
interface AppManifest {
  home: string | null;
  pages: MockPage[];
  units: Array<{ id: string; kind: string; title: string; screens: string[]; built: boolean }>;
  roles: string[];
}

/** What the rules runner reads of the page, and what a person can inspect in the console. */
interface AppProbe {
  /** Requests in flight: the page is settled at 0. */
  busy: number;
  /** The last command a micro-ui sent, as judged. */
  lastOutcome: Outcome | null;
  ready: boolean;
}

declare global {
  interface Window {
    __app: AppProbe;
  }
}

const probe: AppProbe = { busy: 0, lastOutcome: null, ready: false };
window.__app = probe;

const ROLE_KEY = "app.role";
const ERROR_PAGE = "error";

function storedRole(): string | null {
  try {
    return localStorage.getItem(ROLE_KEY);
  } catch {
    return null;
  }
}

function storeRole(role: string): void {
  try {
    localStorage.setItem(ROLE_KEY, role);
  } catch {
    // a private window: the role lasts as long as the page
  }
}

async function post(path: string, payload: unknown, role: string): Promise<unknown> {
  probe.busy++;
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", "x-app-role": role },
      body: JSON.stringify(payload),
    });
    const answer = (await res.json()) as Record<string, unknown>;
    if (!res.ok) throw new Error(String(answer.error ?? res.statusText));
    return answer;
  } finally {
    probe.busy--;
  }
}

interface Route {
  page: string;
  params: Record<string, string>;
}

function routeOf(home: string): Route {
  const page = decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g, "")) || home;
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(location.search)) if (k !== "as") params[k] = v;
  return { page, params };
}

class Guard extends Component<{ unit: string; children: ReactNode }, { error: string | null }> {
  override state = { error: null as string | null };
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(this.props.unit, error, info.componentStack);
  }
  override render() {
    if (this.state.error === null) return this.props.children;
    return (
      <section data-unit-error={this.props.unit} className="unit-error">
        {this.props.unit}: {this.state.error}
      </section>
    );
  }
}

/** The frame used until the shell is built: its links, then the page. */
function BareShell(props: ShellProps): ReactNode {
  const links = props.elements.filter((e) => e.kind === "link" && e.to);
  return (
    <>
      <nav data-el="site-menu">
        {links.map((l) => (
          <Link key={l.id} el={l.id} to={l.to ?? ""} navigate={props.navigate}>
            {l.label}
          </Link>
        ))}
      </nav>
      <main>{props.children}</main>
    </>
  );
}

function App(props: { manifest: AppManifest; registry: Record<string, unknown> }): ReactNode {
  const { manifest, registry } = props;
  const home = manifest.home ?? manifest.pages[0]?.id ?? "";
  const [route, setRoute] = useState<Route>(() => routeOf(home));
  const [role, setRoleState] = useState<string>(() => {
    const asked = new URLSearchParams(location.search).get("as");
    const role = asked ?? storedRole() ?? manifest.roles[0] ?? "user";
    storeRole(role);
    return role;
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const onPop = () => setRoute(routeOf(home));
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, [home]);

  const page =
    manifest.pages.find((p) => p.id === route.page) ??
    manifest.pages.find((p) => p.id === ERROR_PAGE) ??
    manifest.pages[0];

  useEffect(() => {
    document.body.dataset.page = page?.id ?? "";
    document.title = page?.title ?? "";
    probe.ready = true;
  }, [page]);

  const actions = useMemo(() => {
    const navigate = (to: string, params: Record<string, string> = {}) => {
      const query = new URLSearchParams(params).toString();
      history.pushState(null, "", `/${encodeURIComponent(to)}${query ? `?${query}` : ""}`);
      setRoute({ page: to, params });
    };
    const call = async <T,>(capability: string, input?: unknown): Promise<T> =>
      (
        (await post(`/capabilities/${encodeURIComponent(capability)}`, { input }, role)) as {
          output: T;
        }
      ).output;
    const command = async (
      action: string,
      payload: unknown,
      declared?: Record<string, unknown>,
    ): Promise<Outcome> => {
      let outcome: Outcome;
      try {
        outcome = (await post(
          "/commands",
          { command: action, payload, declared },
          role,
        )) as Outcome;
      } catch (e) {
        outcome = {
          action,
          id: null,
          state: "rejected",
          reason: e instanceof Error ? e.message : String(e),
        };
      }
      probe.lastOutcome = outcome;
      if (outcome.state === "applied") setVersion((v) => v + 1);
      return outcome;
    };
    return { navigate, call, command };
  }, [role]);
  const { navigate, call, command } = actions;
  const setRole = (next: string) => {
    storeRole(next);
    setRoleState(next);
  };

  if (!page) return <p>The mock-up declares no page.</p>;

  const shellUnit = manifest.units.find((u) => u.kind === "shell");
  const order = (id: string) => {
    const at = page.elements.findIndex((e) => e.component === id);
    return at < 0 ? Number.MAX_SAFE_INTEGER : at;
  };
  const mounted = manifest.units
    .filter(
      (u) =>
        u.kind === "micro-ui" &&
        (u.screens.includes(page.id) || (page.screen !== null && u.screens.includes(page.screen))),
    )
    .sort((a, b) => order(a.id) - order(b.id) || a.id.localeCompare(b.id));

  const children = mounted.map((u) => {
    const View = registry[u.id] as MicroUi | undefined;
    if (!View) {
      return (
        <section key={u.id} data-pending={u.id} className="empty">
          {u.title}: not built yet
        </section>
      );
    }
    const unitProps: MicroUiProps = {
      role,
      page: page.id,
      params: route.params,
      elements: page.elements.filter((e) => e.component === u.id),
      version,
      call,
      command,
      navigate,
    };
    return (
      <Guard key={`${u.id}@${page.id}`} unit={u.id}>
        <View {...unitProps} />
      </Guard>
    );
  });

  const ShellView = (shellUnit ? registry[shellUnit.id] : undefined) as Shell | undefined;
  const Frame = ShellView ?? BareShell;
  const shellElements = page.elements.filter(
    (e) => e.component === undefined || e.component === shellUnit?.id || e.component === "shell",
  );
  return (
    <Guard unit={shellUnit?.id ?? "shell"}>
      <Frame
        role={role}
        roles={manifest.roles}
        setRole={setRole}
        page={{ id: page.id, title: page.title, path: page.path }}
        elements={shellElements}
        pages={manifest.pages.map((p) => ({ id: p.id, title: p.title, path: p.path }))}
        home={home}
        navigate={navigate}
      >
        {children}
      </Frame>
    </Guard>
  );
}

/** Mounts the app: the bundle's entry calls it with every built micro-ui and the shell, by id. */
export async function start(registry: Record<string, unknown>): Promise<void> {
  const res = await fetch("/app/manifest");
  const manifest = (await res.json()) as AppManifest;
  const root = document.getElementById("app");
  if (!root) throw new Error("no #app element");
  createRoot(root).render(
    <StrictMode>
      <App manifest={manifest} registry={registry} />
    </StrictMode>,
  );
}
