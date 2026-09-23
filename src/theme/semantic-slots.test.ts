/**
 * T-INV-01..03 — the semantic slot registry is pinned to its evidence
 * (`.beads/artifacts/tto-6ia.2/plan.md` §16 phase 1 and the §17 matrix rows
 * T-INV-01..03).
 *
 * Evidence sources, in order of authority:
 *  - `reports/telemost_ui_color_inventory.json` (`telemost-ui-color-inventory/1`),
 *    the static audit of the pinned stylesheet. The inventory's own asset
 *    block is re-checked (schema version, path, sha256, bytes, lines) so a
 *    re-run against a different stylesheet can never silently satisfy these
 *    tests.
 *  - The pinned stylesheet itself (`research_notes/…/evidence/telemost_ui.css`,
 *    sha256 7ee580fd…), read directly for the `raw`/`ref` evidence entries the
 *    inventory skips by design (plan §5: non-color-bearing stock values;
 *    reference-only tokens).
 *  - The plan transcript `src/theme/semantic-slots.testdata.ts`: the
 *    production registry must stay field-faithful to it.
 *
 * What each matrix row pins here:
 *  - T-INV-01: for every one of the 124 entries the recorded evidence tuple is
 *    re-derived from the sources: `def(n;cM)` — n inventory definition
 *    occurrences across M component scope groups; `raw(n)` — n definitions in
 *    the raw stylesheet and 0 in the inventory; `ref(c)` — 0 definitions
 *    anywhere and c whitespace-tolerant var() consumers in the raw stylesheet.
 *  - T-INV-02: every `VERIFIED_RULE_TARGETS` (selector, property) pair occurs
 *    in the inventory with override `targeted-rule` (kind `literal-color`) or
 *    `full-value-replacement`, with counts 175/14; the mode of every entry
 *    derives from its selector; and the allowlist is exactly partitioned into
 *    the binding-usable set (property allowed for at least one slot kind by
 *    the declared kind/property matrix, plan §11) and the retained
 *    full-value-replacement evidence set (properties no slot kind accepts),
 *    which is pinned by property name so a new excluded class cannot appear
 *    silently.
 *  - T-INV-03: no `::selection` target exists in the registry, the scope
 *    tables or the rule allowlist, and the pinned stylesheet contains zero
 *    `::selection` rules. (The emitted-output half of T-INV-03 is guarded at
 *    the emitter in `src/theme/generate.test.ts`.)
 *
 * Run: bun test src/theme/semantic-slots.test.ts
 */

import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { existsSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { ASSET_RELATIVE, parseStylesheet, type Occurrence } from "../../scripts/audit-colors"
import { semanticSlotsSchema } from "../schema"
import {
  SEMANTIC_AUTO_SCOPES,
  SEMANTIC_SCOPE_BLOCKS,
  SEMANTIC_SLOT_REGISTRY,
  VERIFIED_RULE_TARGETS,
  deriveRuleMode,
  slotKindAllowsProperty,
  type SemanticSlotKind,
} from "./semantic-slots"
import { SEMANTIC_SLOT_SPECS } from "./semantic-slots.testdata"

/* ------------------------------------------------------------------ *
 * Evidence sources
 * ------------------------------------------------------------------ */

const PROJECT_ROOT = join(import.meta.dir, "..", "..")
const ASSET_PATH = join(PROJECT_ROOT, ASSET_RELATIVE)

type InventoryOccurrence = Pick<Occurrence, "selector" | "property" | "kind" | "override">

interface ColorInventory {
  schema: string
  asset: { path: string; sha256: string; bytes: number; lines: number }
  summary: { totalOccurrences: number }
  occurrences: readonly InventoryOccurrence[]
}

const pinnedCss = readFileSync(ASSET_PATH, "utf8")

function loadInventory(): ColorInventory {
  const invPath = join(PROJECT_ROOT, "reports", "telemost_ui_color_inventory.json")
  if (existsSync(invPath)) {
    return JSON.parse(readFileSync(invPath, "utf8")) as ColorInventory
  }
  const scan = parseStylesheet(pinnedCss)
  const sha256 = createHash("sha256").update(pinnedCss).digest("hex")
  const lines = pinnedCss.split("\n").length
  const bytes = statSync(ASSET_PATH).size
  return {
    schema: "telemost-ui-color-inventory/1",
    asset: { path: ASSET_RELATIVE, sha256, bytes, lines },
    summary: { totalOccurrences: scan.occurrences.length },
    occurrences: scan.occurrences,
  }
}

const inventory = loadInventory()

/* ------------------------------------------------------------------ *
 * Evidence derivation
 * ------------------------------------------------------------------ */

/** Custom-property idents end where the next non-ident char begins. */
const IDENT_HEAD = "(?<![a-zA-Z0-9-])"
const IDENT_TAIL = "(?![a-zA-Z0-9-])"

/** `--token:` declaration sites in the pinned stylesheet text. */
function rawCssDefinitions(token: string): number {
  return [...pinnedCss.matchAll(new RegExp(`${IDENT_HEAD}${token}${IDENT_TAIL}\\s*:`, "g"))].length
}

/** Whitespace-tolerant `var( --token` consumption sites in the pinned stylesheet text. */
function rawCssVarConsumers(token: string): number {
  return [...pinnedCss.matchAll(new RegExp(`var\\(\\s*${token}${IDENT_TAIL}`, "g"))].length
}

/** Inventory `token-definition` occurrences indexed by custom-property name. */
const definitionsByToken = new Map<string, InventoryOccurrence[]>()
for (const occurrence of inventory.occurrences) {
  if (occurrence.kind !== "token-definition") continue
  const bucket = definitionsByToken.get(occurrence.property)
  if (bucket) bucket.push(occurrence)
  else definitionsByToken.set(occurrence.property, [occurrence])
}

/**
 * The component scope group a definition's selector list belongs to.
 *
 * Normalization — the reading of plan §5's "component scope groups" that
 * reproduces every recorded `def(n;cM)` tuple and therefore the plan §5
 * tables themselves:
 *  - pure root scopes (`:root`, `.theme_dark:root`, `.theme_auto:root`) are
 *    the root layer, not component scope groups → `null`;
 *  - a theme-classed compound's light/dark pair is ONE group (the two
 *    mirror-image declarations share one cascade role) →
 *    `Orb-Theme_theme_light|dark` collapses to a mode-less marker;
 *  - brand-variant forms of scopes that carry no theme class (the two fixed
 *    dark-in-light scopes) are the SAME group as their plain form — the brand
 *    classes ride the same element;
 *  - brand-variant forms of theme-classed compounds stay DISTINCT from the
 *    plain form (higher specificity class, plan §0), and brand-root compounds
 *    stay distinct per resolved root (plain/dark/auto) — three different
 *    emission scopes (plan §8/§9).
 *
 * Selector lists canonicalize to their sorted unique parts; whitespace
 * collapses. Any change on either side — registry evidence or inventory —
 * shifts a derived number and fails the corresponding test.
 */
function scopeGroupKey(selectorList: string): string | null {
  if (selectorList.trim().endsWith(":root")) return null
  const parts = selectorList.split(",").map((part) => {
    let key = part.trim().replace(/\s+/g, " ").replace(/Orb-Theme_theme_(light|dark)/g, "Orb-Theme_theme_M")
    if (!key.includes("Orb-Theme_theme_M")) {
      key = key.replace(/\.Orb-Brand_brand_telemost/g, "").replace(/\.brand_telemost/g, "").replace(/\s+/g, " ").trim()
    }
    return key
  })
  return [...new Set(parts)].sort().join(",")
}

function componentScopeGroups(token: string): number {
  const groups = new Set<string>()
  for (const definition of definitionsByToken.get(token) ?? []) {
    const key = scopeGroupKey(definition.selector)
    if (key !== null) groups.add(key)
  }
  return groups.size
}

/* ------------------------------------------------------------------ *
 * T-INV-01 — registry evidence holds, for each of the 124 entries
 * ------------------------------------------------------------------ */

describe("T-INV-01: registry evidence holds for all 124 entries", () => {
  test("every registry slot matches an exact slot key in semanticSlotsSchema", () => {
    for (const entry of SEMANTIC_SLOT_REGISTRY.values()) {
      const dummyValue =
        entry.kind === "shadow"
          ? "0 2px 4px rgba(0,0,0,0.5)"
          : entry.kind === "gradient"
            ? "linear-gradient(to right, red, blue)"
            : "#112233"
      const testObj = {
        [entry.category]: {
          [entry.key]: dummyValue,
        },
      }
      const parsed = semanticSlotsSchema.safeParse(testObj)
      expect(
        parsed.success,
        `registry slot ${entry.id} (${entry.category}.${entry.key}) must be accepted by semanticSlotsSchema`,
      ).toBe(true)
    }
  })
  const entries = [...SEMANTIC_SLOT_REGISTRY.values()]

  test("the production registry is field-faithful to the plan transcript (§5)", () => {
    const production = new Map(entries.map((entry) => [entry.id, entry]))
    const transcript = new Map(SEMANTIC_SLOT_SPECS.map((spec) => [spec.id, spec]))
    const problems: string[] = []
    for (const [id, spec] of transcript) {
      const entry = production.get(id)
      if (!entry) {
        problems.push(`${id}: missing from the production registry`)
        continue
      }
      const fields = [
        ["category", spec.category],
        ["key", spec.key],
        ["kind", spec.kind],
        ["token", spec.token],
        ["scopeClass", spec.scopeClass],
        ["evidence", spec.evidence],
      ] as const
      for (const [field, expected] of fields) {
        const actual = entry[field]
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          problems.push(`${id}.${field}: production ${JSON.stringify(actual)} ≠ plan ${JSON.stringify(expected)}`)
        }
      }
    }
    for (const id of production.keys()) {
      if (!transcript.has(id)) problems.push(`${id}: not in the plan transcript`)
    }
    expect(problems, "registry ↔ plan transcript drift").toEqual([])
  })

  test.each(entries.map((entry) => [entry.id, entry] as const))(
    "%s: evidence re-derives from the pinned sources",
    (_id, entry) => {
      const { evidence, token } = entry
      if (evidence.source === "def") {
        const definitions = definitionsByToken.get(token) ?? []
        expect(definitions, `${token}: inventory definition occurrences`).toHaveLength(evidence.definitions)
        expect(componentScopeGroups(token), `${token}: component scope groups`).toBe(evidence.scopeGroups)
      } else if (evidence.source === "raw") {
        // Skipped by the inventory's colorish heuristic by design (plan §5),
        // so the count must come from the pinned stylesheet itself.
        expect(definitionsByToken.has(token), `${token}: absent from the inventory`).toBe(false)
        expect(rawCssDefinitions(token), `${token}: raw-CSS definitions`).toBe(evidence.definitions)
      } else {
        // Reference-only: zero definitions anywhere; consumed via var().
        expect(definitionsByToken.has(token), `${token}: 0 inventory definitions`).toBe(false)
        expect(rawCssDefinitions(token), `${token}: 0 raw-CSS definitions`).toBe(0)
        expect(rawCssVarConsumers(token), `${token}: var() consumers`).toBe(evidence.consumers)
      }
    },
  )
})

/* ------------------------------------------------------------------ *
 * T-INV-02 — the rule allowlist derives from the inventory
 * ------------------------------------------------------------------ */

describe("T-INV-02: VERIFIED_RULE_TARGETS derives from the inventory", () => {
  /** Rule-target evidence: literal colors needing a same-selector rule (§10)… */
  const literalColorRule = inventory.occurrences.filter(
    (occurrence) => occurrence.override === "targeted-rule" && occurrence.kind === "literal-color",
  )
  /** …and full values (gradients/shadows) no token can recolor stop by stop. */
  const fullValueReplacement = inventory.occurrences.filter(
    (occurrence) => occurrence.override === "full-value-replacement",
  )

  const KINDS: readonly SemanticSlotKind[] = ["color", "shadow", "gradient"]

  /** The declared kind/property matrix (plan §11), via the production matrix. */
  function usableForSomeKind(property: string): boolean {
    return KINDS.some((kind) => slotKindAllowsProperty(kind, property))
  }

  const pairKey = (selector: string, property: string) => `${selector}\u0000${property}`

  /** Evidence pairs keyed byte-exactly, partitioned by the declared matrix. */
  const evidencePairs = new Map<string, { property: string; selector: string; usable: boolean }>()
  for (const occurrence of [...literalColorRule, ...fullValueReplacement]) {
    const key = pairKey(occurrence.selector, occurrence.property)
    if (!evidencePairs.has(key)) {
      evidencePairs.set(key, {
        property: occurrence.property,
        selector: occurrence.selector,
        usable: usableForSomeKind(occurrence.property),
      })
    }
  }
  const productionPairs = new Map(VERIFIED_RULE_TARGETS.map((target) => [pairKey(target.selector, target.property), target]))
  const usablePairs = [...evidencePairs].filter(([, pair]) => pair.usable)
  const excludedPairs = [...evidencePairs].filter(([, pair]) => !pair.usable)

  /** Every occurrence of every key, for the purity check below. */
  const occurrencesByPair = new Map<string, Set<string>>()
  for (const occurrence of inventory.occurrences) {
    const key = pairKey(occurrence.selector, occurrence.property)
    const bucket = occurrencesByPair.get(key) ?? new Set<string>()
    bucket.add(`${occurrence.override}/${occurrence.kind}`)
    occurrencesByPair.set(key, bucket)
  }

  test("occurrence counts match the plan (§10/§11): 175 targeted-rule + 14 full-value-replacement", () => {
    expect(literalColorRule, "targeted-rule literal-color occurrences").toHaveLength(175)
    expect(fullValueReplacement, "full-value-replacement occurrences").toHaveLength(14)
  })

  test("every entry occurs with a rule override, byte-exactly, with a derivable mode", () => {
    const problems: string[] = []
    for (const target of VERIFIED_RULE_TARGETS) {
      const evidence = evidencePairs.get(pairKey(target.selector, target.property))
      if (!evidence) {
        problems.push(`allowlist pair absent from rule-target evidence: ${JSON.stringify(target.selector)} ${target.property}`)
        continue
      }
      if (target.mode !== deriveRuleMode(target.selector)) {
        problems.push(`mode "${target.mode}" does not derive from the selector: ${JSON.stringify(target.selector)}`)
      }
    }
    expect(problems, "allowlist ↔ inventory drift").toEqual([])
  })

  test("evidence purity: an allowlisted pair is never also classified as a token occurrence", () => {
    const problems: string[] = []
    for (const target of VERIFIED_RULE_TARGETS) {
      const classifications = occurrencesByPair.get(pairKey(target.selector, target.property)) ?? new Set()
      const nonRule = [...classifications].filter(
        (tag) => !tag.startsWith("targeted-rule/") && !tag.startsWith("full-value-replacement/"),
      )
      if (nonRule.length > 0) {
        problems.push(`${JSON.stringify(target.selector)} ${target.property}: also ${nonRule.join(", ")}`)
      }
      if (classifications.size > 1) {
        problems.push(`${JSON.stringify(target.selector)} ${target.property}: mixed classifications ${[...classifications].join(", ")}`)
      }
    }
    expect(problems).toEqual([])
  })

  test("partition: every usable evidence pair is on the allowlist (nothing usable is dropped)", () => {
    expect(usablePairs, "usable evidence pairs under the declared matrix").toHaveLength(111)
    const missing = usablePairs
      .filter(([key]) => !productionPairs.has(key))
      .map(([, pair]) => `${pair.selector} ${pair.property}`)
    expect(missing, "usable evidence pairs missing from VERIFIED_RULE_TARGETS").toEqual([])
  })

  test("partition: the rest of the allowlist is exactly the retained full-value evidence no slot kind accepts", () => {
    // The declared kind/property matrix (plan §11) accepts no binding for
    // these properties: border shorthands hold full border values a color
    // cannot satisfy (§5.5), and the mask/text-fill pairs are full-value
    // replacement evidence. They stay on the allowlist as verified evidence,
    // partitioned out of the binding-usable set; the excluded property set is
    // pinned so a new excluded class cannot appear silently.
    const expectedExcludedProperties = [
      "-webkit-mask-image",
      "-webkit-tap-highlight-color",
      "-webkit-text-fill-color",
      "border",
      "border-block-start-color",
      "border-bottom",
      "mask-image",
    ]
    const actualExcludedProperties = [...new Set(excludedPairs.map(([, pair]) => pair.property))].sort()
    expect(actualExcludedProperties, "excluded property classes").toEqual(expectedExcludedProperties)
    expect(excludedPairs, "retained full-value evidence pairs").toHaveLength(28)

    const notOnAllowlist = excludedPairs.filter(([key]) => !productionPairs.has(key))
    expect(notOnAllowlist.map(([, pair]) => `${pair.selector} ${pair.property}`)).toEqual([])

    // Exact partition: production = usable ∪ excluded (disjoint by
    // construction), nothing else on the allowlist.
    const unaccounted = [...productionPairs.keys()].filter((key) => !evidencePairs.has(key))
    expect(unaccounted).toEqual([])
    expect(usablePairs.length + excludedPairs.length).toBe(productionPairs.size)
  })

  test("deterministic shape: 139 unique (selector, property) pairs", () => {
    expect(VERIFIED_RULE_TARGETS).toHaveLength(139)
    expect(productionPairs.size, "no duplicate pairs").toBe(139)
  })
})

/* ------------------------------------------------------------------ *
 * T-INV-03 — no ::selection anywhere
 * ------------------------------------------------------------------ */

describe("T-INV-03: no ::selection target anywhere", () => {
  const registryStrings = [...SEMANTIC_SLOT_REGISTRY.values()].flatMap((entry) => [
    entry.id,
    entry.category,
    entry.key,
    entry.token,
  ])
  const scopeSelectors = [
    ...Object.values(SEMANTIC_SCOPE_BLOCKS).flatMap((byMode) => [...byMode.light, ...byMode.dark]),
    ...SEMANTIC_AUTO_SCOPES.root,
    ...SEMANTIC_AUTO_SCOPES.brand,
  ]
  const allowlistStrings = VERIFIED_RULE_TARGETS.flatMap((target) => [target.selector, target.property])

  test("the pinned stylesheet contains zero ::selection rules (plan §5.11)", () => {
    expect(pinnedCss.match(/::selection/gi) ?? []).toEqual([])
  })

  test("registry, scope tables and rule allowlist never target ::selection", () => {
    const offenders = [...registryStrings, ...scopeSelectors, ...allowlistStrings].filter((value) =>
      value.includes("::selection"),
    )
    expect(offenders).toEqual([])
  })
})

/* ------------------------------------------------------------------ *
 * Deterministic counts (plan §5 registry totals, §11 allowlist)
 * ------------------------------------------------------------------ */

describe("deterministic counts", () => {
  const entries = [...SEMANTIC_SLOT_REGISTRY.values()]

  test("124 slots with 124 distinct token targets", () => {
    expect(entries).toHaveLength(124)
    expect(new Set(entries.map((entry) => entry.token))).toHaveLength(124)
  })

  test("kind split: 110 color / 12 shadow / 2 gradient", () => {
    const kinds: Record<string, number> = { color: 0, shadow: 0, gradient: 0 }
    for (const entry of entries) kinds[entry.kind]++
    expect(kinds).toEqual({ color: 110, shadow: 12, gradient: 2 })
  })

  test("evidence split: 118 def / 4 raw / 2 ref; every slot is a token redefinition", () => {
    const evidence: Record<string, number> = { def: 0, raw: 0, ref: 0 }
    const overrideMethods = new Set<string>()
    for (const entry of entries) {
      evidence[entry.evidence.source]++
      overrideMethods.add(entry.overrideMethod)
    }
    expect(evidence).toEqual({ def: 118, raw: 4, ref: 2 })
    // Plan §5 legend: rule bindings (`TAR`) and full-value replacement (`FVR`)
    // are not registry override methods in v1.
    expect([...overrideMethods]).toEqual(["TR"])
  })

  test("category sizes match plan §5", () => {
    const sizes: Record<string, number> = {}
    for (const entry of entries) sizes[entry.category] = (sizes[entry.category] ?? 0) + 1
    expect(sizes).toEqual({
      page: 7,
      surface: 13,
      elevation: 6,
      modal: 3,
      overlay: 5,
      line: 12,
      focus: 2,
      text: 9,
      icon: 2,
      control: 20,
      state: 8,
      selection: 4,
      status: 17,
      shadow: 14,
      gradient: 2,
    })
  })

  test("slot ids match the slotId shape (plan §3) and keys are unique per category", () => {
    // The plan §3 slotIdSchema shape, pinned here verbatim so a registry id
    // can never drift out of the config-reachable namespace.
    const slotIdPattern = /^[a-z]+\.[a-zA-Z0-9]+$/
    const seen = new Set<string>()
    const problems: string[] = []
    for (const entry of entries) {
      if (!slotIdPattern.test(entry.id)) problems.push(`${entry.id}: does not match ${slotIdPattern}`)
      const path = `${entry.category}.${entry.key}`
      if (seen.has(path)) problems.push(`${path}: duplicate category.key`)
      seen.add(path)
    }
    expect(problems).toEqual([])
  })

  test("the inventory describes exactly this pinned asset", () => {
    expect(inventory.schema).toBe("telemost-ui-color-inventory/1")
    expect(inventory.asset.path).toBe(ASSET_RELATIVE)
    expect(inventory.asset.sha256).toBe(createHash("sha256").update(readFileSync(ASSET_PATH)).digest("hex"))
    expect(inventory.asset.bytes).toBe(statSync(ASSET_PATH).size)
    expect(inventory.asset.lines).toBe(pinnedCss.split("\n").length)
    expect(inventory.summary.totalOccurrences).toBe(inventory.occurrences.length)
  })
})
