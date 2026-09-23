import { hexToOklch, hexToRgb, oklchToHex } from "./color"
import type { HexColor } from "./types"
import { SEMANTIC_CATEGORIES, type BrandRampConfig, type MappingConfig, type RampStop } from "../schema"
import type { desktopThemeSchema } from "../schema"
import {
  deriveRuleMode,
  getSemanticSlotValue,
  SEMANTIC_AUTO_SCOPES,
  SEMANTIC_AUTO_SCOPE_GROUPS,
  SEMANTIC_SCOPE_BLOCKS,
  SEMANTIC_SLOT_REGISTRY,
  semanticRuleId,
  type RuleMode,
  type ScopeClass,
  type SemanticSlotEntry,
  type ThemeMode,
} from "./semantic-slots"
import { buildBackgroundSections } from "./backgrounds"
import type { z } from "zod"

type DesktopTheme = z.infer<typeof desktopThemeSchema>

/**
 * Orb's numeric ramp stops, observed live in Telemost's `:root`
 * (`--orb-color-ya-telemost-{100..1000}`).
 *
 * Orb numbers behave like Tailwind: LOW number = light tint, HIGH = dark shade.
 * shuvcode's `generateScale` uses the opposite convention (index 0 = lightest in
 * light mode), so we do not reuse it here — we map Orb stops to explicit OKLCH
 * lightness targets instead. Chroma is scaled down at the extremes so tints stay
 * believable rather than neon.
 */
const RAMP_STOPS: readonly RampStop[] = [100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 850, 900, 950, 1000]

/**
 * Lightness + chroma multiplier per Orb stop.
 *
 * MEASURED, not invented: these are the OKLCH coordinates of Telemost's own
 * `--orb-color-ya-telemost-*` ramp, read back over CDP and normalised so the
 * peak-chroma stop has multiplier 1.0 (stock peak is C=0.215 at stop 400).
 *
 * Matching the stock curve matters — an earlier hand-guessed curve put stop 600
 * at L=0.63 where the real one sits at L=0.742, which made every brand surface
 * read noticeably darker and heavier than Telemost's own design intends.
 */
const RAMP_SHAPE: Readonly<Record<RampStop, { l: number; c: number }>> = {
  100: { l: 0.982, c: 0.12 },
  150: { l: 0.961, c: 0.27 },
  200: { l: 0.931, c: 0.51 },
  250: { l: 0.908, c: 0.72 },
  300: { l: 0.891, c: 0.9 },
  400: { l: 0.854, c: 1.0 },
  500: { l: 0.809, c: 0.98 },
  600: { l: 0.742, c: 0.9 },
  700: { l: 0.676, c: 0.87 },
  800: { l: 0.597, c: 0.78 },
  850: { l: 0.524, c: 0.69 },
  900: { l: 0.415, c: 0.53 },
  950: { l: 0.221, c: 0.26 },
  1000: { l: 0.085, c: 0.09 },
}

/** Alpha stops observed in Orb: `--orb-color-<family>-alpha-{100..500}`. */
const ALPHA_STOPS: Readonly<Record<number, number>> = {
  100: 0.1,
  150: 0.13,
  200: 0.2,
  250: 0.3,
  300: 0.4,
  400: 0.6,
  500: 0.8,
}

/** `--orb-color-<family>-light-{400,500,600}` — slightly lifted variants. */
const LIGHT_TRIO_LIFT = 0.06

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function toHex8(hex: HexColor, alpha: number): string {
  const { r, g, b } = hexToRgb(hex)
  const a = Math.round(clamp01(alpha) * 255)
    .toString(16)
    .padStart(2, "0")
  const rr = Math.round(r * 255)
    .toString(16)
    .padStart(2, "0")
  const gg = Math.round(g * 255)
    .toString(16)
    .padStart(2, "0")
  const bb = Math.round(b * 255)
    .toString(16)
    .padStart(2, "0")
  return `#${rr}${gg}${bb}${a}`
}

/**
 * True if the OKLCH triple survives a round-trip through sRGB unchanged,
 * i.e. it is inside gamut. Out-of-gamut colors get silently clamped by
 * `oklchToHex`, which both desaturates them and shifts their hue.
 */
function isInGamut(color: { l: number; c: number; h: number }): boolean {
  const hex = oklchToHex(color)
  const back = hexToOklch(hex)
  const chromaLoss = color.c - back.c
  let hueDrift = Math.abs(back.h - color.h)
  if (hueDrift > 180) hueDrift = 360 - hueDrift
  return chromaLoss <= 0.012 && (color.c < 0.02 || hueDrift <= 3)
}

/**
 * Reduces chroma until the color fits in sRGB, preserving lightness and hue.
 *
 * This is the standard CSS Color 4 gamut-mapping approach (binary search on
 * chroma). Without it, a saturated blue seed like cobalt `#034cff` (C=0.269)
 * clips hard on the light stops and drifts up to 15 degrees toward cyan,
 * producing the neon look that plain clamping gives you.
 */
function gamutMap(l: number, c: number, h: number): HexColor {
  if (isInGamut({ l, c, h })) return oklchToHex({ l, c, h })

  let low = 0
  let high = c
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2
    if (isInGamut({ l, c: mid, h })) low = mid
    else high = mid
  }
  return oklchToHex({ l, c: low, h })
}

function rampStopFromSeed(seed: HexColor, stop: RampStop): HexColor {
  const base = hexToOklch(seed)
  const shape = RAMP_SHAPE[stop]
  return gamutMap(shape.l, base.c * shape.c, base.h)
}

/**
 * Resamples a hand-authored 12-step scale onto Orb's 14 stops.
 *
 * The source scale is treated as a curve in OKLCH space indexed by lightness:
 * for each Orb stop we interpolate between the two neighbouring source steps.
 * That keeps the designer's chroma and hue choices instead of re-deriving them
 * from a single seed.
 */
function rampStopFromPalette(palette: readonly HexColor[], stop: RampStop): HexColor {
  const points = palette
    .map((hex) => hexToOklch(hex))
    .slice()
    .sort((a, b) => a.l - b.l)

  const target = RAMP_SHAPE[stop].l
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last) throw new Error("palette must not be empty")

  // Outside the authored range: keep the endpoint hue/chroma, take our lightness.
  if (target <= first.l) return gamutMap(target, first.c, first.h)
  if (target >= last.l) return gamutMap(target, last.c, last.h)

  for (let i = 0; i < points.length - 1; i++) {
    const lower = points[i]
    const upper = points[i + 1]
    if (!lower || !upper) continue
    if (target >= lower.l && target <= upper.l) {
      const span = upper.l - lower.l
      const t = span === 0 ? 0 : (target - lower.l) / span

      let hueDelta = upper.h - lower.h
      if (hueDelta > 180) hueDelta -= 360
      if (hueDelta < -180) hueDelta += 360

      return gamutMap(target, lower.c + (upper.c - lower.c) * t, lower.h + hueDelta * t)
    }
  }

  return gamutMap(target, last.c, last.h)
}

export interface GeneratedRamp {
  readonly family: string
  readonly declarations: ReadonlyArray<readonly [string, string]>
}

export interface RampSource {
  readonly seedHex?: HexColor
  readonly palette?: readonly HexColor[]
}

export function generateRamp(source: RampSource, config: BrandRampConfig): GeneratedRamp {
  const stopColor = (stop: RampStop): HexColor => {
    if (source.palette) return rampStopFromPalette(source.palette, stop)
    if (source.seedHex) return rampStopFromSeed(source.seedHex, stop)
    throw new Error(`ramp "${config.family}" has neither a palette nor a seed`)
  }

  const declarations: Array<readonly [string, string]> = []

  for (const stop of RAMP_STOPS) {
    declarations.push([`--orb-color-${config.family}-${stop}`, stopColor(stop)])
  }

  const alphaBase = stopColor(config.alphaSource)
  for (const [stop, alpha] of Object.entries(ALPHA_STOPS)) {
    declarations.push([`--orb-color-${config.family}-alpha-${stop}`, toHex8(alphaBase, alpha)])
  }

  if (config.emitLightTrio) {
    for (const stop of [400, 500, 600] as const) {
      const lifted = hexToOklch(stopColor(stop))
      declarations.push([
        `--orb-color-${config.family}-light-${stop}`,
        gamutMap(clamp01(lifted.l + LIGHT_TRIO_LIFT), lifted.c, lifted.h),
      ])
    }
  }

  return { family: config.family, declarations }
}

function renderBlock(selector: string, declarations: ReadonlyArray<readonly [string, string]>): string {
  if (declarations.length === 0) return ""
  const body = declarations.map(([name, value]) => `  ${name}: ${value};`).join("\n")
  return `${selector} {\n${body}\n}`
}

function indentBlock(block: string): string {
  return block
    .split("\n")
    .map((line) => (line ? `  ${line}` : line))
    .join("\n")
}

/* ------------------------------------------------------------------ *
 * Semantic slot emission (plan §5–§9, §12)
 *
 * Values are consumed verbatim from `theme.<mode>.semantic` (§6: the slot
 * value of the active variant, else nothing — no cross-mode fallback, no
 * re-derivation from seeds or ramps). Every target token, scope list and
 * rule id comes from the registry in `./semantic-slots`.
 * ------------------------------------------------------------------ */

type SemanticDeclaration = readonly [string, string]

/** Canonical category order (plan §3/§12), as a lookup. */
const CATEGORY_ORDER: ReadonlyMap<string, number> = new Map(
  SEMANTIC_CATEGORIES.map((name, index) => [name, index]),
)

function compareBytes(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

interface SemanticAssignment {
  readonly entry: SemanticSlotEntry
  readonly value: string
}

/**
 * Collects every slot set in one mode. Duplicate resolved tokens in one mode
 * are a hard error naming both slots (plan §4/§12) — the registry targets are
 * distinct today, so this can only fire on a future registry edit, where it
 * must fail loudly instead of letting block order hide the collision.
 */
function collectSemanticAssignments(theme: DesktopTheme, mode: ThemeMode): SemanticAssignment[] {
  const resolved = new Map<string, string>()
  const assignments: SemanticAssignment[] = []
  for (const entry of SEMANTIC_SLOT_REGISTRY.values()) {
    const value = getSemanticSlotValue(theme[mode].semantic, entry)
    if (value === undefined) continue
    const prior = resolved.get(entry.token)
    if (prior !== undefined) {
      throw new Error(`semantic slots "${prior}" and "${entry.id}" both resolve to ${entry.token} in ${mode} mode`)
    }
    resolved.set(entry.token, entry.id)
    assignments.push({ entry, value })
  }
  return assignments
}

/** §12 within-block order: category order, then slot key byte-order. */
function canonicalOrder(a: SemanticAssignment, b: SemanticAssignment): number {
  const byCategory =
    (CATEGORY_ORDER.get(a.entry.category) ?? SEMANTIC_CATEGORIES.length) -
    (CATEGORY_ORDER.get(b.entry.category) ?? SEMANTIC_CATEGORIES.length)
  if (byCategory !== 0) return byCategory
  return compareBytes(a.entry.key, b.entry.key)
}

/**
 * Top-level §12 emission plan, in scope-class order R → RB → RC → RBC → MN →
 * REF, modes light then dark. The RBC class spans two of those positions:
 * its brand text slots (text.link, text.linkHovered) ride the RB position and
 * its brand control/shadow slots ride the RBC position, the exact sequence
 * pinned by generate.test.ts (T-DET-02). Both halves emit on the full §9 RBC
 * selector list, so the cascade is identical to a single block.
 */
const SEMANTIC_BLOCK_PLAN: ReadonlyArray<{
  readonly scopeClass: ScopeClass
  /** undefined: whole class; true: text-category half; false: the rest. */
  readonly brandTextHalf?: boolean
}> = [
  { scopeClass: "R" },
  { scopeClass: "RB" },
  { scopeClass: "RBC", brandTextHalf: true },
  { scopeClass: "RC" },
  { scopeClass: "RBC", brandTextHalf: false },
  { scopeClass: "MN" },
  { scopeClass: "REF" },
]

interface SemanticSections {
  /** Scope blocks in canonical order, ready to join into the sheet. */
  readonly topLevel: string[]
  /** Dark values for the `:root.theme_auto` scopes (§8 item 2). */
  readonly autoRoot: SemanticDeclaration[]
  /** Dark values for the brand theme_auto scopes (§8 item 3). */
  readonly autoBrand: SemanticDeclaration[]
}

/**
 * Builds the §9 scope blocks in the §12 canonical order, plus the dark
 * theme_auto declaration sets (§8): the root group carries R/REF classes, the
 * brand group RB/RBC. Component scopes (RC compounds, MN) resolve their own
 * theme classes and never enter the media block. Absent slots emit nothing;
 * empty blocks are skipped.
 */
function buildSemanticSections(theme: DesktopTheme): SemanticSections {
  const topLevel: string[] = []
  const autoRoot: SemanticDeclaration[] = []
  const autoBrand: SemanticDeclaration[] = []

  const assignmentsByMode: Record<ThemeMode, SemanticAssignment[]> = {
    light: collectSemanticAssignments(theme, "light").sort(canonicalOrder),
    dark: collectSemanticAssignments(theme, "dark").sort(canonicalOrder),
  }

  // §12: the blocks follow the §9 scope-class order, and within each scope
  // class the light block precedes the dark block.
  for (const step of SEMANTIC_BLOCK_PLAN) {
    for (const mode of ["light", "dark"] as const) {
      const declarations = assignmentsByMode[mode]
        .filter(
          ({ entry }) =>
            entry.scopeClass === step.scopeClass &&
            (step.brandTextHalf === undefined || (entry.category === "text") === step.brandTextHalf),
        )
        .map(({ entry, value }): SemanticDeclaration => [entry.token, value])
      const block = renderBlock(SEMANTIC_SCOPE_BLOCKS[step.scopeClass][mode].join(", "), declarations)
      if (block.length > 0) topLevel.push(block)
    }
  }

  // §8 auto groups ride the dark assignments only; each keeps the canonical
  // order collected above.
  for (const { entry, value } of assignmentsByMode.dark) {
    if (SEMANTIC_AUTO_SCOPE_GROUPS.root.includes(entry.scopeClass)) autoRoot.push([entry.token, value])
    else if (SEMANTIC_AUTO_SCOPE_GROUPS.brand.includes(entry.scopeClass)) autoBrand.push([entry.token, value])
  }

  return { topLevel, autoRoot, autoBrand }
}

/** §12 rule order: mode light → dark → static, then canonical slot order. */
const RULE_MODE_ORDER: Readonly<Record<RuleMode, number>> = { light: 0, dark: 1, static: 2 }

/**
 * Builds the §10 targeted rules. Each binding becomes its own rule, preceded
 * by its stable id comment (`semantic.<slot>.<mode>`, §12 — derived only from
 * slot and mode). The mode comes from the selector's theme class; the rule
 * consumes the slot value of that mode, static rules the shared light value
 * (loadMapping enforces light === dark). Bindings whose slot is unset in the
 * needed mode emit nothing, like any unset slot (§6.2).
 */
function buildRuleBindingSections(theme: DesktopTheme, mapping: MappingConfig): string[] {
  const rows: Array<{
    readonly mode: RuleMode
    readonly entry: SemanticSlotEntry
    readonly selector: string
    readonly property: string
    readonly value: string
  }> = []
  for (const binding of mapping.semanticBindings ?? []) {
    if (binding.kind !== "rule") continue
    const entry = SEMANTIC_SLOT_REGISTRY.get(binding.slot)
    if (!entry) continue
    const mode = deriveRuleMode(binding.selector)
    const value = getSemanticSlotValue((mode === "dark" ? theme.dark : theme.light).semantic, entry)
    if (value === undefined) continue
    rows.push({ mode, entry, selector: binding.selector, property: binding.property, value })
  }
  rows.sort(
    (a, b) =>
      RULE_MODE_ORDER[a.mode] - RULE_MODE_ORDER[b.mode] ||
      (CATEGORY_ORDER.get(a.entry.category) ?? SEMANTIC_CATEGORIES.length) -
        (CATEGORY_ORDER.get(b.entry.category) ?? SEMANTIC_CATEGORIES.length) ||
      compareBytes(a.entry.id, b.entry.id) ||
      compareBytes(a.selector, b.selector) ||
      compareBytes(a.property, b.property),
  )
  return rows.map(
    ({ mode, entry, selector, property, value }) =>
      `/* tto: ${semanticRuleId(entry.id, mode)} */\n${renderBlock(selector, [[property, value]])}`,
  )
}

/**
 * Builds the single §8 dark media block: dark ramps, dark semantics (root
 * scopes, then brand scopes), dark raw overrides on the same auto scopes —
 * the documented gap fix that finally lets `darkOverrides` reach
 * `theme_auto`. No light media block exists.
 */
function buildAutoMediaSections(sections: {
  readonly darkRamps: ReadonlyArray<SemanticDeclaration>
  readonly autoRoot: ReadonlyArray<SemanticDeclaration>
  readonly autoBrand: ReadonlyArray<SemanticDeclaration>
  readonly darkOverrides: ReadonlyArray<SemanticDeclaration>
  readonly autoBackgrounds?: ReadonlyArray<string>
}): string {
  const inner = [
    renderBlock(SEMANTIC_AUTO_SCOPES.root.join(", "), sections.darkRamps),
    renderBlock(SEMANTIC_AUTO_SCOPES.root.join(", "), sections.autoRoot),
    renderBlock(SEMANTIC_AUTO_SCOPES.brand.join(", "), sections.autoBrand),
    renderBlock(SEMANTIC_AUTO_SCOPES.brand.join(", "), sections.darkOverrides),
    ...(sections.autoBackgrounds ?? []),
  ].filter((block) => block.length > 0)
  if (inner.length === 0) return ""
  return `@media (prefers-color-scheme: dark) {\n${inner.map(indentBlock).join("\n\n")}\n}`
}

export interface BuildCssOptions {
  readonly theme: DesktopTheme
  readonly mapping: MappingConfig
}

/**
 * Builds the override stylesheet.
 *
 * Strategy: rewrite Orb *primitives*, not the 17 semantic brand tokens that
 * consume them. Telemost may rename a semantic token between releases, but the
 * primitive ramp is the shared foundation — targeting it keeps the patch small
 * and resilient. Semantic slots (plan §5) then re-declare individual Telemost
 * tokens on their evidence-backed scopes, and targeted rules recolor the few
 * color-literal occurrences no token can reach.
 *
 * Specificity: Orb defines primitives on `:root` and brand tokens on
 * `.brand_telemost` compounds. We emit `:root` plus the same compound selectors
 * so the cascade lands after Orb without resorting to `!important` anywhere.
 *
 * Canonical section order (plan §12): banner → ramps → semantic scope blocks
 * (R → RB → RC → RBC → MN → REF, light then dark) → raw overrides (emitted
 * after semantics so `lightOverrides`/`darkOverrides` win cascade ties, §6.3)
 * → targeted rule bindings (light, dark, static) → background image sections
 * → the single dark `theme_auto` media block. The output is deterministic:
 * registry order, sorted maps, fixed selector lists, no timestamps.
 */
export function buildCss(options: BuildCssOptions): string {
  const { theme, mapping } = options

  const darkRamps: Array<readonly [string, string]> = []
  const lightRamps: Array<readonly [string, string]> = []

  // An explicit accentScale in the theme wins; otherwise fall back to the seed
  // named by the mapping. This keeps theme.json meaningful either way — editing
  // it must always change the result, or the file is a lie.
  for (const ramp of mapping.ramps) {
    const darkSource: RampSource = theme.dark.accentScale
      ? { palette: theme.dark.accentScale as HexColor[] }
      : { seedHex: theme.dark.seeds[ramp.seed] as HexColor }

    const lightSource: RampSource = theme.light.accentScale
      ? { palette: theme.light.accentScale as HexColor[] }
      : { seedHex: theme.light.seeds[ramp.seed] as HexColor }

    darkRamps.push(...generateRamp(darkSource, ramp).declarations)
    lightRamps.push(...generateRamp(lightSource, ramp).declarations)
  }

  // Sorted so the raw escape hatch stays deterministic regardless of JSON key
  // order (plan §12 determinism guards).
  const lightOverrides: Array<SemanticDeclaration> = Object.entries(mapping.lightOverrides).sort(([a], [b]) =>
    compareBytes(a, b),
  )
  const darkOverrides: Array<SemanticDeclaration> = Object.entries(mapping.darkOverrides).sort(([a], [b]) =>
    compareBytes(a, b),
  )

  const banner = [
    "/* ============================================================",
    ` * telemost-theme-override — ${theme.name} (${theme.id})`,
    mapping.description ? ` * ${mapping.description}` : null,
    " * Generated at runtime. Telemost files are never modified.",
    " * ============================================================ */",
  ]
    .filter((line): line is string => line !== null)
    .join("\n")

  const semantic = buildSemanticSections(theme)
  const backgrounds = buildBackgroundSections(theme)

  // Orb scopes brand primitives on :root; the dark/light split rides on
  // .theme_dark / .theme_light classes that Telemost puts on <html>.
  const sections = [
    banner,
    renderBlock(":root", lightRamps),
    renderBlock(":root.theme_dark, .theme_dark:root", darkRamps),
    ...semantic.topLevel,
    renderBlock(":root, :root.brand_telemost", lightOverrides),
    renderBlock(":root.theme_dark, .theme_dark:root, .theme_dark:root.brand_telemost", darkOverrides),
    ...buildRuleBindingSections(theme, mapping),
    ...backgrounds.topLevel,
  ]

  // theme_auto follows the OS preference; see plan §8 for why only the dark
  // scheme needs a media block.
  const media = buildAutoMediaSections({
    darkRamps,
    autoRoot: semantic.autoRoot,
    autoBrand: semantic.autoBrand,
    darkOverrides,
    autoBackgrounds: backgrounds.autoDark,
  })
  if (media.length > 0) sections.push(media)

  return sections.filter((section) => section.length > 0).join("\n\n") + "\n"
}
