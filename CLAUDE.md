# forgedesmondes: rules for the robots

## Layout

- A unit lives in `units/<system>/<name>/`: `unit.json` (its manifest) and `src/`. Its id is `<system>.<name>`.
- A capability reads, a data-capability writes the fields of its aggregate, a micro-ui is a
  screen fragment, the shell (`shell/`) owns the menu, the layout, routing and errors.
- A unit imports only its own folder, `kit/`, `concepts/` and npm packages; never another
  unit's folder. A capability never names a data-capability.

## Never edit

- `rules/`: the rules. A rule you cannot meet is contested, never rewritten.
- The contracts: `data/model.json`, `surfaces.json`, `ports.json`, `plan/graph.json`, `mock/`.

## The rules' vocabulary

A step is one of these sentences, values in double quotes (`\"` inside one):

- I am a "<role>"
- I am on "<page>"
- I click "<element>"
- I fill "<element>" with "<value>"
- I select "<value>" in "<list>"
- I see the page "<page>"
- I see "<element>"
- I do not see "<element>"
- I see the text "<text>"
- there is a "<entity>" with field "<value>" and other "<value>"
- there is no "<entity>" with field "<value>"
- the "<entity>" with field "<value>" has other "<value>"
- the command "<system.name>" is refused because "<why>"

Also read: `I open "<page>"`, `I am "<role>"`; the `with` clause, the command's name and
its reason are optional. Anything else is a free step, which the gates refuse.

## Migrations

`data/migrations/YYYYMMDDHHMMSS_slug.sql`, never edited once landed. A migration that
needs another one first starts with `-- depends: <file name>`.

## The app

The runtime (`app/`) wires every unit by its manifest: **no task writes a route, an endpoint, a
server or any wiring**. A unit exports one thing, by the convention of its kind, and is reached
by its id.

- `npm start`: the server (`app/server`, `PORT`, default 3000). Data in memory from
  `mock/fixtures/<entity>.json`; with `DATABASE_URL`, the product's PostgreSQL
  (`docker compose -f docker/compose.yml up -d`), `data/migrations/*.sql` applied at start.
- `npm run build`: bundles the front end into `app/shell/dist` (never committed).
- `npm run rules`: plays every rule of `rules/` on the real app in a browser and writes
  `.harness/rule-results.json` (`holds`, `red`, or `pending` while a unit it needs has no
  code). `npm run rules -- R3 R7` plays some. Needs Chromium once: `npx playwright install chromium`.
- Wire protocol: `POST /capabilities/<id>` `{ "input" }` → `{ "output" }`; `POST /commands`
  `{ "command", "payload" }` → the command's outcome; `GET /commands/<id>`; `GET /health`.
- One route per mock page: `/<page id>`, parameters in the query (`/campaign?id=val-maudit`).
  An unknown address shows the page `error`.
- Never edit `app/`, `tests/rules/`, `kit/units.ts`, `kit/ui.tsx`, `vendor/`: the harness owns them.

## Unit conventions (`kit/units.ts`)

Every unit imports its conventions from `#kit/units.ts` (and `#kit/ui.tsx` in the browser).

**Capability** (`src/index.ts`): reads, never writes. `ctx.data` reads any entity.

```ts
import { capability, type Row } from "#kit/units.ts";

export default capability(async (input: { archived?: boolean }, ctx): Promise<Row[]> =>
  ctx.data.list("campaign", { archived: input.archived ?? false }),
);
```

**Data-capability** (`src/index.ts`): one write on one aggregate instance, through the DataGuard.
Its id, its aggregate and the fields it may write come from its manifest (`touches`); the
aggregate's state is its root entity's row; `kind` is `add`, `change` or `remove`.

```ts
import { z } from "zod";
import { dataCapability } from "#kit/units.ts";

type Campaign = { name: string; archived: boolean };

export default dataCapability<Campaign, { id: string }>({
  kind: "change",
  payload: z.object({ id: z.string().min(1) }),
  target: (p) => p.id, // the instance: the root row's key
  plan: (state, p) => ({ archived: true }), // only fields of the manifest's touches
  // A refusal needing other rows than the instance's (a unique name): a reason, or null.
  check: async (p, ctx) => ((await ctx.data.get("campaign", p.id)) ? null : "no such campaign"),
});
```

**Aggregate invariants** (`data/aggregates/<Aggregate>.ts`, written by the first write task on
that aggregate): every invariant of `data/model.json`, by the same id. A broken invariant
rejects the command with `<id>: <reason>`: what `the command "…" is refused because "…"` reads.

```ts
import { aggregate } from "#kit/units.ts";

export default aggregate<{ name: string }>({
  invariants: [{ id: "name-required", check: (s) => (s.name.trim() ? null : "a name is required") }],
});
```

**Micro-ui** (`src/index.tsx`): mounted on every page its manifest lists in `screens`, in the
order of its elements in `mock/pages.json`. It keeps **every `data-el` of the mock** (the rules
click them), calls only its `needs`, sends only its `actions`.

```tsx
import { useCapability } from "#kit/ui.tsx";
import { microUi, type Row } from "#kit/units.ts";
import { useState } from "react";

export default microUi(function CampaignList(props) {
  const { data = [] } = useCapability<Row[]>(props, "campaign.list"); // read again after each write
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <section data-el="campaign-panel">
      <ul data-el="campaign-list" data-list>
        {data.map((c) => (
          <li key={String(c.id)} data-row-id={String(c.id)} onClick={() => setSelected(String(c.id))}>
            {String(c.name)}
          </li>
        ))}
      </ul>
      <button type="button" data-el="archive-btn"
        onClick={() => selected && props.command("campaign.archive", { id: selected })}>
        Archive
      </button>
    </section>
  );
});
```

- A list's rows carry `data-row-id` (`I select "…" in "<list>"` clicks the row with that text).
- A field is an `<input>`, `<select>` or `<textarea>` carrying the `data-el`, or inside it.
- `props.command` resolves to `{ state, reason }`: show the reason of a `rejected` one.
- `props.role` hides what a role may not see (an element's `roles` in `mock/pages.json`);
  `props.navigate(page, params)` and `Link` (`#kit/ui.tsx`) move between pages.
- Style: the mock's classes (`mock/mock.css` is served to the app as it is).

**Shell** (`shell/src/index.tsx`): `export default shell(Frame)`; it renders the site menu (a
`nav` with `data-el="site-menu"` and a `Link` per main page, `data-el="menu-<page>"`), the
layout, and `props.children` (the page's micro-uis) inside its `<main>`.

**Tests**: a unit's tests are `test/*.test.ts` in its folder (`node --test`); a capability or a
data-capability is a function or an object, test it directly with rows of your own.

## Gates

`npm run gates` (typecheck, test, lint) passes before every commit. `npm run rules` plays the
rules your unit is named in: run it before you finish (`npm run build` first is part of it).
