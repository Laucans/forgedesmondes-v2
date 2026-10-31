# ForgeDesMondes, v1 inputs converted for v2

ForgeDesMondes as v1 left it (`Laucans/ForgeDesMondes`, branch `main_agent`, commit `458872a`),
converted into a v2 product tree with no model. It is the input of the next step: rebuild the
product with v2 from its roadmap, and compare v1 and v2 on the same mock-up, rules, data model
and surfaces (`docs/COMPARISON.md`).

## How it was produced

```bash
git clone --depth 1 -b main_agent https://github.com/Laucans/ForgeDesMondes.git /tmp/fdm
node scripts/import-v1.ts /tmp/fdm examples/forgedesmondes-v1-import
npx biome format --write examples/forgedesmondes-v1-import
node --test examples/forgedesmondes-v1-import/validate.test.ts   # the numbers below
node scripts/mock-replay.ts examples/forgedesmondes-v1-import    # the rules in Chromium
```

The script prints every problem the converters met; it is the list below.

| file | from v1 | by |
| --- | --- | --- |
| `rules/v1.feature` | `rules.json` (54 rules) | `importV1Rules` |
| `mock/pages.json` | `mock/pages.json` + the pages' HTML (Menu, Breadcrumb kits) + the components' code | `importV1Pages` |
| `mock/pages/*.html` | written from `pages.json`, every element anchored | `mockSkeleton` |
| `mock/handlers.js` | none: every action is refused until a design task writes its handler | — |
| `data/model.json` | `data/model.json` (33 tables) + `mock/data/aggregates/*.json` (12) | `importV1Model` |
| `surfaces.json` | `surfaces.json` + the pages' surfaces and screens | `importV1Surfaces` |
| `ports.json` | `ports.json` (4 ports) | `importV1Ports` |
| `rules/generated.feature` | the navigation of the converted mock-up | `generatedFeature` |
| `rules/base.feature` | the base pack, per role | `basePack` |

## Numbers

- **Mock-up**: 9 pages, 188 elements (36 components with the site menus, 95 actions, 57 links), home `campagnes`
  (the menu's brand). Every page is reachable.
- **Rules**: 130 — 54 from v1, 65 generated (navigation), 11 base pack. `rulesOf` reports no
  problem.
- **Vocabulary**: the v1 rules are prose: **162 of their 162 steps are `free`** (3 per rule:
  their Given, When, Then). The generated and base rules have none.
- **Coverage**: the v1 rules cover **28 of 188 elements (15%)**: their `@el` tags name the
  components, no rule names an action or a link. With the generated and base rules: **93 of 188
  (49%)**; what is left is exactly the 95 actions: no rule clicks one.
- **Data model**: 33 entities, 234 fields (75 critical), 12 aggregates with 61 invariants.
- **Surfaces**: 2 roles (`dm`, `player`), 2 surfaces; **ports**: 4, none approved.
- **Played in Chromium** (`mock-replay`): 130 rules in 7.5 s, 72 green, 58 failed — the 54 v1
  rules stop at their first free step ("étape hors vocabulaire"), and 4 base rules ask what v1
  never had (below).
- **Gates**: `contracts-valid` passes; `mock-graph` fails on 95 actions no unit declares (no
  unit is converted) and on the 4 base-pack gaps; `vocabulary` fails on the 162 free steps;
  `coverage` fails on 95 uncovered elements; `mock-plays` fails on the 4 base rules only.

## What was not carried over, and why

**Rules**
- The criterion of each rule is French prose: Given/When/Then are `free` steps until a rules
  pass rewrites them in the vocabulary.
- Each rule's body is written as comments above its scenario: the parser drops comments, so the
  contexts computed from the rules show the criterion only, not the body.

**Mock-up**
- v1's HTML runs on v1's runtime (kits, design tokens, component bundles built from `apps/`, the
  mock server): v2's runtime finds no `data-el` in it, so played as it is every rule fails at its
  first screen step (measured: 0 of 130 green). The pages here are skeletons written from
  `pages.json`: they play, they do not look like v1. The look is in v1's repository.
- The 9 page objectives (a v2 page has none), the components' `needs` (the capabilities they
  read), `props`, `source` and `builtFrom`.
- The 24 fixtures: v1's are per capability (an answer), v2's per entity (rows).
- The 72 handlers: they ran on v1's mock server (`reads`, `commands`, `server.load`).
- 20 links come from a component's code (`fiche-entite.html?id=…`, `/screens/<screen>`): their
  label is a guess (`Vers <page>`), and v1 renders them per row.
- What v1 never had and the base pack asks: a site menu on `player-view`, menu links to
  `dm-view` and `player-view` (top-level here, having no breadcrumb), an `error` page.

**Data model**
- Every purpose and note: 33 table and 234 field purposes, 303 business and 219 technical
  notes (a v2 field holds none). The tables' business rule ids (`R3`, `R77`…) with them.
- Types: numeric precision (12 fields become `number`), arrays (`text[]`, 2 fields, become
  `json`). `text` stays `text`, `varchar` becomes `string`.
- Keys: 11 tables have no `id` (composite keys, views): v2 keys them by their first field.
  The 5 `*_view` tables are SQL views, kept as entities.
- Aggregates: their `holds`, their relations' `onDelete`/`onUpdate` (53), the invariants'
  `onViolation`, and the field criticalities other than `critical`. Which tables an aggregate
  holds is read from its camelCase field names; 2 roots are a guess (`NoteImport` →
  `note_proposal`, `Suggestion` → `live_suggestion`).

**Surfaces**
- v1 grants no permission (no data-capability asks one), which v1 reads as every action:
  both roles get `*`.
- The DM's review role (`role:approver`): v2 marks fields critical but does not say who
  approves them.
- Every page is on the `dm` surface (the default); `player` holds no screen.

**Ports**
- v1 records no approval: every port waits for the owner's. Adapters, fakes and users
  (`usedBy`) are dropped; purpose, tech, cost and secrets are folded into the note.

**Not converted at all**: v1's built product (`apps/`, `crates/`) and its unit manifests, the
plan graph (22 milestones), the persisted queries, the concepts, the design kit, and the 27
journey specs of `tests/rules/` — v2 rebuilds them from the roadmap.
