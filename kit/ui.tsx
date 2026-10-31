// What micro-uis and the shell use to read data and to move between pages, the same way in every
// unit. Owned by the harness: `harness upgrade-runtime` rewrites this file.
import { type MouseEvent, type ReactNode, useEffect, useState } from "react";
import type { MicroUiProps } from "./units.ts";

/** A capability's answer, while it loads and once it did. */
export interface Loaded<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
}

/**
 * Calls a capability and reads it again after every applied command (`props.version`), or when
 * its input changes.
 */
export function useCapability<T>(
  props: Pick<MicroUiProps, "call" | "version">,
  capability: string,
  input?: unknown,
): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({ data: undefined, error: null, loading: true });
  const key = JSON.stringify(input ?? null);
  const { call, version } = props;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the input is compared by its JSON
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    call<T>(capability, input).then(
      (data) => live && setState({ data, error: null, loading: false }),
      (e: unknown) =>
        live &&
        setState({
          data: undefined,
          error: e instanceof Error ? e.message : String(e),
          loading: false,
        }),
    );
    return () => {
      live = false;
    };
  }, [call, capability, key, version]);
  return state;
}

/** A page's address: `/<page>`, its parameters in the query. */
export function pageHref(page: string, params: Record<string, string> = {}): string {
  const query = new URLSearchParams(params).toString();
  return `/${encodeURIComponent(page)}${query === "" ? "" : `?${query}`}`;
}

/** A link to a page, keeping the mock's `data-el` id. */
export function Link(props: {
  el: string;
  to: string;
  params?: Record<string, string>;
  navigate(page: string, params?: Record<string, string>): void;
  current?: boolean;
  className?: string;
  children: ReactNode;
}): ReactNode {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    props.navigate(props.to, props.params);
  };
  return (
    <a
      data-el={props.el}
      href={pageHref(props.to, props.params)}
      onClick={onClick}
      className={props.className}
      aria-current={props.current ? "page" : undefined}
    >
      {props.children}
    </a>
  );
}
