// The contracts of a product the harness builds. Six files, one schema each:
//   units/**/unit.json   UnitManifest   what a unit is, reads, needs, triggers, touches
//   data/model.json      DataModel      sources, entities, aggregates and their invariants
//   plan/graph.json      PlanGraph      milestones and tasks, what each produces and consumes
//   surfaces.json        Surfaces       roles, their permissions, the screens each surface holds
//   ports.json           Ports          what the product reaches outside, and who approved it
//   mock/pages.json      MockPages      the mock-up: pages, their elements, links and actions
// Every object is strict: an unknown key is refused by name, since a misspelt key (`screen` for
// `screens`) would otherwise drop what it held without a word.
// Rules are Gherkin `.feature` files under rules/; their shape is in the types below.
import { z } from "zod";

/** The values met a second time, once per repeat: readers would silently take the first. */
function repeated(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (seen.has(v)) out.push(v);
    seen.add(v);
  }
  return out;
}

// ------------------------------------------------------------------ units

/** A unit's id: `system.name`, the system being its namespace. */
export const UnitIdSchema = z
  .string()
  .regex(/^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*$/, "system.name, camelCase");

/** The kinds of unit. A shell owns what no screen owns: navigation, layout, routing, errors. */
export const UnitKindSchema = z.enum(["capability", "data-capability", "micro-ui", "shell"]);

/** One unit's manifest. A published capability is immutable: a change is a copy under a new id. */
export const UnitManifestSchema = z
  .strictObject({
    id: UnitIdSchema,
    kind: UnitKindSchema,
    title: z.string().min(1),
    description: z.string().default(""),
    /** The unit this one was copied from, `id@commit`, so a fix can be offered to the copies. */
    forkedFrom: z.string().optional(),
    concepts: z.array(z.string()).default([]),
    /** Entities (or `entity.field`) of the data model the unit reads. */
    reads: z.array(z.string()).default([]),
    /** Capabilities a micro-ui or the shell calls. */
    needs: z.array(UnitIdSchema).default([]),
    /** Data-capabilities a micro-ui or the shell triggers. */
    actions: z.array(UnitIdSchema).default([]),
    /** `entity.field` a data-capability writes. */
    touches: z.array(z.string()).default([]),
    aggregate: z.string().optional(),
    input: z.record(z.string(), z.string()).default({}),
    host: z.enum(["server", "hostless"]).default("server"),
    /** Screens a micro-ui is mounted on, or the shell frames. */
    screens: z.array(z.string()).default([]),
  })
  .superRefine((u, ctx) => {
    const fail = (message: string) =>
      ctx.addIssue({ code: "custom", message: `${u.id}: ${message}` });
    if (u.kind === "capability" && (u.actions.length > 0 || u.touches.length > 0)) {
      fail("a capability is read-only: no actions, no touches");
    }
    if (u.kind === "capability" && u.needs.length > 0) {
      fail("a capability knows no other capability");
    }
    if (u.kind === "data-capability" && (!u.aggregate || u.touches.length === 0)) {
      fail("a data-capability names its aggregate and the fields it touches");
    }
    if ((u.kind === "micro-ui" || u.kind === "shell") && u.touches.length > 0) {
      fail("a micro-ui writes only through data-capabilities");
    }
  });

/** A unit manifest, parsed. */
export type UnitManifest = z.infer<typeof UnitManifestSchema>;

// ------------------------------------------------------------------ data model

/** A field of an entity. */
export const FieldSchema = z.strictObject({
  name: z.string().min(1),
  type: z.enum([
    "string",
    "text",
    "int",
    "number",
    "bool",
    "date",
    "datetime",
    "uuid",
    "json",
    "enum",
  ]),
  nullable: z.boolean().default(false),
  values: z.array(z.string()).optional(),
  /** A critical field's change waits for a human's review. */
  critical: z.boolean().default(false),
  references: z.string().optional(),
});

/** Where data lives: a database, files, a model, an outside service. */
export const SourceSchema = z.strictObject({
  id: z.string().min(1),
  kind: z.enum(["postgres", "files", "ai", "external"]),
  title: z.string().min(1),
});

/** An entity: a table, a file kind, a collection. */
export const EntitySchema = z.strictObject({
  name: z.string().min(1),
  source: z.string().default("postgres"),
  key: z.string().default("id"),
  fields: z.array(FieldSchema).min(1),
});

/** An aggregate: the unit of consistency the write side guards. */
export const AggregateSchema = z.strictObject({
  name: z.string().min(1),
  root: z.string().min(1),
  entities: z.array(z.string()).default([]),
  invariants: z
    .array(z.strictObject({ id: z.string().min(1), description: z.string().min(1) }))
    .default([]),
  criticality: z.enum(["low", "high"]).default("low"),
});

/** The product's data model. */
export const DataModelSchema = z
  .strictObject({
    sources: z
      .array(SourceSchema)
      .default([{ id: "postgres", kind: "postgres", title: "Database" }]),
    entities: z.array(EntitySchema).default([]),
    aggregates: z.array(AggregateSchema).default([]),
  })
  .superRefine((m, ctx) => {
    const twice = (message: string) => ctx.addIssue({ code: "custom", message });
    for (const id of repeated(m.sources.map((s) => s.id))) twice(`source ${id} is declared twice`);
    for (const name of repeated(m.entities.map((e) => e.name))) {
      twice(`entity ${name} is declared twice`);
    }
    for (const e of m.entities) {
      for (const f of repeated(e.fields.map((f) => f.name)))
        twice(`${e.name}.${f} is declared twice`);
    }
    for (const name of repeated(m.aggregates.map((a) => a.name))) {
      twice(`aggregate ${name} is declared twice`);
    }
    const sources = new Set(m.sources.map((s) => s.id));
    const entities = new Set(m.entities.map((e) => e.name));
    for (const e of m.entities) {
      if (!sources.has(e.source))
        ctx.addIssue({ code: "custom", message: `${e.name}: unknown source ${e.source}` });
      for (const f of e.fields) {
        if (f.references && !entities.has(f.references)) {
          ctx.addIssue({
            code: "custom",
            message: `${e.name}.${f.name}: unknown entity ${f.references}`,
          });
        }
      }
    }
    for (const a of m.aggregates) {
      for (const name of [a.root, ...a.entities]) {
        if (!entities.has(name))
          ctx.addIssue({ code: "custom", message: `${a.name}: unknown entity ${name}` });
      }
    }
  });

/** The data model, parsed. */
export type DataModel = z.infer<typeof DataModelSchema>;
/** An entity, parsed. */
export type Entity = z.infer<typeof EntitySchema>;

// ------------------------------------------------------------------ plan graph

/** A milestone of the plan. */
export const MilestoneSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  roadmap: z.string().optional(),
  produces: z.array(z.string()).default([]),
  consumes: z.array(z.string()).default([]),
  blockedBy: z.array(z.string()).default([]),
  issue: z.number().int().optional(),
});

/**
 * A task of the plan. `expand` lands a schema change additively (a nullable column, a declared
 * field) so its consumers build in parallel; `contract` tightens it once they all landed.
 */
export const TaskSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  milestone: z.string().min(1),
  unit: z.string().optional(),
  side: z.enum(["read", "write"]),
  kind: z.enum(["build", "expand", "contract", "rules", "shell", "migrate"]).default("build"),
  produces: z.array(z.string()).default([]),
  consumes: z.array(z.string()).default([]),
  blockedBy: z.array(z.string()).default([]),
  /** Why this task deepens a chain past the limit; without it, the plan gate refuses. */
  justification: z.string().optional(),
  status: z.enum(["planned", "ready", "running", "done"]).default("planned"),
  issue: z.number().int().optional(),
});

/** The plan: milestones and tasks, chained by what they produce and consume. */
export const PlanGraphSchema = z.strictObject({
  version: z.literal(1),
  milestones: z.array(MilestoneSchema).default([]),
  tasks: z.array(TaskSchema).default([]),
});

/** The plan graph, parsed. */
export type PlanGraph = z.infer<typeof PlanGraphSchema>;
/** A task, parsed. */
export type Task = z.infer<typeof TaskSchema>;
/** A milestone, parsed. */
export type Milestone = z.infer<typeof MilestoneSchema>;

// ------------------------------------------------------------------ surfaces and roles

/** A role a person plays in the product, and the actions it may trigger (`*` for all). */
export const RoleSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  permissions: z.array(z.string()).default([]),
});

/** A surface: a set of screens and the roles that use them. */
export const SurfaceSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  roles: z.array(z.string()).min(1),
  screens: z.array(z.string()).default([]),
});

/** The product's roles and surfaces. */
export const SurfacesSchema = z
  .strictObject({
    roles: z.array(RoleSchema).min(1),
    surfaces: z.array(SurfaceSchema).default([]),
  })
  .superRefine((m, ctx) => {
    for (const id of repeated(m.roles.map((r) => r.id))) {
      ctx.addIssue({ code: "custom", message: `role ${id} is declared twice` });
    }
    for (const id of repeated(m.surfaces.map((r) => r.id))) {
      ctx.addIssue({ code: "custom", message: `surface ${id} is declared twice` });
    }
  });

/** Surfaces, parsed. */
export type Surfaces = z.infer<typeof SurfacesSchema>;
/** A role, parsed. */
export type Role = z.infer<typeof RoleSchema>;

/** Whether a role may trigger a data-capability: `*`, the action itself, or `<system>.*`. */
export function mayTrigger(role: Pick<Role, "permissions">, action: string): boolean {
  const system = action.split(".")[0] ?? "";
  return role.permissions.some((p) => p === "*" || p === action || p === `${system}.*`);
}

// ------------------------------------------------------------------ ports

/** Something the product reaches outside, and whether its owner approved it. */
export const PortSchema = z.strictObject({
  id: z.string().min(1),
  kind: z.enum(["llm", "speech", "storage", "mail", "payment", "other"]),
  provider: z.string().min(1),
  approved: z.boolean().default(false),
  monthlyCostUsd: z.number().nonnegative().optional(),
  note: z.string().default(""),
});

/** The product's ports. */
export const PortsSchema = z
  .strictObject({ ports: z.array(PortSchema).default([]) })
  .superRefine((m, ctx) => {
    for (const id of repeated(m.ports.map((p) => p.id))) {
      ctx.addIssue({ code: "custom", message: `port ${id} is declared twice` });
    }
  });

/** Ports, parsed. */
export type Ports = z.infer<typeof PortsSchema>;

// ------------------------------------------------------------------ mock-up

/** A page's or an element's id; refused with the id itself and its shape in words. */
function kebabId(what: string) {
  return z.string().regex(/^[a-z][a-z0-9-]*$/, {
    error: (issue) =>
      `${what} id ${JSON.stringify(issue.input)}: lower-case letters, digits and dashes, from a letter`,
  });
}

/** An element of a mock page, anchored in its HTML by `data-el="<id>"`. */
export const ElementSchema = z.strictObject({
  id: kebabId("element"),
  kind: z.enum(["component", "link", "action", "field", "list", "text"]),
  label: z.string().min(1),
  /** A link's target page. */
  to: z.string().optional(),
  /** An action's data-capability. */
  action: UnitIdSchema.optional(),
  /** The micro-ui (or shell) the element belongs to. */
  component: z.string().optional(),
  /** Roles that see the element; empty means every role. */
  roles: z.array(z.string()).default([]),
});

/** A page of the mock-up. */
export const PageSchema = z.strictObject({
  id: kebabId("page"),
  title: z.string().min(1),
  file: z.string().min(1),
  /**
   * Where the page sits in the product, for the review's location bar: one step for a main page
   * (it is then listed in the menu), its parent first for a page reached from another (a detail).
   */
  path: z.array(z.string()).default([]),
  screen: z.string().optional(),
  surface: z.string().optional(),
  elements: z.array(ElementSchema).default([]),
});

/** The mock-up: its pages, the page a user lands on, its fixtures and handlers. */
export const MockPagesSchema = z
  .strictObject({
    version: z.literal(1),
    home: z.string().min(1),
    pages: z.array(PageSchema).min(1),
    /** Fixture files, one per entity: `mock/fixtures/<entity>.json`, an array of rows. */
    fixtures: z.array(z.string()).default([]),
    /** The module of action handlers, `mock/handlers.js`. */
    handlers: z.string().optional(),
  })
  .superRefine((m, ctx) => {
    for (const id of repeated(m.pages.map((p) => p.id))) {
      ctx.addIssue({ code: "custom", message: `page ${id} is declared twice` });
    }
    for (const p of m.pages) {
      for (const id of repeated(p.elements.map((e) => e.id))) {
        ctx.addIssue({ code: "custom", message: `${p.id}/${id} is declared twice` });
      }
    }
    const pages = new Set(m.pages.map((p) => p.id));
    if (!pages.has(m.home)) ctx.addIssue({ code: "custom", message: `home ${m.home} is no page` });
    for (const p of m.pages) {
      for (const e of p.elements) {
        if (e.kind === "link" && (!e.to || !pages.has(e.to))) {
          ctx.addIssue({
            code: "custom",
            message: `${p.id}/${e.id}: a link names an existing page`,
          });
        }
        if (e.kind === "action" && !e.action) {
          ctx.addIssue({
            code: "custom",
            message: `${p.id}/${e.id}: an action names its data-capability`,
          });
        }
      }
    }
  });

/**
 * A mock-up file's path from the product's root. Pages may name their file from the root
 * (`mock/pages/a.html`) or from the mock-up's folder (`pages/a.html`): both are read the same.
 */
export function mockFilePath(file: string): string {
  const clean = file.replace(/^\.\//, "");
  return clean.startsWith("mock/") ? clean : `mock/${clean}`;
}

/** The mock-up, parsed. */
export type MockPages = z.infer<typeof MockPagesSchema>;
/** A mock page, parsed. */
export type Page = z.infer<typeof PageSchema>;
/** A mock element, parsed. */
export type Element = z.infer<typeof ElementSchema>;

// ------------------------------------------------------------------ rules (Gherkin)

/** A Gherkin step, its `And`/`But` resolved to the keyword it continues. */
export interface GherkinStep {
  keyword: "Given" | "When" | "Then";
  raw: string;
  text: string;
  line: number;
}

/** A scenario (an outline is expanded, one scenario per example row). */
export interface Scenario {
  name: string;
  tags: string[];
  steps: GherkinStep[];
  line: number;
}

/** A parsed `.feature` file. */
export interface Feature {
  file: string;
  name: string;
  description: string;
  tags: string[];
  background: GherkinStep[];
  scenarios: Scenario[];
}

/**
 * What a step does, in the one vocabulary both the review's mock player and the product's
 * test runner understand. A step outside the vocabulary is `free`, and a gate flags it.
 */
export type StepAction =
  | { kind: "as-role"; role: string }
  | { kind: "open"; page: string }
  | { kind: "click"; el: string }
  | { kind: "fill"; el: string; value: string }
  | { kind: "select"; el: string; value: string }
  | { kind: "see-page"; page: string }
  | { kind: "see"; el: string }
  | { kind: "not-see"; el: string }
  | { kind: "see-text"; text: string }
  | { kind: "data-exists"; entity: string; where: Record<string, string> }
  | { kind: "data-absent"; entity: string; where: Record<string, string> }
  | { kind: "data-has"; entity: string; where: Record<string, string>; set: Record<string, string> }
  | { kind: "refused"; action?: string; reason?: string }
  | { kind: "free"; text: string };

/** How a rule was declared: in force, changed ahead of the code, or disputed by a development. */
export type RuleDeclared = "active" | "conform" | "contested";

/**
 * A rule: one scenario and what its tags say. Tags: `@R12` (id), `@journey`/`@business`,
 * `@role:<id>`, `@page:<id>`, `@el:<id>`, `@component:<id>`, `@unit:<id>`, `@conform`,
 * `@contested`, `@generated` (written by the harness from the mock-up), `@base` (base pack).
 */
export interface Rule {
  id: string;
  title: string;
  family: "journey" | "business";
  file: string;
  scenario: Scenario;
  roles: string[];
  pages: string[];
  elements: string[];
  components: string[];
  units: string[];
  declared: RuleDeclared;
  generated: boolean;
  base: boolean;
}
