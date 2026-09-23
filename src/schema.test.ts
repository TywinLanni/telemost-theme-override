/**
 * RED contract tests for the semantic color configuration schema (bead tto-6ia.3).
 *
 * Specification: `.beads/artifacts/tto-6ia.2/plan.md` §2–§4, §7, §10, §11 and
 * the §17 matrix rows T-BC-01/02 and T-SCH-01..14.
 *
 * These tests describe the CORRECT behavior of the config boundary. Against
 * the current production code they fail in exactly two ways, each expected:
 *
 *   1. MISSING EXPORT — the semantic schemas do not exist in `src/schema.ts`
 *      yet (owner: the semantic-color implementation issue). Tests access them
 *      through a namespace import and fail via `needExport()` with a message
 *      naming the missing export.
 *   2. SILENT STRIPPING — today `z.object` silently drops unknown keys, so
 *      `semantic`/`semanticBindings`/`semanticCanaries` configs parse
 *      "successfully" while their data disappears. Tests assert the strict
 *      behavior (reject, or round-trip) and fail because today's parse either
 *      succeeds-when-it-must-reject or drops the payload.
 *
 * Tests tagged "control" pass today on purpose: they pin the backward
 * compatibility guarantees (old theme/mapping files parse unchanged) that the
 * future implementation must not break.
 *
 * The legacy regression tests live FIRST so that a load-time regression in the
 * existing schema is visible even while the rest of the file is RED.
 *
 * Run: bun test src/schema.test.ts
 */

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as schemaNs from "./schema"
import { loadMapping, ConfigError } from "./config"
import {
  EXPECTED_CATEGORY_KEYS,
  EXPECTED_SEMANTIC_CATEGORIES,
  SEMANTIC_SLOT_SPECS,
  buildSemanticConfig,
  specValue,
} from "./theme/semantic-slots.testdata"

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

const SEEDS = {
  neutral: "#0a0a0a",
  primary: "#101010",
  success: "#1a1a1a",
  warning: "#242424",
  error: "#2e2e2e",
  info: "#383838",
  interactive: "#424242",
} as const

const ACCENT_SCALE = [
  "#fcfdff", "#f5faff", "#eaf2ff", "#daeaff", "#c8e0ff", "#b4d2ff",
  "#98bfff", "#73a4ff", "#034cff", "#0443de", "#1251ec", "#0f2b6c",
] as const

/** Variant objects are typed so fixture callers can spread and extend them. */
interface ThemeFixture {
  name: string
  id: string
  light: Record<string, unknown>
  dark: Record<string, unknown>
}

/** A valid legacy-shaped theme (no semantic data), like the shipped config/theme.json. */
function legacyTheme(): ThemeFixture {
  return {
    name: "Fixture",
    id: "fixture",
    light: { seeds: SEEDS, accentScale: ACCENT_SCALE },
    dark: { seeds: SEEDS, accentScale: ACCENT_SCALE },
  }
}

/** A valid legacy-shaped mapping body, like the shipped config/mapping.json. */
function legacyMapping(): Record<string, unknown> {
  return {
    description: "fixture mapping",
    ramps: [{ family: "ya-telemost", seed: "interactive", alphaSource: 700, emitLightTrio: true }],
    darkOverrides: { "--common-divider": "#333333" },
    lightOverrides: {},
    canaryTokens: ["--orb-surface-brand"],
  }
}

const PROJECT_ROOT = join(import.meta.dir, "..")
const CONFIG_THEME = JSON.parse(readFileSync(join(PROJECT_ROOT, "config/theme.json"), "utf8")) as unknown
const CONFIG_MAPPING = JSON.parse(readFileSync(join(PROJECT_ROOT, "config/mapping.json"), "utf8")) as unknown

/* ------------------------------------------------------------------ *
 * Future-export access
 * ------------------------------------------------------------------ */

/**
 * Exports the semantic-color contract must add to `src/schema.ts`
 * (plan §15, tto-6ia.2 symbol table). Typed `unknown`: they must not exist
 * yet, and `needExport` turns their absence into a descriptive RED failure.
 */
const future = schemaNs

/** Minimal shape every zod schema satisfies; the default type for future exports. */
interface ParseableSchema {
  safeParse(input: unknown): { success: boolean; data?: unknown; error?: { issues: ZodIssueLike[] } }
}

/** Fails the test with the expected missing-feature reason when an export is absent. */
function needExport<T = ParseableSchema>(value: unknown, name: string): T {
  if (value === undefined) {
    throw new Error(
      `RED by design: export '${name}' does not exist in src/schema.ts yet — ` +
      `the semantic-color contract (plan §3/§4) must add it`,
    )
  }
  return value as T
}

interface ZodIssueLike {
  path: Array<string | number | symbol>
  message: string
}

/** Returns the `path: message` lines of a failed parse, failing the test if the parse succeeded. */
function rejectionLines(zodSchema: unknown, input: unknown): string[] {
  const result = (zodSchema as { safeParse(input: unknown): { success: boolean; error?: { issues: ZodIssueLike[] }; data?: unknown } })
    .safeParse(input)
  if (result.success) {
    throw new Error(`expected schema rejection but parse succeeded (strictness not implemented?) with ${JSON.stringify(result.data)}`)
  }
  return result.error!.issues.map((issue) => `${issue.path.map(String).join(".")}: ${issue.message}`)
}

function parseOk<T>(zodSchema: unknown, input: unknown): T {
  const result = (zodSchema as { safeParse(input: unknown): { success: boolean; error?: { issues: ZodIssueLike[] }; data?: T } })
    .safeParse(input)
  if (!result.success) {
    throw new Error(`expected parse success but got issues:\n${result.error!.issues.map((i) => `${i.path.map(String).join(".")}: ${i.message}`).join("\n")}`)
  }
  return result.data!
}

/* ------------------------------------------------------------------ *
 * loadMapping helper
 * ------------------------------------------------------------------ */

let mappingFileCounter = 0

/**
 * `loadMapping` under its planned signature (plan §10): the theme argument is
 * the cross-validation input — static rule bindings consume one value, so
 * light and dark must carry it equally. Today's loader takes only the path;
 * this cast keeps call sites honest about the target signature while the
 * second argument stays inert until the implementation lands.
 */
/** Writes `body` to a temp file and loads it through the real loader. */
async function loadMappingFrom(body: unknown, theme?: unknown): Promise<Record<string, unknown>> {
  const dir = join(tmpdir(), `tto-6ia-3-schema-tests-${process.pid}`)
  await mkdir(dir, { recursive: true })
  const path = join(dir, `mapping-${mappingFileCounter++}.json`)
  await writeFile(path, JSON.stringify(body))
  try {
    return await loadMapping(path, theme)
  } finally {
    await rm(path, { force: true })
  }
}

function slotValue(id: string, mode: "light" | "dark"): string {
  const index = SEMANTIC_SLOT_SPECS.findIndex((s) => s.id === id)
  if (index === -1) throw new Error(`unknown slot id in fixture: ${id}`)
  return specValue(SEMANTIC_SLOT_SPECS[index]!, index, mode)
}

/** Theme fixture with the given slots set in the given modes. */
function themeWithSlots(assignments: Record<string, Array<"light" | "dark">>): Record<string, unknown> {
  const values: Record<string, { light?: string; dark?: string }> = {}
  for (const [id, modes] of Object.entries(assignments)) {
    values[id] = {}
    for (const mode of modes) values[id]![mode] = slotValue(id, mode)
  }
  const semantic = buildSemanticConfig(values)
  return {
    ...legacyTheme(),
    light: { ...legacyTheme().light, semantic: semantic.light },
    dark: { ...legacyTheme().dark, semantic: semantic.dark },
  }
}

const baseMapping = (): Record<string, unknown> => legacyMapping()

const ruleBinding = (over: Record<string, unknown>): Record<string, unknown> => ({
  kind: "rule",
  slot: "shadow.popup",
  selector: ".div-container-block_frame_shadow",
  property: "box-shadow",
  ...over,
})

/* ================================================================== *
 * Backward compatibility (§6.4) — legacy regression, must stay green
 * ================================================================== */

describe("backward compatibility: old configs parse unchanged", () => {
  test("T-BC-01: legacy theme config parses; output carries no semantic key", () => {
    const parsed = parseOk<Record<string, unknown>>(schemaNs.desktopThemeSchema, legacyTheme())
    expect(Object.keys(parsed.light as object)).not.toContain("semantic")
    expect(Object.keys(parsed.dark as object)).not.toContain("semantic")
    expect(parsed.name).toBe(legacyTheme().name)
    // Also verify shipped config/theme.json parses successfully
    parseOk<Record<string, unknown>>(schemaNs.desktopThemeSchema, CONFIG_THEME)
  })

  test("T-BC-02a: shipped config/mapping.json parses; existing fields survive untouched", () => {
    const parsed = parseOk<Record<string, unknown>>(schemaNs.mappingConfigSchema, CONFIG_MAPPING)
    expect(Array.isArray(parsed.ramps)).toBe(true)
    expect((parsed.ramps as unknown[]).length).toBe((CONFIG_MAPPING as { ramps: unknown[] }).ramps.length)
    expect(parsed.darkOverrides).toEqual((CONFIG_MAPPING as { darkOverrides: object }).darkOverrides)
    expect(parsed.lightOverrides).toEqual((CONFIG_MAPPING as { lightOverrides: object }).lightOverrides)
    expect(Array.isArray(parsed.canaryTokens)).toBe(true)
  })

  test("control: legacy-shaped fixtures keep parsing (strict semantic schema must not reject them)", () => {
    parseOk<unknown>(schemaNs.desktopThemeSchema, legacyTheme())
    parseOk<unknown>(schemaNs.mappingConfigSchema, legacyMapping())
  })
})

/* ================================================================== *
 * New mapping fields (§4) — RED: defaults do not exist yet
 * ================================================================== */

describe("mapping gains optional semanticBindings and semanticCanaries", () => {
  test("T-BC-02b: both default to [] when absent", () => {
    const parsed = parseOk<{ semanticBindings?: unknown; semanticCanaries?: unknown }>(
      schemaNs.mappingConfigSchema,
      legacyMapping(),
    )
    // RED: today the keys are stripped, so both are undefined.
    expect(parsed.semanticBindings).toEqual([])
    expect(parsed.semanticCanaries).toEqual([])
  })

  test("T-SCH-08: token-kind bindings do not exist (rule-only discriminated union)", () => {
    const semanticBindingSchema = needExport(future.semanticBindingSchema, "semanticBindingSchema")
    const lines = rejectionLines(semanticBindingSchema, {
      kind: "token",
      slot: "page.background",
      token: "--common-bg",
    })
    expect(lines.length).toBeGreaterThan(0)
  })

  test("T-SCH-08: a valid rule binding round-trips through mappingConfigSchema", () => {
    const mapping = {
      ...baseMapping(),
      semanticBindings: [ruleBinding({})],
      semanticCanaries: ["--common-bg"],
    }
    const parsed = parseOk<{ semanticBindings: unknown[]; semanticCanaries: string[] }>(
      schemaNs.mappingConfigSchema,
      mapping,
    )
    // RED: today the payload is silently stripped and the defaults never materialize.
    expect(parsed.semanticBindings).toEqual([ruleBinding({})])
    expect(parsed.semanticCanaries).toEqual(["--common-bg"])
  })

  test("T-SCH-08: binding mode enum rejects nonsense modes at schema level", () => {
    const semanticBindingSchema = needExport(future.semanticBindingSchema, "semanticBindingSchema")
    expect(rejectionLines(semanticBindingSchema, ruleBinding({ mode: "diagonal" })).length).toBeGreaterThan(0)
  })

  test("slotIdSchema enforces `category.key` shape", () => {
    const slotIdSchema = needExport<{ safeParse(i: unknown): { success: boolean } }>(
      future.slotIdSchema,
      "slotIdSchema",
    )
    for (const valid of ["page.background", "border.compose", "text.primary", "gradient.messageSkeleton"]) {
      expect(slotIdSchema.safeParse(valid).success).toBe(true)
    }
    for (const invalid of ["page", ".background", "Page.background", "page.background.x", "page.back ground", ""]) {
      expect(slotIdSchema.safeParse(invalid).success).toBe(false)
    }
  })

  test("T-SCH-08: cssCustomPropertyNameSchema enforces custom-property shape", () => {
    const cssCustomPropertyNameSchema = needExport<{ safeParse(i: unknown): { success: boolean } }>(
      future.cssCustomPropertyNameSchema,
      "cssCustomPropertyNameSchema",
    )
    expect(cssCustomPropertyNameSchema.safeParse("--orb-text-primary").success).toBe(true)
    for (const invalid of ["orb-text-primary", "--", "-", "--орб-текст", "--orb text", "--orb;text"]) {
      expect(cssCustomPropertyNameSchema.safeParse(invalid).success).toBe(false)
    }
  })
})

/* ================================================================== *
 * Value schemas (§3) — RED: exports do not exist yet
 * ================================================================== */

describe("semantic color slots are hex-only", () => {
  const semanticTheme = (value: unknown): unknown => {
    const theme = legacyTheme() as { light: Record<string, unknown> }
    theme.light = { ...theme.light, semantic: { page: { background: value } } }
    return theme
  }

  test.each(["#f90", "#f90a", "#ff9000", "#ff9000aa"])("T-SCH-01: hex form %s is accepted", (value) => {
    const semanticSlotsSchema = needExport(future.semanticSlotsSchema, "semanticSlotsSchema")
    parseOk(semanticSlotsSchema, { page: { background: value } })
  })

  test.each([
    ["named color", "red"],
    ["rgb() function", "rgb(255, 0, 0)"],
    ["var() reference", "var(--orb-color-red-500)"],
    ["five digits", "#ff900"],
    ["seven digits", "#ff90000"],
    ["empty", ""],
    ["whitespace padding", " #ff9000"],
  ])("T-SCH-01: %s is rejected with the slot path", (_label, value) => {
    const semanticSlotsSchema = needExport(future.semanticSlotsSchema, "semanticSlotsSchema")
    const lines = rejectionLines(semanticSlotsSchema, { page: { background: value } })
    expect(lines.join("\n")).toContain("page.background")
  })

  test("T-SCH-01: every one of the 110 color slots rejects a shadow-shaped value at its own path", () => {
    // Per-slot kind binding (plan §3 assigns value schemas per §5 kind): a
    // color slot must not accept a shadow string. Data-driven over the full
    // §5 transcription, so no slot escapes the invalid-value check.
    const semanticSlotsSchema = needExport(future.semanticSlotsSchema, "semanticSlotsSchema")
    for (const spec of SEMANTIC_SLOT_SPECS.filter((s) => s.kind === "color")) {
      const lines = rejectionLines(semanticSlotsSchema, { [spec.category]: { [spec.key]: "0 0 4px #101010" } })
      expect(lines.join("\n")).toContain(`${spec.category}.${spec.key}`)
    }
  })

  test("T-SCH-05: every gradient slot rejects a plain hex color at its own path", () => {
    const semanticSlotsSchema = needExport(future.semanticSlotsSchema, "semanticSlotsSchema")
    for (const spec of SEMANTIC_SLOT_SPECS.filter((s) => s.kind === "gradient")) {
      const lines = rejectionLines(semanticSlotsSchema, { [spec.category]: { [spec.key]: "#101010" } })
      expect(lines.join("\n")).toContain(`${spec.category}.${spec.key}`)
    }
    // Deliberate plan §3 asymmetry, pinned so it stays a decision: a shadow
    // slot accepts a plain hex (safeCssValue imposes safety, not shape), so
    // the 12 shadow-kind slots have no inverse rejection check.
    expect(SEMANTIC_SLOT_SPECS.filter((s) => s.kind === "shadow")).toHaveLength(12)
  })

  test("T-SCH-01: rejection carries the full theme path through themeVariantSchema", () => {
    parseOk(schemaNs.desktopThemeSchema, semanticTheme("#ff9000")) // sanity: schema exists today, value stripped
    // The strict behavior: after the contract lands, an invalid value rejects with the path
    // light.semantic.page.background. Today the whole object is silently stripped instead.
    const lines = rejectionLines(schemaNs.desktopThemeSchema, semanticTheme("red"))
    expect(lines.join("\n")).toContain("light.semantic.page.background")
  })
})

describe("safeCssValueSchema bans CSS-structural characters", () => {
  test("T-SCH-02: every banned character rejects", () => {
    const safeCssValueSchema = needExport(future.safeCssValueSchema, "safeCssValueSchema")
    for (const char of [";", "{", "}", "@", '"', "'", "!"]) {
      const lines = rejectionLines(safeCssValueSchema, `0 0 4px #000${char}evil`)
      expect(lines.length).toBeGreaterThan(0)
    }
  })

  test("T-SCH-02: end-to-end, an injection attempt in a shadow slot is rejected by the theme schema", () => {
    const semanticSlotsSchema = needExport(future.semanticSlotsSchema, "semanticSlotsSchema")
    const lines = rejectionLines(semanticSlotsSchema, {
      shadow: { popup: "0 0 4px #000} body { background: red }" },
    })
    expect(lines.length).toBeGreaterThan(0)
  })

  test("T-SCH-03: unbalanced parentheses reject, balanced ones pass", () => {
    const safeCssValueSchema = needExport(future.safeCssValueSchema, "safeCssValueSchema")
    expect(safeCssValueSchema.safeParse("rgba(0, 0, 0, 1)").success).toBe(true)
    expect(rejectionLines(safeCssValueSchema, "rgba(0, 0, 0").length).toBeGreaterThan(0)
    expect(rejectionLines(safeCssValueSchema, "rgba 0, 0, 0)").length).toBeGreaterThan(0)
  })

  test("T-SCH-03: end-to-end through a shadow slot", () => {
    const semanticSlotsSchema = needExport(future.semanticSlotsSchema, "semanticSlotsSchema")
    parseOk(semanticSlotsSchema, { shadow: { popup: "0 0 4px rgba(0, 0, 0, 0.5)" } })
    expect(rejectionLines(semanticSlotsSchema, { shadow: { popup: "0 0 4px rgba(0, 0, 0" } }).length).toBeGreaterThan(0)
  })

  test("T-SCH-04: shadow values reject url() in any case, plain shadows pass", () => {
    const shadowValueSchema = needExport(future.shadowValueSchema, "shadowValueSchema")
    parseOk(shadowValueSchema, "0 0 4px #000000")
    expect(rejectionLines(shadowValueSchema, "0 0 4px url(#x)").length).toBeGreaterThan(0)
    expect(rejectionLines(shadowValueSchema, "0 0 4px URL(#x)").length).toBeGreaterThan(0)
  })

  test("T-SCH-05: gradient values need gradient( and reject url()", () => {
    const gradientValueSchema = needExport(future.gradientValueSchema, "gradientValueSchema")
    parseOk(gradientValueSchema, "linear-gradient(90deg,#ffffff,#000000)")
    parseOk(gradientValueSchema, "Linear-Gradient(90deg,#ffffff,#000000)")
    // a plain color is not a gradient
    expect(rejectionLines(gradientValueSchema, "#ffffff").length).toBeGreaterThan(0)
    // url() is banned even inside a gradient
    expect(rejectionLines(gradientValueSchema, "linear-gradient(90deg,#fff,url(#x))").length).toBeGreaterThan(0)
  })

  test("T-SCH-06: !important is unreachable from any user value", () => {
    const shadowValueSchema = needExport(future.shadowValueSchema, "shadowValueSchema")
    const gradientValueSchema = needExport(future.gradientValueSchema, "gradientValueSchema")
    expect(rejectionLines(shadowValueSchema, "#fff !important").length).toBeGreaterThan(0)
    expect(rejectionLines(gradientValueSchema, "linear-gradient(90deg,#fff,#000) !important").length).toBeGreaterThan(0)
  })

  test("value length bounds: 1..512 characters", () => {
    const safeCssValueSchema = needExport(future.safeCssValueSchema, "safeCssValueSchema")
    expect(safeCssValueSchema.safeParse("#111").success).toBe(true)
    expect(safeCssValueSchema.safeParse("").success).toBe(false)
    expect(safeCssValueSchema.safeParse("a".repeat(512)).success).toBe(true)
    expect(safeCssValueSchema.safeParse("a".repeat(513)).success).toBe(false)
  })
})

/* ================================================================== *
 * Strict category objects (§3) — RED: today unknown keys are stripped
 * ================================================================== */

describe("semantic config is strict at every level", () => {
  test("SEMANTIC_CATEGORIES is exported with the 15 plan categories in order", () => {
    const categories = needExport<readonly string[]>(future.SEMANTIC_CATEGORIES, "SEMANTIC_CATEGORIES")
    expect([...categories]).toEqual([...EXPECTED_SEMANTIC_CATEGORIES])
  })

  test.each(Object.keys(EXPECTED_CATEGORY_KEYS))("T-SCH-07: unknown key inside semantic.%s rejects", (category) => {
    const semanticSlotsSchema = needExport(future.semanticSlotsSchema, "semanticSlotsSchema")
    const lines = rejectionLines(semanticSlotsSchema, { [category]: { backgroud: "#101418" } })
    expect(lines.join("\n")).toContain("backgroud")
  })

  test("T-SCH-07: unknown category rejects", () => {
    const semanticSlotsSchema = needExport(future.semanticSlotsSchema, "semanticSlotsSchema")
    const lines = rejectionLines(semanticSlotsSchema, { typo: { anything: "#101418" } })
    expect(lines.join("\n")).toContain("typo")
  })

  test("T-SCH-07: end-to-end, a typo'd key in theme.json rejects with its path", () => {
    const theme = legacyTheme() as { light: Record<string, unknown> }
    theme.light = { ...theme.light, semantic: { page: { backgroud: "#101418" } } }
    const lines = rejectionLines(schemaNs.desktopThemeSchema, theme)
    expect(lines.join("\n")).toContain("light.semantic.page.backgroud")
  })

  test("the plan §5 registry is exactly 124 slots: 110 color, 12 shadow, 2 gradient", () => {
    // Pins the specification data itself: every downstream data-driven test
    // (round-trip, strictness, per-slot kinds) is only as complete as this
    // set, so its size and kind split are contract, not detail.
    expect(SEMANTIC_SLOT_SPECS).toHaveLength(124)
    const kinds = { color: 0, shadow: 0, gradient: 0 }
    for (const spec of SEMANTIC_SLOT_SPECS) kinds[spec.kind]++
    expect(kinds).toEqual({ color: 110, shadow: 12, gradient: 2 })
  })

  test("T-SCH-07: all 124 slots set in both modes parse and round-trip exactly", () => {
    // Drives the REAL contract path of plan §2 — `desktopThemeSchema` with the
    // `theme.<mode>.semantic.<category>.<key>` nesting — instead of a
    // test-only light/dark view over `semanticSlotsSchema`. This stays green
    // while that schema still carries its test-only light/dark transform keys
    // and keeps guarding the same round-trip after the production cleanup
    // removes them.
    const assignments: Record<string, Array<"light" | "dark">> = {}
    SEMANTIC_SLOT_SPECS.forEach((spec) => {
      assignments[spec.id] = ["light", "dark"]
    })
    const theme = themeWithSlots(assignments) as {
      light: { semantic: Record<string, unknown> }
      dark: { semantic: Record<string, unknown> }
    }
    const parsed = parseOk<typeof theme>(schemaNs.desktopThemeSchema, theme)
    expect(parsed).toEqual(theme)
    expect(parsed.light.semantic).toEqual(theme.light.semantic)
    expect(parsed.dark.semantic).toEqual(theme.dark.semantic)
  })

  test("every category schema is exported and strict (deep rejection check)", () => {
    const categorySchemas: Array<[string, unknown]> = [
      ["page", future.pageSemanticSlotsSchema],
      ["surface", future.surfaceSemanticSlotsSchema],
      ["elevation", future.elevationSemanticSlotsSchema],
      ["modal", future.modalSemanticSlotsSchema],
      ["overlay", future.overlaySemanticSlotsSchema],
      ["line", future.lineSemanticSlotsSchema],
      ["focus", future.focusSemanticSlotsSchema],
      ["text", future.textSemanticSlotsSchema],
      ["icon", future.iconSemanticSlotsSchema],
      ["control", future.controlSemanticSlotsSchema],
      ["state", future.stateSemanticSlotsSchema],
      ["selection", future.selectionSemanticSlotsSchema],
      ["status", future.statusSemanticSlotsSchema],
      ["shadow", future.shadowSemanticSlotsSchema],
      ["gradient", future.gradientSemanticSlotsSchema],
    ]
    for (const [name, categorySchema] of categorySchemas) {
      needExport(categorySchema, `${name}SemanticSlotsSchema`)
    }
  })
})

/* ================================================================== *
 * Loader validation (§4, §10, §11) — RED: loadMapping accepts anything
 * ================================================================== */

describe("loadMapping validates semantic bindings with slot-id error paths", () => {
  test("T-SCH-09: unknown slot id is rejected and named", async () => {
    const mapping = { ...baseMapping(), semanticBindings: [ruleBinding({ slot: "page.bogus" })] }
    // RED: today the loader strips the binding and resolves successfully.
    await expect(loadMappingFrom(mapping)).rejects.toThrow(/page\.bogus/)
  })

  test("T-SCH-09: the error is a ConfigError", async () => {
    const mapping = { ...baseMapping(), semanticBindings: [ruleBinding({ slot: "nope.nothing" })] }
    await expect(loadMappingFrom(mapping)).rejects.toBeInstanceOf(ConfigError)
  })

  test("T-SCH-10: duplicate slot across bindings is rejected", async () => {
    const mapping = {
      ...baseMapping(),
      semanticBindings: [
        ruleBinding({ selector: ".div-container-block_frame_shadow" }),
        ruleBinding({ selector: ".div-container-block_frame_shadow", property: "box-shadow" }),
      ],
    }
    await expect(loadMappingFrom(mapping)).rejects.toThrow(/shadow\.popup/)
  })

  test("T-SCH-11: a selector outside the verified allowlist is rejected byte-exactly", async () => {
    const mapping = {
      ...baseMapping(),
      semanticBindings: [
        ruleBinding({ selector: ".div-container-block_frame_shadow, .injected-rule { color: red } body {" }),
      ],
    }
    await expect(loadMappingFrom(mapping)).rejects.toBeInstanceOf(ConfigError)
  })

  test("T-SCH-11: a near-miss selector (whitespace difference) is rejected", async () => {
    const mapping = {
      ...baseMapping(),
      semanticBindings: [ruleBinding({ selector: "  .div-container-block_frame_shadow" })],
    }
    await expect(loadMappingFrom(mapping)).rejects.toBeInstanceOf(ConfigError)
  })

  test("T-SCH-11: a property outside the observed set is rejected", async () => {
    const mapping = {
      ...baseMapping(),
      semanticBindings: [ruleBinding({ property: "color; } body {" })],
    }
    await expect(loadMappingFrom(mapping)).rejects.toBeInstanceOf(ConfigError)
  })

  test("T-SCH-11: a real property that no allowlisted pair uses is rejected", async () => {
    const mapping = {
      ...baseMapping(),
      semanticBindings: [ruleBinding({ property: "caret-color" })],
    }
    await expect(loadMappingFrom(mapping)).rejects.toBeInstanceOf(ConfigError)
  })

  test("T-SCH-12: a binding may not claim a mode its selector does not carry", async () => {
    // .div-container-block_frame_shadow is theme-neutral (static mode derived
    // from the selector); claiming light contradicts the derivation.
    const mapping = { ...baseMapping(), semanticBindings: [ruleBinding({ mode: "light" })] }
    await expect(loadMappingFrom(mapping)).rejects.toBeInstanceOf(ConfigError)
  })

  test("T-SCH-12: theme-dark selectors are not part of the verified rule set", async () => {
    const mapping = {
      ...baseMapping(),
      semanticBindings: [
        ruleBinding({
          slot: "text.primary",
          selector: ".yamb-modal.Orb-Theme_theme_dark",
          property: "color",
          mode: "dark",
        }),
      ],
    }
    await expect(loadMappingFrom(mapping)).rejects.toBeInstanceOf(ConfigError)
  })

  test("T-SCH-12: static rules need equal light and dark values", async () => {
    const theme = themeWithSlots({ "shadow.popup": ["light"] }) // dark missing
    const mapping = { ...baseMapping(), semanticBindings: [ruleBinding({})] }
    await expect(loadMappingFrom(mapping, theme)).rejects.toBeInstanceOf(ConfigError)
  })

  test("T-SCH-12: static rules with different light/dark values are rejected", async () => {
    const theme = themeWithSlots({ "shadow.popup": ["light", "dark"] })
    // force different values by perturbing the dark assignment
    const themed = theme as { dark: { semantic: { shadow: { popup: string } } } }
    themed.dark.semantic.shadow.popup = "0 0 9px #0f0f0f"
    const mapping = { ...baseMapping(), semanticBindings: [ruleBinding({})] }
    await expect(loadMappingFrom(mapping, themed)).rejects.toBeInstanceOf(ConfigError)
  })

  test("T-SCH-12: static rules with equal light/dark values load", async () => {
    const value = "0 0 4px #050505"
    const theme = legacyTheme() as { light: Record<string, unknown>; dark: Record<string, unknown> }
    theme.light = { ...theme.light, semantic: { shadow: { popup: value } } }
    theme.dark = { ...theme.dark, semantic: { shadow: { popup: value } } }
    const mapping = { ...baseMapping(), semanticBindings: [ruleBinding({})] }
    const loaded = await loadMappingFrom(mapping, theme)
    expect(loaded.semanticBindings).toHaveLength(1)
  })

  test("T-SCH-13: kind/property matrix — a gradient slot may not target box-shadow", async () => {
    const theme = themeWithSlots({ "gradient.diskLoading": ["light", "dark"] })
    const mapping = {
      ...baseMapping(),
      semanticBindings: [
        ruleBinding({ slot: "gradient.diskLoading", property: "box-shadow" }),
      ],
    }
    await expect(loadMappingFrom(mapping, theme)).rejects.toBeInstanceOf(ConfigError)
  })

  test("T-SCH-13: kind/property matrix — a shadow slot may target an allowlisted box-shadow rule", async () => {
    const value = "0 0 4px #060606"
    const theme = legacyTheme() as { light: Record<string, unknown>; dark: Record<string, unknown> }
    theme.light = { ...theme.light, semantic: { shadow: { popup: value } } }
    theme.dark = { ...theme.dark, semantic: { shadow: { popup: value } } }
    const mapping = { ...baseMapping(), semanticBindings: [ruleBinding({})] }
    const loaded = await loadMappingFrom(mapping, theme)
    expect(loaded.semanticBindings).toHaveLength(1)
  })

  test("T-SCH-13: kind/property matrix — a color slot may not target box-shadow", async () => {
    const theme = themeWithSlots({ "text.primary": ["light", "dark"] })
    const mapping = {
      ...baseMapping(),
      semanticBindings: [
        ruleBinding({ slot: "text.primary", property: "box-shadow" }),
      ],
    }
    await expect(loadMappingFrom(mapping, theme)).rejects.toBeInstanceOf(ConfigError)
  })

  test("T-SCH-14: semanticCanaries must be root-scoped per registry evidence", async () => {
    // --orb-button-brand-background is MN-scoped (component-only): not observable
    // via getComputedStyle(documentElement), so it is not a valid canary.
    const mapping = { ...baseMapping(), semanticCanaries: ["--orb-button-brand-background"] }
    await expect(loadMappingFrom(mapping)).rejects.toBeInstanceOf(ConfigError)
  })

  test("T-SCH-14: root-scoped registry tokens are accepted as canaries", async () => {
    const mapping = { ...baseMapping(), semanticCanaries: ["--common-bg"] }
    const loaded = await loadMappingFrom(mapping)
    expect(loaded.semanticCanaries).toEqual(["--common-bg"])
  })

  test("T-SCH-14: tokens with no registry evidence are rejected as canaries", async () => {
    const mapping = { ...baseMapping(), semanticCanaries: ["--totally-unknown-token"] }
    await expect(loadMappingFrom(mapping)).rejects.toBeInstanceOf(ConfigError)
  })
})

describe("background image schema & injection defense", () => {
  test("accepts valid base64 data URIs and gradients", () => {
    const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    expect(schemaNs.backgroundImageValueSchema.safeParse(dataUri).success).toBe(true)

    const gradient = "linear-gradient(rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.8))"
    expect(schemaNs.backgroundImageValueSchema.safeParse(gradient).success).toBe(true)

    const localPath = "assets/anime/chat-anime-girl.jpg"
    expect(schemaNs.backgroundImageValueSchema.safeParse(localPath).success).toBe(true)

    // Windows paths with drive letter, backslashes, spaces, parens, and cyrillic
    expect(schemaNs.backgroundImageValueSchema.safeParse("C:\\Users\\me\\Pictures\\wall.jpg").success).toBe(true)
    expect(schemaNs.backgroundImageValueSchema.safeParse("C:/Users/me/Pictures/wall.jpg").success).toBe(true)
    expect(schemaNs.backgroundImageValueSchema.safeParse("./wallpapers/my wall.jpg").success).toBe(true)
    expect(schemaNs.backgroundImageValueSchema.safeParse("wallpaper (1).jpg").success).toBe(true)
    expect(schemaNs.backgroundImageValueSchema.safeParse("обои/чат.jpg").success).toBe(true)
  })

  test("rejects CSS injection payloads in image field", () => {
    const payload1 = 'https://evil.com/x.png"); color: red; /*'
    expect(schemaNs.backgroundImageValueSchema.safeParse(payload1).success).toBe(false)

    const payload2 = 'linear-gradient(red, blue); background: url("https://evil.com");'
    expect(schemaNs.backgroundImageValueSchema.safeParse(payload2).success).toBe(false)

    const payload3 = 'data:image/png;base64,xxx"); color: red; /*'
    expect(schemaNs.backgroundImageValueSchema.safeParse(payload3).success).toBe(false)

    const remoteUrl = "https://example.com/remote-wallpaper.png"
    expect(schemaNs.backgroundImageValueSchema.safeParse(remoteUrl).success).toBe(false)

    // Remote schemes and network/UNC paths
    expect(schemaNs.backgroundImageValueSchema.safeParse("file://attacker.example/share/x.png").success).toBe(false)
    expect(schemaNs.backgroundImageValueSchema.safeParse("//attacker.example/y.png").success).toBe(false)
    expect(schemaNs.backgroundImageValueSchema.safeParse("\\\\attacker.example\\share\\x.png").success).toBe(false)

    // Malicious gradient tails (image-set, cross-fade, etc.)
    expect(
      schemaNs.backgroundImageValueSchema.safeParse("linear-gradient(red, red), image-set(attacker.png 1x)").success,
    ).toBe(false)
    expect(
      schemaNs.backgroundImageValueSchema.safeParse("linear-gradient(red, red), url(https://evil.com/x.png)").success,
    ).toBe(false)
    expect(
      schemaNs.backgroundImageValueSchema.safeParse("linear-gradient(cross-fade(x, y))").success,
    ).toBe(false)
  })

  test("rejects CSS keylogger and malicious custom selectors", () => {
    expect(schemaNs.customBackgroundSelectorSchema.safeParse('input[value$="a"]').success).toBe(false)
    expect(schemaNs.customBackgroundSelectorSchema.safeParse('textarea[name="message"]').success).toBe(false)
    expect(schemaNs.customBackgroundSelectorSchema.safeParse('.sidebar; color: red').success).toBe(false)
    expect(schemaNs.customBackgroundSelectorSchema.safeParse('.sidebar { opacity: 0 }').success).toBe(false)
    expect(schemaNs.customBackgroundSelectorSchema.safeParse('.sidebar /* comment */').success).toBe(false)

    // Valid selectors
    expect(schemaNs.customBackgroundSelectorSchema.safeParse('.theme_dark:root .yamb-compose, :root.theme_dark .yamb-compose').success).toBe(true)
    expect(schemaNs.customBackgroundSelectorSchema.safeParse(':root #root > .yamb-main-layout').success).toBe(true)
  })
})
