# forgedesmondes

A product built by the harness. Its contracts, each with its schema in the harness:

- `data/model.json`: the data model (sources, entities, aggregates and their invariants)
- `surfaces.json`: the roles, their permissions, the screens each surface holds
- `ports.json`: what the product reaches outside, and who approved it
- `plan/graph.json`: milestones and tasks
- `mock/pages.json`: the mock-up, its pages under `mock/pages/`
- `rules/*.feature`: the rules, in Gherkin

Units live in `units/<system>/<name>/`, the shell in `shell/`, the shared kit in `kit/`.
The app (`app/`, the harness's runtime) wires them by their manifests:

- `npm install && npm run build && npm start`: the app on http://127.0.0.1:3000
- `npm run gates`: what every change passes (typecheck, unit tests, lint)
- `npm run rules`: the rules played on the real app (`npx playwright install chromium` once)
