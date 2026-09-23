/**
 * RED contract tests for the buildCss semantic emission (bead tto-6ia.3).
 *
 * Specification: `.beads/artifacts/tto-6ia.2/plan.md` §6 (fallback precedence),
 * §8 (theme_auto), §9 (scope matrix), §10 (rule bindings), §12 (canonical order
 * and rule ids) and the §17 matrix rows T-BC-03, T-EMIT-01..04, T-AUTO-01..04
 * and T-DET-01..04. All slot/scoped data comes from the test-owned transcript
 * `src/theme/semantic-slots.testdata.ts`; the not-yet-implemented registry
 * module (`src/theme/semantic-slots.ts`) is never imported.
 *
 * Against the current `src/theme/generate.ts` these tests fail in exactly the
 * following expected ways:
 *
 *   1. MISSING SEMANTIC SECTIONS — buildCss ignores `theme.light/dark.semantic`,
 *      so no plan §9 scope block ever exists and every per-slot declaration
 *      lookup fails with "expected exactly one top-level scope block ...".
 *   2. MISSING RULE SECTIONS — buildCss ignores `mapping.semanticBindings`, so
 *      no `semantic.<slot>.<mode>` tto rule-id comment or rule body is emitted.
 *   3. AUTO GAP — dark raw overrides never reach the
 *      `@media (prefers-color-scheme: dark)` block (the §6.4/§8 documented fix).
 *   4. ORDERING — the §12 canonical chain cannot be satisfied while semantic
 *      and rule sections are absent (raw overrides still sit before rules).
 *
 * Tests tagged "control" pass today on purpose and pin behavior the semantic
 * emitter (tto-6ia.4) must not break: legacy byte-identity of the ramp-only
 * sheet (§6.4 branch 1), build determinism, ramps unperturbed by semantics,
 * no timestamps, no !important, no currentColor rewriting, no ::selection,
 * no light media block, and REF/MN tokens never reaching component compounds.
 *
 * Selector/property allowlist REJECTION of unaudited bindings is owned by
 * loadMapping (covered by src/schema.test.ts T-SCH-11..13). This file pins the
 * generator side: byte-exact emission of verified pairs only, taken verbatim
 * from reports/telemost_ui_color_inventory.json (literal-color /
 * full-value-replacement occurrences) and the plan §5.14/§10 gradient contexts.
 *
 * Run: bun test src/theme/generate.test.ts
 */

import { describe, expect, test } from "bun:test"
import { desktopThemeSchema, mappingConfigSchema } from "../schema"
import { buildCss } from "./generate"
import {
  BRAND_COMPOUNDS,
  EXPECTED_SEMANTIC_CATEGORIES,
  MERGE_NOTICE_COMPOUNDS,
  SCOPE_SELECTORS,
  SEMANTIC_SLOT_SPECS,
  buildSemanticConfig,
  specValue,
  type ScopeClass,
  type SemanticSlotSpec,
  type ThemeMode,
} from "./semantic-slots.testdata"

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

/** Legacy-shaped theme: no `semantic` key anywhere (like the shipped config). */
function legacyTheme(): Record<string, unknown> {
  return {
    name: "Fixture",
    id: "fixture",
    light: { seeds: SEEDS, accentScale: ACCENT_SCALE },
    dark: { seeds: SEEDS, accentScale: ACCENT_SCALE },
  }
}

/**
 * Legacy-shaped mapping plus the new optional fields at their defaults.
 * Extra keys ride through the cast below; post-tto-6ia.4 they are real schema
 * fields and `[]` stays byte-neutral for the legacy golden.
 */
function legacyMapping(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    description: "fixture mapping",
    ramps: [{ family: "ya-telemost", seed: "interactive", alphaSource: 700, emitLightTrio: true }],
    darkOverrides: {},
    lightOverrides: {},
    canaryTokens: ["--orb-surface-brand"],
    semanticBindings: [],
    semanticCanaries: [],
    ...over,
  }
}

type SlotValue = { light?: string; dark?: string }
type Assignments = Record<string, SlotValue>

interface RuleBindingInput {
  kind: "rule"
  slot: string
  selector: string
  property: string
  mode?: "light" | "dark" | "static"
}

/** Theme fixture carrying the given semantic assignments. */
function themeWith(assignments: Assignments): Record<string, unknown> {
  const semantic = buildSemanticConfig(assignments)
  const base = legacyTheme() as { light: Record<string, unknown>; dark: Record<string, unknown> }
  return {
    ...base,
    light: semantic.light ? { ...base.light, semantic: semantic.light } : base.light,
    dark: semantic.dark ? { ...base.dark, semantic: semantic.dark } : base.dark,
  }
}

/** Runs buildCss over the assignments (+ optional mapping/theme overrides). */
function emit(assignments: Assignments, over: { mapping?: Record<string, unknown> } = {}): string {
  const rawTheme = themeWith(assignments)
  const theme = desktopThemeSchema.parse(rawTheme)
  const rawMapping = over.mapping ?? legacyMapping()
  const mapping = mappingConfigSchema.parse(rawMapping)
  return buildCss({ theme, mapping })
}

function slotById(id: string): SemanticSlotSpec {
  const spec = SEMANTIC_SLOT_SPECS.find((s) => s.id === id)
  if (!spec) throw new Error(`unknown slot id in fixture: ${id}`)
  return spec
}

/** The unique contract value for a slot in a mode (testdata builder). */
function valueFor(id: string, mode: ThemeMode): string {
  const spec = slotById(id)
  return specValue(spec, SEMANTIC_SLOT_SPECS.indexOf(spec), mode)
}

function setBoth(id: string): SlotValue {
  return { light: valueFor(id, "light"), dark: valueFor(id, "dark") }
}

/** All 124 slots with independent unique light/dark values. */
const ALL_SLOTS_BOTH_MODES: Assignments = Object.fromEntries(
  SEMANTIC_SLOT_SPECS.map((spec) => [spec.id, setBoth(spec.id)]),
)

/* ------------------------------------------------------------------ *
 * Legacy golden — pinned bytes of the pre-semantic buildCss output
 * ------------------------------------------------------------------ */

/**
 * The exact sheet the current (pre-semantic) buildCss produces for the legacy
 * fixture above. Frozen as a literal so tto-6ia.4 cannot silently shift the
 * ramp-only bytes (plan §6.4 branch 1). Regenerate only by re-running the
 * fixture through the pre-semantic generator and re-pasting the JSON literal.
 */
const GOLDEN_LEGACY = "/* ============================================================\n * telemost-theme-override — Fixture (fixture)\n * fixture mapping\n * Generated at runtime. Telemost files are never modified.\n * ============================================================ */\n\n:root {\n  --orb-color-ya-telemost-100: #f5faff;\n  --orb-color-ya-telemost-150: #ebf3ff;\n  --orb-color-ya-telemost-200: #daeaff;\n  --orb-color-ya-telemost-250: #cde3ff;\n  --orb-color-ya-telemost-300: #c4ddff;\n  --orb-color-ya-telemost-400: #b2d1ff;\n  --orb-color-ya-telemost-500: #9cc2ff;\n  --orb-color-ya-telemost-600: #7cabff;\n  --orb-color-ya-telemost-700: #5a93ff;\n  --orb-color-ya-telemost-800: #3173ff;\n  --orb-color-ya-telemost-850: #064fff;\n  --orb-color-ya-telemost-900: #0a3bb4;\n  --orb-color-ya-telemost-950: #001050;\n  --orb-color-ya-telemost-1000: #00001b;\n  --orb-color-ya-telemost-alpha-100: #5a93ff1a;\n  --orb-color-ya-telemost-alpha-150: #5a93ff21;\n  --orb-color-ya-telemost-alpha-200: #5a93ff33;\n  --orb-color-ya-telemost-alpha-250: #5a93ff4d;\n  --orb-color-ya-telemost-alpha-300: #5a93ff66;\n  --orb-color-ya-telemost-alpha-400: #5a93ff99;\n  --orb-color-ya-telemost-alpha-500: #5a93ffcc;\n  --orb-color-ya-telemost-light-400: #d0e4ff;\n  --orb-color-ya-telemost-light-500: #b9d6ff;\n  --orb-color-ya-telemost-light-600: #95bfff;\n}\n\n:root.theme_dark, .theme_dark:root {\n  --orb-color-ya-telemost-100: #f5faff;\n  --orb-color-ya-telemost-150: #ebf3ff;\n  --orb-color-ya-telemost-200: #daeaff;\n  --orb-color-ya-telemost-250: #cde3ff;\n  --orb-color-ya-telemost-300: #c4ddff;\n  --orb-color-ya-telemost-400: #b2d1ff;\n  --orb-color-ya-telemost-500: #9cc2ff;\n  --orb-color-ya-telemost-600: #7cabff;\n  --orb-color-ya-telemost-700: #5a93ff;\n  --orb-color-ya-telemost-800: #3173ff;\n  --orb-color-ya-telemost-850: #064fff;\n  --orb-color-ya-telemost-900: #0a3bb4;\n  --orb-color-ya-telemost-950: #001050;\n  --orb-color-ya-telemost-1000: #00001b;\n  --orb-color-ya-telemost-alpha-100: #5a93ff1a;\n  --orb-color-ya-telemost-alpha-150: #5a93ff21;\n  --orb-color-ya-telemost-alpha-200: #5a93ff33;\n  --orb-color-ya-telemost-alpha-250: #5a93ff4d;\n  --orb-color-ya-telemost-alpha-300: #5a93ff66;\n  --orb-color-ya-telemost-alpha-400: #5a93ff99;\n  --orb-color-ya-telemost-alpha-500: #5a93ffcc;\n  --orb-color-ya-telemost-light-400: #d0e4ff;\n  --orb-color-ya-telemost-light-500: #b9d6ff;\n  --orb-color-ya-telemost-light-600: #95bfff;\n}\n\n@media (prefers-color-scheme: dark) {\n  :root.theme_auto {\n    --orb-color-ya-telemost-100: #f5faff;\n    --orb-color-ya-telemost-150: #ebf3ff;\n    --orb-color-ya-telemost-200: #daeaff;\n    --orb-color-ya-telemost-250: #cde3ff;\n    --orb-color-ya-telemost-300: #c4ddff;\n    --orb-color-ya-telemost-400: #b2d1ff;\n    --orb-color-ya-telemost-500: #9cc2ff;\n    --orb-color-ya-telemost-600: #7cabff;\n    --orb-color-ya-telemost-700: #5a93ff;\n    --orb-color-ya-telemost-800: #3173ff;\n    --orb-color-ya-telemost-850: #064fff;\n    --orb-color-ya-telemost-900: #0a3bb4;\n    --orb-color-ya-telemost-950: #001050;\n    --orb-color-ya-telemost-1000: #00001b;\n    --orb-color-ya-telemost-alpha-100: #5a93ff1a;\n    --orb-color-ya-telemost-alpha-150: #5a93ff21;\n    --orb-color-ya-telemost-alpha-200: #5a93ff33;\n    --orb-color-ya-telemost-alpha-250: #5a93ff4d;\n    --orb-color-ya-telemost-alpha-300: #5a93ff66;\n    --orb-color-ya-telemost-alpha-400: #5a93ff99;\n    --orb-color-ya-telemost-alpha-500: #5a93ffcc;\n    --orb-color-ya-telemost-light-400: #d0e4ff;\n    --orb-color-ya-telemost-light-500: #b9d6ff;\n    --orb-color-ya-telemost-light-600: #95bfff;\n  }\n}\n" as string

const GOLDEN_NODES = parseCss(GOLDEN_LEGACY)

/* ------------------------------------------------------------------ *
 * Minimal CSS block parser (the generated format is line-based and free
 * of braces inside values — user values ban ; { } @ " ' ! by schema).
 * ------------------------------------------------------------------ */

interface CssNode {
  selector: string
  selectorList: string[]
  /** [property, value] pairs of the declarations directly inside the block. */
  decls: Array<[string, string]>
  /** Index of the "{" in the source. */
  start: number
  /** Index of the matching "}". */
  end: number
  mediaParent: CssNode | null
}

function parseCss(css: string): CssNode[] {
  // Mask comment bodies with same-length whitespace so block selectors are
  // clean while node start/end offsets stay valid against the raw sheet
  // (rule-id comment positions come from separate matchAll on the original).
  const masked = css.replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
  css = masked
  const nodes: CssNode[] = []
  const stack: CssNode[] = []
  let buf = ""
  for (let i = 0; i < css.length; i++) {
    const ch = css[i]
    if (ch === "{") {
      const parent = stack.length > 0 ? stack[stack.length - 1]! : null
      const node: CssNode = { selector: buf.trim(), selectorList: [], decls: [], start: i, end: -1, mediaParent: parent }
      node.selectorList = node.selector.split(",").map((s) => s.trim())
      nodes.push(node)
      stack.push(node)
      buf = ""
    } else if (ch === "}") {
      const node = stack.pop()
      if (node) {
        node.end = i
        node.decls = buf
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.endsWith(";"))
          .map((line) => {
            const colon = line.indexOf(":")
            return [line.slice(0, colon).trim(), line.slice(colon + 1).trim().replace(/;$/, "")] as [string, string]
          })
      }
      buf = ""
    } else {
      buf += ch
    }
  }
  return nodes
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i])
}

function parse(css: string): CssNode[] {
  const nodes = parseCss(css)
  if (nodes.length === 0) throw new Error("test bug: produced unparseable (empty) CSS")
  return nodes
}

/** Exactly one top-level §9 scope block of the right class declaring the token. */
function requireScopeBlock(nodes: CssNode[], spec: SemanticSlotSpec, mode: ThemeMode): CssNode {
  const list = SCOPE_SELECTORS[spec.scopeClass][mode]
  const matches = nodes.filter(
    (n) => n.mediaParent === null && sameList(n.selectorList, list) && n.decls.some(([name]) => name === spec.token),
  )
  if (matches.length !== 1) {
    throw new Error(
      `RED by design (missing semantic sections): expected exactly one scope block with selector list ` +
        `[${list.join(", ")}] declaring ${spec.token} for slot ${spec.id} in ${mode} mode, found ${matches.length}`,
    )
  }
  return matches[0]!
}

function declOf(node: CssNode, token: string): string {
  const decl = node.decls.find(([name]) => name === token)
  if (!decl) throw new Error(`block [${node.selector}] has no declaration for ${token}`)
  return decl[1]
}

function findBlock(nodes: CssNode[], selectorList: readonly string[], token: string): CssNode | undefined {
  return nodes.find((n) => sameList(n.selectorList, selectorList) && n.decls.some(([name]) => name === token))
}

function requireBlock(nodes: CssNode[], selectorList: readonly string[], token: string, label: string): CssNode {
  const node = findBlock(nodes, selectorList, token)
  if (!node) {
    throw new Error(`RED by design: no block with selector list [${selectorList.join(", ")}] declares ${token} (${label})`)
  }
  return node
}

const RULE_COMMENT = /\/\* tto: (semantic\.[a-z]+\.[a-zA-Z0-9]+\.(?:light|dark|static)) \*\//g

function ruleComments(css: string): Array<{ id: string; index: number }> {
  return [...css.matchAll(RULE_COMMENT)].map((m) => ({ id: m[1]!, index: m.index! }))
}

function requireMediaNode(nodes: CssNode[]): CssNode {
  const media = nodes.find((n) => n.selector.startsWith("@media"))
  if (!media) throw new Error("RED by design: no @media block in output")
  return media
}

/* ------------------------------------------------------------------ *
 * Selector-list shorthands (exactly as the current buildCss emits them)
 * ------------------------------------------------------------------ */

const RAMP_PROBE = "--orb-color-ya-telemost-100"
const LIGHT_RAMP_SEL = [":root"]
const DARK_RAMP_SEL = [":root.theme_dark", ".theme_dark:root"]
const AUTO_RAMP_SEL = [":root.theme_auto"]
const RAW_LIGHT_SEL = [":root", ":root.brand_telemost"]
const RAW_DARK_SEL = [":root.theme_dark", ".theme_dark:root", ".theme_dark:root.brand_telemost"]
const AUTO_R_SEL = [":root.theme_auto"]
const AUTO_RB_SEL = [":root.theme_auto", ":root.theme_auto.brand_telemost", ":root.theme_auto.Orb-Brand_brand_telemost"]

/* ================================================================== *
 * §6.4 Legacy byte compatibility — control + documented auto fix
 * ================================================================== */

describe("legacy output compatibility (§6.4, T-BC-03)", () => {
  test("control T-BC-03a: legacy inputs reproduce the pinned pre-semantic bytes", () => {
    const css = emit({})
    expect(css).toBe(GOLDEN_LEGACY)
  })

  test("control T-DET-01: two builds from identical inputs are byte-identical", () => {
    expect(emit(ALL_SLOTS_BOTH_MODES)).toBe(emit(ALL_SLOTS_BOTH_MODES))
  })

  test("T-BC-03b / T-AUTO-03: non-empty darkOverrides reach the dark theme_auto media block", () => {
    const css = emit({}, { mapping: legacyMapping({ darkOverrides: { "--common-divider": "#333333" } }) })
    const nodes = parse(css)

    // The pre-existing top-level dark override block stays.
    const top = requireBlock(nodes, RAW_DARK_SEL, "--common-divider", "top-level dark overrides")
    expect(declOf(top, "--common-divider")).toBe("#333333")
    expect(top.mediaParent).toBeNull()

    // §8 item 4 — the documented gap fix: the media block re-declares it on
    // the theme_auto scopes so OS-dark users finally receive raw overrides.
    const media = requireMediaNode(nodes)
    const autoRaw = nodes.filter(
      (n) =>
        n.mediaParent === media &&
        n.decls.some(([name, value]) => name === "--common-divider" && value === "#333333"),
    )
    if (autoRaw.length === 0) {
      throw new Error(
        "RED by design (auto gap, §6.4/§8.4): darkOverrides never reach the @media (prefers-color-scheme: dark) block",
      )
    }
    for (const node of autoRaw) {
      for (const selector of node.selectorList) expect(selector).toContain("theme_auto")
    }
  })
})

/* ================================================================== *
 * §5/§9/§12 Slot emission — data-driven over the full registry
 * ================================================================== */

describe("every semantic slot emits its registry declaration (T-EMIT-01/02)", () => {
  test("data-driven: all 124 slots in both modes land on their registry token inside their exact §9 scope blocks", () => {
    const nodes = parse(emit(ALL_SLOTS_BOTH_MODES))
    const failures: string[] = []
    for (const spec of SEMANTIC_SLOT_SPECS) {
      for (const mode of ["light", "dark"] as const) {
        const list = SCOPE_SELECTORS[spec.scopeClass][mode]
        const expected = specValue(spec, SEMANTIC_SLOT_SPECS.indexOf(spec), mode)
        const blocks = nodes.filter(
          (n) => n.mediaParent === null && sameList(n.selectorList, list) && n.decls.some(([name]) => name === spec.token),
        )
        if (blocks.length !== 1) {
          failures.push(
            `${spec.id}[${mode}]: ${blocks.length} scope blocks (want 1) of class ${spec.scopeClass} ` +
              `[${list[0]}, … ${list.length} selectors total] declaring ${spec.token}`,
          )
        } else {
          const actual = declOf(blocks[0]!, spec.token)
          if (actual !== expected) failures.push(`${spec.id}[${mode}]: expected ${spec.token}: ${expected}, got ${actual}`)
        }
      }
    }
    expect(failures).toEqual([])
  })

  test("T-EMIT-02: unset slots emit nothing — no token, no scope block", () => {
    const only = { "surface.generic": { light: valueFor("surface.generic", "light") } }
    const nodes = parse(emit(only))

    // RED part: the set slot must appear.
    const block = requireScopeBlock(nodes, slotById("surface.generic"), "light")
    expect(declOf(block, "--orb-surface-generic")).toBe(valueFor("surface.generic", "light"))

    // Every other registry token must be absent from the whole sheet.
    const leaked: string[] = []
    const declared = new Set(nodes.flatMap((n) => n.decls.map(([name]) => name)))
    for (const spec of SEMANTIC_SLOT_SPECS) {
      if (spec.id === "surface.generic") continue
      if (declared.has(spec.token)) leaked.push(spec.token)
    }
    expect(leaked).toEqual([])
  })

  test("T-EMIT-03: no cross-mode fallback — dark-only slot leaves every light scope untouched", () => {
    const darkValue = valueFor("text.primary", "dark")
    const nodes = parse(emit({ "text.primary": { dark: darkValue } }))

    // No light-rooted scope (any selector list containing plain ":root")
    // may declare the token — a light fallback would fight the stock value.
    const leaked = nodes.filter(
      (n) => n.mediaParent === null && n.selectorList.includes(":root") && n.decls.some(([name]) => name === "--orb-text-primary"),
    )
    expect(leaked.map((n) => n.selector)).toEqual([])

    // RED part: the dark root scope carries the value.
    const block = requireScopeBlock(nodes, slotById("text.primary"), "dark")
    expect(declOf(block, "--orb-text-primary")).toBe(darkValue)
  })
})

/* ================================================================== *
 * §7 Values are consumed verbatim — no OKLCH re-derivation
 * ================================================================== */

describe("slot values pass through verbatim (§7)", () => {
  test("exact light/dark values byte-exact; ramps stay byte-identical to the legacy build", () => {
    const css = emit({ "text.primary": { light: "#102030", dark: "#f0e0d0" } })
    const nodes = parse(css)

    const lightBlock = requireScopeBlock(nodes, slotById("text.primary"), "light")
    expect(declOf(lightBlock, "--orb-text-primary")).toBe("#102030")
    const darkBlock = requireScopeBlock(nodes, slotById("text.primary"), "dark")
    expect(declOf(darkBlock, "--orb-text-primary")).toBe("#f0e0d0")

    // Control: adding semantics must not perturb the OKLCH-derived ramps.
    for (const [label, sel, insideMedia] of [
      ["light ramps", LIGHT_RAMP_SEL, false],
      ["dark ramps", DARK_RAMP_SEL, false],
      ["auto ramps", AUTO_RAMP_SEL, true],
    ] as const) {
      const fresh = findBlock(nodes, sel, RAMP_PROBE)
      const golden = findBlock(GOLDEN_NODES, sel, RAMP_PROBE)
      if (!fresh || !golden) throw new Error(`test bug: ramp block missing (${label})`)
      expect(fresh.mediaParent !== null).toBe(insideMedia)
      expect([fresh.selector, fresh.decls]).toEqual([golden.selector, golden.decls])
    }
  })
})

/* ================================================================== *
 * §9 Scope matrix — exact selector lists per scope class
 * ================================================================== */

const SCOPE_SLOT: Record<ScopeClass, string> = {
  R: "surface.generic",
  RB: "text.link",
  RC: "page.background",
  RBC: "control.brandSurface",
  MN: "control.buttonBrand",
  REF: "selection.calendarCell",
}
const SCOPE_REPRESENTATIVES = Object.entries(SCOPE_SLOT) as Array<[ScopeClass, string]>

describe("scope matrix emission (§9, T-EMIT-01)", () => {
  test.each(SCOPE_REPRESENTATIVES)("%s: %s emits on the exact §9 selector lists", (_scopeClass, slot) => {
    const spec = slotById(slot)
    const nodes = parse(emit({ [slot]: setBoth(slot) }))
    for (const mode of ["light", "dark"] as const) {
      const block = requireScopeBlock(nodes, spec, mode)
      expect(declOf(block, spec.token)).toBe(valueFor(slot, mode))
    }
  })

  test("control: REF slots never reach brand, component or merge-notice compounds", () => {
    const spec = slotById("selection.calendarCell")
    const nodes = parse(emit(ALL_SLOTS_BOTH_MODES))
    const compounds = [...BRAND_COMPOUNDS, ...MERGE_NOTICE_COMPOUNDS]
    const offenders = nodes.filter(
      (n) =>
        n.decls.some(([name]) => name === spec.token) &&
        n.selectorList.some((selector) => compounds.some((c) => selector.includes(c))),
    )
    expect(offenders.map((n) => n.selector)).toEqual([])
  })
})

/* ================================================================== *
 * §5.13/§5.14 Shadow and gradient slots are full-value slots
 * ================================================================== */

describe("shadow and gradient slots emit full values verbatim", () => {
  test("shadow values (including 'none') and gradient() strings are byte-exact", () => {
    const assignments: Assignments = {
      "shadow.popup": { dark: "0 4px 16px #10131a" },
      "shadow.cardNeutral": { light: "none" },
      "gradient.messageSkeleton": { light: "linear-gradient(90deg,#102030,#f0e0d0)" },
    }
    const nodes = parse(emit(assignments))

    const popup = requireScopeBlock(nodes, slotById("shadow.popup"), "dark")
    expect(declOf(popup, "--ui-popup-shadow")).toBe("0 4px 16px #10131a")
    const neutral = requireScopeBlock(nodes, slotById("shadow.cardNeutral"), "light")
    expect(declOf(neutral, "--ui-card-neutral-box-shadow")).toBe("none")
    const skeleton = requireScopeBlock(nodes, slotById("gradient.messageSkeleton"), "light")
    expect(declOf(skeleton, "--component-message-balloon-skeleton-gradient")).toBe(
      "linear-gradient(90deg,#102030,#f0e0d0)",
    )
  })
})

/* ================================================================== *
 * §6.3 Raw overrides outrank semantics by cascade position
 * ================================================================== */

describe("raw override precedence (§6.3, T-EMIT-04)", () => {
  test("raw lightOverrides/darkOverrides blocks follow all semantic scope blocks on a shared token", () => {
    const assignments: Assignments = {
      "page.background": { light: "#112233", dark: "#223344" },
    }
    const mapping = legacyMapping({
      lightOverrides: { "--common-bg": "#445566" },
      darkOverrides: { "--common-bg": "#778899" },
    })
    const nodes = parse(emit(assignments, { mapping }))

    // Semantic values land on the RC scope blocks…
    const rcLight = requireScopeBlock(nodes, slotById("page.background"), "light")
    expect(declOf(rcLight, "--common-bg")).toBe("#112233")
    const rcDark = requireScopeBlock(nodes, slotById("page.background"), "dark")
    expect(declOf(rcDark, "--common-bg")).toBe("#223344")

    // …and the raw escape hatch still wins the tie by sheet position.
    const rawLight = requireBlock(nodes, RAW_LIGHT_SEL, "--common-bg", "raw light override")
    expect(declOf(rawLight, "--common-bg")).toBe("#445566")
    const rawDark = requireBlock(nodes, RAW_DARK_SEL, "--common-bg", "raw dark override")
    expect(declOf(rawDark, "--common-bg")).toBe("#778899")

    const semanticEnd = Math.max(
      ...nodes
        .filter((n) => n.decls.some(([name]) => name === "--common-bg") && n.mediaParent === null && !sameList(n.selectorList, RAW_LIGHT_SEL) && !sameList(n.selectorList, RAW_DARK_SEL))
        .map((n) => n.end),
    )
    if (!(rawLight.start > semanticEnd && rawDark.start > semanticEnd)) {
      throw new Error("RED by design (§6.3/§12): raw override blocks must follow every semantic scope block")
    }
    if (!(rawLight.start < rawDark.start)) {
      throw new Error("RED by design (§12): lightOverrides block must precede the darkOverrides block")
    }
  })
})

/* ================================================================== *
 * §10/§12 Targeted rule bindings
 * ================================================================== */

describe("targeted rule bindings (§10/§12)", () => {
  test("mode is derived from the selector; each rule carries its stable id comment; light, dark, static order; no media duplication", () => {
    const lightValue = "linear-gradient(90deg,#0a1b2c,#3c2b1a)"
    const darkValue = "linear-gradient(90deg,#f0e0d0,#102030)"
    const staticValue = "0 1px 2px #10131a"
    const assignments: Assignments = {
      "gradient.messageSkeleton": { light: lightValue, dark: darkValue },
      "shadow.popup": { light: staticValue, dark: staticValue },
    }
    const bindings: RuleBindingInput[] = [
      { kind: "rule", slot: "shadow.popup", selector: ".div-container-block_frame_shadow", property: "box-shadow" },
      { kind: "rule", slot: "gradient.messageSkeleton", selector: ".yamb-modal.Orb-Theme_theme_light", property: "background-image" },
      { kind: "rule", slot: "gradient.messageSkeleton", selector: ".yamb-modal.Orb-Theme_theme_dark", property: "background-image" },
    ]
    const mapping = legacyMapping({ semanticBindings: bindings, darkOverrides: { "--common-divider": "#333333" } })
    const css = emit(assignments, { mapping })
    const nodes = parse(css)

    // §12: rule ids depend only on slot and mode; each emitted exactly once;
    // mode order light, dark, static.
    const ids = [
      "semantic.gradient.messageSkeleton.light",
      "semantic.gradient.messageSkeleton.dark",
      "semantic.shadow.popup.static",
    ]
    const comments = ruleComments(css)
    let cursor = -1
    for (const id of ids) {
      const hits = comments.filter((c) => c.id === id)
      if (hits.length !== 1) {
        throw new Error(`RED by design (missing rule sections): expected exactly one tto comment ${id}, found ${hits.length}`)
      }
      if (hits[0]!.index <= cursor) throw new Error(`RED by design (§12): rule ${id} is out of light→dark→static order`)
      cursor = hits[0]!.index
    }

    // The rule body directly follows its comment and carries the slot value
    // of the comment's mode; rules never appear inside the media block.
    for (let i = 0; i < ids.length; i++) {
      const comment = comments.find((c) => c.id === ids[i])!
      const next = comments.find((c) => c.index > comment.index)
      const rule = nodes.find(
        (n) =>
          n.mediaParent === null &&
          !n.selector.startsWith("@media") &&
          n.start > comment.index &&
          (next === undefined || n.start < next.index),
      )
      if (!rule) throw new Error(`RED by design: no rule block directly after the ${ids[i]} comment`)
      const expected =
        ids[i]!.endsWith(".light") ? lightValue : ids[i]!.endsWith(".dark") ? darkValue : staticValue
      const property = ids[i]!.endsWith(".static") ? "box-shadow" : "background-image"
      const insideMedia = nodes.filter(
        (n) => n.mediaParent !== null && n.decls.some(([name, value]) => name === property && value === expected),
      )
      if (insideMedia.length > 0) {
        throw new Error(`RED by design (§8/§10): rule ${ids[i]} must not be duplicated inside the media block`)
      }
      expect(rule.decls).toContainEqual([property, expected])
    }

    // §12 position 5: rules come after the raw override blocks.
    const rawDark = requireBlock(nodes, RAW_DARK_SEL, "--common-divider", "raw dark override")
    if (!(comments[0]!.index > rawDark.end)) {
      throw new Error("RED by design (§12): rule sections must follow the raw override sections")
    }
  })

  test("verified (selector, property) matrix emits byte-exact static rules", () => {
    const values: Record<string, string> = {
      "text.primary": "#0a1b2c",
      "gradient.messageSkeleton": "linear-gradient(90deg,#0a1b2c,#3c2b1a)",
      "shadow.popup": "0 1px 2px #10131a",
    }
    const matrix: Array<{ slot: string; selector: string; property: string }> = [
      { slot: "text.primary", selector: ".ui-notificationbar_design_line", property: "color" },
      { slot: "text.primary", selector: ".ui-notificationbar_design_line .ui-notificationbar__button", property: "background-color" },
      { slot: "text.primary", selector: ".ui-notificationbar_design_line", property: "background" },
      { slot: "text.primary", selector: ".yamb-message-user__avatar_transparent .ui-avatar", property: "border-color" },
      { slot: "gradient.messageSkeleton", selector: ".yamb-upload-files-item__cancel-container", property: "background" },
      { slot: "shadow.popup", selector: ".div-container-block_frame_shadow", property: "box-shadow" },
    ]
    const assignments: Assignments = Object.fromEntries(
      Object.entries(values).map(([slot, value]) => [slot, { light: value, dark: value }]),
    )
    const bindings: RuleBindingInput[] = matrix.map(({ slot, selector, property }) => ({
      kind: "rule",
      slot,
      selector,
      property,
    }))
    const css = emit(assignments, { mapping: legacyMapping({ semanticBindings: bindings }) })
    const nodes = parse(css)
    const comments = ruleComments(css)

    const failures: string[] = []
    for (const { slot, selector, property } of matrix) {
      const id = `semantic.${slot}.static`
      const comment = comments.find((c) => c.id === id)
      if (!comment) {
        failures.push(`${slot}: missing tto comment ${id}`)
        continue
      }
      const rule = nodes.find((n) => n.mediaParent === null && n.start > comment.index && n.decls.some(([name]) => name === property))
      if (!rule || rule.selector !== selector) {
        failures.push(`${slot}: expected rule \`${selector}\` with \`${property}: ${values[slot]}\` after the ${id} comment`)
        continue
      }
      const declares = rule.decls.some(([name, value]) => name === property && value === values[slot]!)
      if (!declares) {
        failures.push(`${slot}: rule \`${selector}\` does not declare ${property}: ${values[slot]}`)
      }
    }
    expect(failures).toEqual([])
  })
})

/* ================================================================== *
 * §8 theme_auto dark media
 * ================================================================== */

describe("theme_auto dark media (§8, T-AUTO-01..04)", () => {
  test("T-AUTO-01: dark R values ride :root.theme_auto inside the dark media block", () => {
    const assignments: Assignments = {
      "surface.generic": { dark: valueFor("surface.generic", "dark") },
      "text.primary": { dark: valueFor("text.primary", "dark") },
      "status.dangerText": { dark: valueFor("status.dangerText", "dark") },
    }
    const nodes = parse(emit(assignments))
    const media = requireMediaNode(nodes)
    const failures: string[] = []
    for (const id of ["surface.generic", "text.primary", "status.dangerText"]) {
      const spec = slotById(id)
      const value = valueFor(id, "dark")
      const block = nodes.find(
        (n) => n.mediaParent === media && sameList(n.selectorList, AUTO_R_SEL) && n.decls.some(([name]) => name === spec.token),
      )
      if (!block) failures.push(`${id}: dark value missing on [${AUTO_R_SEL.join(", ")}] inside the media block`)
      else if (declOf(block, spec.token) !== value) failures.push(`${id}: wrong auto dark value ${declOf(block, spec.token)}`)
    }
    expect(failures).toEqual([])
  })

  test("T-AUTO-02: dark RBC values ride the brand theme_auto compounds", () => {
    const assignments: Assignments = {
      "text.link": { dark: valueFor("text.link", "dark") },
      "control.brandSurface": { dark: valueFor("control.brandSurface", "dark") },
    }
    const nodes = parse(emit(assignments))
    const media = requireMediaNode(nodes)
    const failures: string[] = []
    for (const id of ["text.link", "control.brandSurface"]) {
      const spec = slotById(id)
      const value = valueFor(id, "dark")
      const block = nodes.find(
        (n) => n.mediaParent === media && sameList(n.selectorList, AUTO_RB_SEL) && n.decls.some(([name]) => name === spec.token),
      )
      if (!block) failures.push(`${id}: dark value missing on the brand auto compounds inside the media block`)
      else if (declOf(block, spec.token) !== value) failures.push(`${id}: wrong auto dark value ${declOf(block, spec.token)}`)
    }
    expect(failures).toEqual([])
  })

  test("T-AUTO-04: light values ride plain :root and no light media block exists", () => {
    const css = emit({ "status.dangerText": { light: valueFor("status.dangerText", "light") } })
    const nodes = parse(css)
    const block = requireScopeBlock(nodes, slotById("status.dangerText"), "light")
    expect(declOf(block, "--orb-text-feedback-danger")).toBe(valueFor("status.dangerText", "light"))
    expect(block.mediaParent).toBeNull()
    expect(css).not.toMatch(/prefers-color-scheme:\s*light/)
  })

  test("component compound scopes are never duplicated inside the media block (§8)", () => {
    const spec = slotById("control.buttonBrand")
    const nodes = parse(emit({ [spec.id]: { dark: valueFor(spec.id, "dark") } }))

    // RED part: the MN dark compound block exists at top level.
    const block = requireScopeBlock(nodes, spec, "dark")
    expect(declOf(block, spec.token)).toBe(valueFor(spec.id, "dark"))
    expect(block.mediaParent).toBeNull()

    // §8: components resolve theme through their own Orb-Theme classes, so
    // the media block carries neither compound selectors nor MN tokens.
    const mediaChildren = nodes.filter((n) => n.mediaParent !== null)
    expect(mediaChildren.filter((n) => n.decls.some(([name]) => name === spec.token)).map((n) => n.selector)).toEqual([])
    expect(mediaChildren.filter((n) => n.selectorList.some((s) => s.includes("Orb-Theme_theme_"))).map((n) => n.selector)).toEqual([])
  })
})

/* ================================================================== *
 * §12 Deterministic canonical order
 * ================================================================== */

describe("deterministic canonical order (§12, T-DET-02)", () => {
  test("full sheet follows banner → ramps → R/RB/RC/RBC/MN/REF × light/dark → raw → rules → media", () => {
    const mapping = legacyMapping({
      lightOverrides: { "--common-bg": "#445566" },
      darkOverrides: { "--common-bg": "#778899" },
      semanticBindings: [
        { kind: "rule", slot: "gradient.messageSkeleton", selector: ".yamb-modal.Orb-Theme_theme_light", property: "background-image" },
        { kind: "rule", slot: "gradient.messageSkeleton", selector: ".yamb-modal.Orb-Theme_theme_dark", property: "background-image" },
        { kind: "rule", slot: "shadow.popup", selector: ".div-container-block_frame_shadow", property: "box-shadow" },
      ] satisfies RuleBindingInput[],
    })
    const css = emit(ALL_SLOTS_BOTH_MODES, { mapping })
    const nodes = parse(css)

    const pos = (label: string, node: CssNode | undefined): [string, number] => {
      if (!node) throw new Error(`RED by design (missing semantic sections): ${label} block not found in the sheet`)
      return [label, node.start]
    }
    const chain: Array<[string, number]> = [
      ["banner", 0],
      pos("light ramps", findBlock(nodes, LIGHT_RAMP_SEL, RAMP_PROBE)),
      pos("dark ramps", findBlock(nodes, DARK_RAMP_SEL, RAMP_PROBE)),
    ]
    for (const scopeClass of ["R", "RB", "RC", "RBC", "MN", "REF"] as const) {
      const spec = slotById(SCOPE_SLOT[scopeClass])
      chain.push(pos(`${scopeClass} light`, findBlock(nodes, SCOPE_SELECTORS[spec.scopeClass]["light"], spec.token)))
      chain.push(pos(`${scopeClass} dark`, findBlock(nodes, SCOPE_SELECTORS[spec.scopeClass]["dark"], spec.token)))
    }
    chain.push(pos("raw light overrides", findBlock(nodes, RAW_LIGHT_SEL, "--common-bg")))
    chain.push(pos("raw dark overrides", findBlock(nodes, RAW_DARK_SEL, "--common-bg")))

    const comments = ruleComments(css)
    for (const id of [
      "semantic.gradient.messageSkeleton.light",
      "semantic.gradient.messageSkeleton.dark",
      "semantic.shadow.popup.static",
    ]) {
      const comment = comments.find((c) => c.id === id)
      if (!comment) throw new Error(`RED by design (missing rule sections): tto comment ${id} not found`)
      chain.push([id, comment.index])
    }
    chain.push(pos("theme_auto media", requireMediaNode(nodes)))

    for (let i = 1; i < chain.length; i++) {
      const [prevLabel, prev] = chain[i - 1]!
      const [label, at] = chain[i]!
      if (!(at > prev)) {
        throw new Error(
          `RED by design (§12 canonical order): "${label}" at ${at} does not follow "${prevLabel}" at ${prev}; ` +
            `chain: ${chain.map(([l, p]) => `${l}@${p}`).join(" < ")}`,
        )
      }
    }
  })

  test("within a scope block, categories follow SEMANTIC_CATEGORIES and keys follow byte order", () => {
    // All R-class slots; successText vs warningText discriminates byte order
    // from the plan-table order (table lists warning first, bytes sort success
    // first).
    const ids = [
      "surface.generic",
      "elevation.base",
      "line.generic",
      "text.primary",
      "status.successText",
      "status.warningText",
      "shadow.color",
    ]
    const assignments: Assignments = Object.fromEntries(
      ids.map((id) => [id, { light: valueFor(id, "light") }]),
    )
    const nodes = parse(emit(assignments))
    const block = requireScopeBlock(nodes, slotById("surface.generic"), "light")

    let cursor = -1
    const order: string[] = []
    for (const id of ids) {
      const spec = slotById(id)
      const index = block.decls.findIndex(([name]) => name === spec.token)
      if (index === -1) throw new Error(`RED by design (missing semantic sections): ${spec.token} missing from the R light block`)
      if (index <= cursor) throw new Error(`RED by design (§12): ${id} is out of canonical order inside the R light block`)
      cursor = index
      order.push(id)
    }
    const categories = order.map((id) => slotById(id).category)
    const catPositions = categories.map((c) => EXPECTED_SEMANTIC_CATEGORIES.indexOf(c))
    for (let i = 1; i < catPositions.length; i++) {
      if (catPositions[i]! < catPositions[i - 1]!) {
        throw new Error(`RED by design (§12): category order ${categories.join(" → ")} violates SEMANTIC_CATEGORIES`)
      }
    }
    // Byte order: "successText" < "warningText" even though the plan table
    // lists warningText first.
    if (!(order.indexOf("status.successText") < order.indexOf("status.warningText"))) {
      throw new Error("RED by design (§12): slot keys must be ordered by byte order, not table order")
    }
  })

  test("control: no timestamps, no !important, exactly one dark media block", () => {
    const css = emit(ALL_SLOTS_BOTH_MODES)
    expect(css).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(css).not.toContain("!important")
    const media = parse(css).filter((n) => n.selector.startsWith("@media"))
    expect(media.map((n) => n.selector)).toEqual(["@media (prefers-color-scheme: dark)"])
  })
})

/* ================================================================== *
 * Hygiene sweeps the emitter must keep holding
 * ================================================================== */

describe("emission hygiene (§5.8, §14, T-INV-03 at the emitter)", () => {
  test("control: no currentColor rewriting, no chat-list-item token, no ::selection anywhere", () => {
    const css = emit(ALL_SLOTS_BOTH_MODES)
    expect(css).not.toContain("currentColor")
    expect(css).not.toContain("--component-chat-list-item-border-top-color")
    expect(css).not.toContain("::selection")
  })
})
