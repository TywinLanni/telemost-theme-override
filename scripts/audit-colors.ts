/**
 * Static color audit of the pinned Telemost stylesheet (bead tto-6ia.1).
 *
 * Reads `research_notes/Полная перекраска интерфейса Телемоста/evidence/telemost_ui.css`
 * READ-ONLY and inventories every color occurrence it can see: Orb/component
 * token definitions and references, literal colors, gradients, shadows, SVG
 * paint, native-control properties, and anything else color-bearing. For each
 * occurrence it records the selector/at-rule context, property, value, source
 * category, and the override method that applies under this project's actual
 * mechanism (the injected `#telemost-theme-override` sheet, appended last, plus
 * `mapping.ramps` / `lightOverrides` / `darkOverrides` from config/mapping.json).
 *
 * The output is deterministic: no wall-clock time, stable sort orders, and the
 * asset is identified by its SHA-256 instead of a timestamp. Running the script
 * twice on the same input must produce byte-identical JSON. The pinned input is
 * never modified; the report is written to reports/.
 *
 * Scope limits (recorded in the output itself, not just here): this is a static
 * CSS scan. Inline styles, DOM-drawn SVG, images, video, canvas and iframe
 * pixels are NOT visible in this asset and are listed as explicitly unverified
 * — they belong to the live-call half of tto-6ia.1.
 *
 * Usage: bun run scripts/audit-colors.ts [--out <path>]
 */

import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
export const ASSET_RELATIVE = "research_notes/Полная перекраска интерфейса Телемоста/evidence/telemost_ui.css"
const DEFAULT_OUT_RELATIVE = "reports/telemost_ui_color_inventory.json"
const MAX_VALUE_CHARS = 400

// ---------------------------------------------------------------------------
// Color knowledge
// ---------------------------------------------------------------------------

/** Longhands whose value position is a color by definition. */
const COLOR_LONGHANDS = new Set([
  "color",
  "background-color",
  "border-block-color",
  "border-block-end-color",
  "border-block-start-color",
  "border-bottom-color",
  "border-color",
  "border-inline-color",
  "border-inline-end-color",
  "border-inline-start-color",
  "border-left-color",
  "border-right-color",
  "border-top-color",
  "column-rule-color",
  "outline-color",
  "text-decoration-color",
  "text-emphasis-color",
])

/** Shorthands that may carry a color component (needs a color-ish check for bare var()). */
const COLOR_SHORTHANDS = new Set([
  "background",
  "background-image",
  "border",
  "border-block",
  "border-block-end",
  "border-block-start",
  "border-bottom",
  "border-inline",
  "border-inline-end",
  "border-inline-start",
  "border-left",
  "border-right",
  "border-top",
  "column-rule",
  "outline",
  "text-decoration",
  "text-emphasis",
])

const SVG_PAINT_PROPS = new Set(["fill", "stroke", "stop-color", "flood-color", "lighting-color"])

const NATIVE_CONTROL_PROPS = new Set(["accent-color", "caret-color", "color-scheme", "scrollbar-color"])

const SHADOW_PROPS = new Set(["box-shadow", "text-shadow"])

/**
 * Any color-ish var() name; used where a var() *may* be a color (shorthands, custom props).
 * `line` must not match `line-height`: the Orb typography ramp stores line heights under
 * `--orb-*-line-height` names (var()-valued, color-family-looking) and those are not colors.
 * Real line colors (`--orb-line-*`) keep matching via `line(?!-height)` and their literals.
 */
const COLORISH_NAME = /color|surface|line(?!-height)|shadow|scrim|bg|background|fill|stroke|border|overlay|accent|text|brand|divider|skeleton|placeholder/i

/** Pseudo-elements/pseudo-classes that restyle native controls. */
const NATIVE_PSEUDO = /::(selection|placeholder|-webkit-(scrollbar|resizer|input-placeholder)|-moz-(selection|placeholder))|:-webkit-autofill/i

const GRADIENT_FUNC = /[-a-zA-Z]*gradient\(/i

const FUNCTIONAL_COLOR_FUNCS = new Set([
  "rgb",
  "rgba",
  "hsl",
  "hsla",
  "hwb",
  "lab",
  "lch",
  "oklab",
  "oklch",
  "color",
  "color-mix",
])

/** CSS Color 4 named colors. */
const NAMED_COLORS = new Set([
  "aliceblue", "antiquewhite", "aqua", "aquamarine", "azure", "beige", "bisque",
  "black", "blanchedalmond", "blue", "blueviolet", "brown", "burlywood",
  "cadetblue", "chartreuse", "chocolate", "coral", "cornflowerblue", "cornsilk",
  "crimson", "cyan",
  "darkblue", "darkcyan", "darkgoldenrod", "darkgray", "darkgreen", "darkgrey",
  "darkkhaki", "darkmagenta", "darkolivegreen", "darkorange", "darkorchid",
  "darkred", "darksalmon", "darkseagreen", "darkslateblue", "darkslategray",
  "darkslategrey", "darkturquoise", "darkviolet", "deeppink", "deepskyblue",
  "dimgray", "dimgrey", "dodgerblue",
  "firebrick", "floralwhite", "forestgreen", "fuchsia",
  "gainsboro", "ghostwhite", "gold", "goldenrod", "gray", "green", "greenyellow", "grey",
  "honeydew", "hotpink",
  "indianred", "indigo", "ivory",
  "khaki",
  "lavender", "lavenderblush", "lawngreen", "lemonchiffon", "lightblue",
  "lightcoral", "lightcyan", "lightgoldenrodyellow", "lightgray", "lightgreen",
  "lightgrey", "lightpink", "lightsalmon", "lightseagreen", "lightskyblue",
  "lightslategray", "lightslategrey", "lightsteelblue", "lightyellow",
  "lime", "limegreen", "linen",
  "magenta", "maroon", "mediumaquamarine", "mediumblue", "mediumorchid",
  "mediumpurple", "mediumseagreen", "mediumslateblue", "mediumspringgreen",
  "mediumturquoise", "mediumvioletred", "midnightblue", "mintcream",
  "mistyrose", "moccasin",
  "navajowhite", "navy",
  "oldlace", "olive", "olivedrab", "orange", "orangered", "orchid",
  "palegoldenrod", "palegreen", "paleturquoise", "palevioletred", "papayawhip",
  "peachpuff", "peru", "pink", "plum", "powderblue", "purple",
  "rebeccapurple", "red", "rosybrown", "royalblue",
  "saddlebrown", "salmon", "sandybrown", "seagreen", "seashell", "sienna",
  "silver", "skyblue", "slateblue", "slategray", "slategrey", "snow",
  "springgreen", "steelblue",
  "tan", "teal", "thistle", "tomato", "turquoise",
  "violet",
  "wheat", "white", "whitesmoke",
  "yellow", "yellowgreen",
])

/** CSS Color 4 system colors plus the legacy set still seen in the wild. */
const SYSTEM_COLORS = new Set([
  "canvas", "canvastext", "linktext", "visitedtext", "activetext",
  "buttonface", "buttontext", "buttonborder", "field", "fieldtext",
  "highlight", "highlighttext", "selecteditem", "selecteditemtext",
  "mark", "marktext", "graytext", "accentcolor", "accentcolortext",
  "activeborder", "activecaption", "appworkspace", "background",
  "buttonhighlight", "buttonshadow", "captiontext", "inactiveborder",
  "inactivecaption", "inactivecaptiontext", "infobackground", "infotext",
  "menu", "menutext", "scrollbar", "threeddarkshadow", "threedface",
  "threedhighlight", "threedlightshadow", "threedshadow", "window",
  "windowframe", "windowtext",
])

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TokenType = "hex" | "function" | "keyword" | "system" | "transparent" | "currentcolor" | "var"

interface ColorToken {
  readonly type: TokenType
  /** As written in the stylesheet. */
  readonly raw: string
  /** Normalized (lowercase, whitespace collapsed) form used for aggregation. */
  readonly normalized: string
  /** Custom-property name, for type "var". */
  readonly name?: string
}

type OccurrenceKind =
  | "token-definition"
  | "token-reference"
  | "literal-color"
  | "gradient"
  | "shadow"
  | "svg-paint"
  | "native-control"
  | "other"

type OverrideMethodId =
  | "orb-ramp"
  | "token-redefinition"
  | "upstream-token"
  | "targeted-rule"
  | "full-value-replacement"

export interface Occurrence {
  readonly id: number
  readonly line: number
  readonly column: number
  /** Enclosing at-rule preludes, outermost first. Empty at top level. */
  readonly atRules: readonly string[]
  /** Rule prelude; "" when declarations sit directly inside an at-rule. */
  readonly selector: string
  readonly property: string
  readonly value: string
  readonly kind: OccurrenceKind
  readonly sources: readonly string[]
  readonly override: OverrideMethodId
  /** Value-shape markers kept separate from `kind`: "gradient", "drop-shadow", "native-pseudo". */
  readonly flags: readonly string[]
  readonly tokens: readonly ColorToken[]
}

interface OverrideMethodDoc {
  readonly summary: string
  readonly how: string
}

interface Frame {
  readonly kind: "root" | "atrule" | "rule"
  readonly prelude: string
}

// ---------------------------------------------------------------------------
// Override methods — grounded in this project's real mechanism
// ---------------------------------------------------------------------------

const OVERRIDE_METHODS: Record<OverrideMethodId, OverrideMethodDoc> = {
  "orb-ramp": {
    summary: "Repaint the Orb primitive ramp family",
    how:
      "The occurrence defines --orb-color-<family>-<step>. Add or extend a `ramps` entry " +
      "for that family in config/mapping.json (seed or accentScale); buildCss() re-emits the " +
      "whole ramp on :root, :root.theme_dark and :root.theme_auto in the injected sheet.",
  },
  "token-redefinition": {
    summary: "Redefine the custom property",
    how:
      "Add `name: value` to mapping.lightOverrides / mapping.darkOverrides in config/mapping.json " +
      "(or extend buildCss()). The override is emitted on :root / .theme_dark scopes inside the " +
      "injected sheet, which is appended last and wins cascade ties without !important.",
  },
  "upstream-token": {
    summary: "Override the referenced token, not this rule",
    how:
      "The rule only consumes var(--...). Redefining the upstream token (orb-ramp or " +
      "token-redefinition above) recolors every consumer, including this one.",
  },
  "targeted-rule": {
    summary: "Targeted rule in the injected sheet",
    how:
      "No token exists here. Emit a rule with the same selector and property in the injected " +
      "#telemost-theme-override stylesheet: it is appended last, so equal specificity wins. " +
      "Such point rules are the subject of tto-6ia.6.",
  },
  "full-value-replacement": {
    summary: "Replace the whole property value",
    how:
      "Gradients and shadows cannot be recolored stop by stop. Emit a same-or-higher-specificity " +
      "rule in the injected sheet replacing the full value; any stop/shadow that is already a " +
      "var() keeps following token overrides.",
  },
}

/** Fixed display orders so summaries stay comparable across runs. */
const ALL_KINDS: readonly OccurrenceKind[] = [
  "token-definition",
  "token-reference",
  "literal-color",
  "gradient",
  "shadow",
  "svg-paint",
  "native-control",
  "other",
]

const ALL_FLAGS = ["gradient", "drop-shadow", "native-pseudo"] as const

const ALL_OVERRIDES: readonly OverrideMethodId[] = [
  "orb-ramp",
  "token-redefinition",
  "upstream-token",
  "targeted-rule",
  "full-value-replacement",
]

// ---------------------------------------------------------------------------
// CSS scanning — a minimal single-pass parser, no dependencies
// ---------------------------------------------------------------------------

export interface ScanResult {
  readonly occurrences: Occurrence[]
  /** ;-terminated chunks that were not `property: value` declarations (e.g. @import). */
  readonly skippedFragments: number
  /** Values shortened to MAX_VALUE_CHARS. */
  readonly truncatedValues: number
}

function consumeString(css: string, start: number): number {
  // css[start] is the opening quote; handles backslash escapes.
  const quote = css[start]
  let i = start + 1
  while (i < css.length) {
    const ch = css[i]
    if (ch === "\\") {
      i += 2
      continue
    }
    if (ch === quote) return i + 1
    if (ch === "\n") return i // unterminated; let the main loop recover
    i += 1
  }
  return i
}

function consumeComment(css: string, start: number): number {
  const end = css.indexOf("*/", start + 2)
  return end === -1 ? css.length : end + 2
}

/** Consumes an unquoted url(...) token body; data URIs are masked, never tokenized. */
function consumeUrlBody(css: string, start: number): number {
  let i = start
  while (i < css.length && /\s/.test(css[i])) i += 1
  if (i < css.length && (css[i] === '"' || css[i] === "'")) {
    i = consumeString(css, i)
  } else {
    while (i < css.length && css[i] !== ")") {
      if (css[i] === "\\") i += 2
      else i += 1
    }
  }
  while (i < css.length && /\s/.test(css[i])) i += 1
  return i < css.length && css[i] === ")" ? i + 1 : i
}

function consumeBalanced(css: string, start: number): number {
  // css[start] === "("; returns index after the matching ")".
  let depth = 0
  let i = start
  while (i < css.length) {
    const ch = css[i]
    if (ch === '"' || ch === "'") {
      i = consumeString(css, i)
      continue
    }
    if (ch === "(") depth += 1
    else if (ch === ")") {
      depth -= 1
      if (depth === 0) return i + 1
    }
    i += 1
  }
  return i
}

function scanColorsInValue(value: string): ColorToken[] {
  const tokens: ColorToken[] = []
  const collapse = (text: string): string => text.replace(/\s+/g, " ").trim().toLowerCase()

  let i = 0
  while (i < value.length) {
    const ch = value[i]

    // Strings never contain inventory-relevant colors (font names, content).
    if (ch === '"' || ch === "'") {
      i = consumeString(value, i)
      continue
    }

    if (ch === "#" && /[0-9a-fA-F]/.test(value[i + 1] ?? "")) {
      const match = /^#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})/.exec(value.slice(i))
      if (match) {
        tokens.push({ type: "hex", raw: match[0], normalized: match[0].toLowerCase() })
        i += match[0].length
        continue
      }
      i += 1
      continue
    }

    if (/[a-zA-Z-]/.test(ch)) {
      const wordMatch = /^[-a-zA-Z][-a-zA-Z0-9]*/.exec(value.slice(i))
      const word = wordMatch ? wordMatch[0] : ch
      const after = i + word.length
      const next = value[after]

      if (next === "(") {
        const name = word.toLowerCase()
        if (name === "url") {
          // url(...) bodies are masked on purpose: data-URI colors are pixel sources.
          i = consumeUrlBody(value, after)
          continue
        }
        if (name === "var") {
          const close = consumeBalanced(value, after)
          const body = value.slice(i, close)
          // Custom-property names are CSS idents: any code point >= U+0080 is an
          // ident char, so the capture must not be ASCII-only. Names end where
          // the fallback separator (whitespace/comma) or the call closes.
          const ref = /var\(\s*(--[^\s,)]+)/.exec(body)
          const varName = ref ? ref[1] : body
          tokens.push({ type: "var", raw: body, normalized: varName.toLowerCase(), name: varName })
          i = close
          continue
        }
        if (FUNCTIONAL_COLOR_FUNCS.has(name)) {
          const close = consumeBalanced(value, after)
          tokens.push({ type: "function", raw: value.slice(i, close), normalized: collapse(value.slice(i, close)) })
          i = close
          continue
        }
        // Any other function (gradients, calc, transforms): the call itself is
        // not a token, but its arguments hold colors and var()s — step past the
        // name and keep scanning inside instead of swallowing the whole call.
        i = after
        continue
      }

      const lower = word.toLowerCase()
      if (lower === "transparent") {
        tokens.push({ type: "transparent", raw: word, normalized: lower })
      } else if (lower === "currentcolor") {
        tokens.push({ type: "currentcolor", raw: word, normalized: lower })
      } else if (NAMED_COLORS.has(lower)) {
        tokens.push({ type: "keyword", raw: word, normalized: lower })
      } else if (SYSTEM_COLORS.has(lower)) {
        tokens.push({ type: "system", raw: word, normalized: lower })
      }
      i = after
      continue
    }

    i += 1
  }

  return tokens
}

function isColorBearing(property: string, tokens: readonly ColorToken[]): boolean {
  const isCustom = property.startsWith("--")
  const hasLiteral = tokens.some((token) => token.type !== "var")
  const colorishVar = tokens.some(
    (token) => token.type === "var" && token.name !== undefined && COLORISH_NAME.test(token.name),
  )

  if (isCustom) {
    // Heuristic (documented in the output): a token whose own name says color,
    // or whose value carries a literal color or a color-ish var(), counts.
    return hasLiteral || colorishVar || (COLORISH_NAME.test(property) && tokens.length > 0)
  }

  if (COLOR_LONGHANDS.has(property) || SVG_PAINT_PROPS.has(property) || SHADOW_PROPS.has(property)) {
    return hasLiteral || tokens.length > 0
  }

  if (NATIVE_CONTROL_PROPS.has(property)) {
    // color-scheme: light dark carries no color token but is inventory-relevant.
    return hasLiteral || colorishVar || property === "color-scheme"
  }

  if (COLOR_SHORTHANDS.has(property)) {
    // Shorthand var() may be a width/spacing component: require a color-ish name.
    return hasLiteral || colorishVar
  }

  // Non-color properties with a literal color in the value (e.g. filter: drop-shadow(...)).
  return hasLiteral
}

/**
 * True when `:root` appears at the top level of the compound (not nested in a
 * functional pseudo-class argument or attribute selector) and is not part of a
 * longer ident-like pseudo-class name.
 */
function hasTopLevelRoot(subject: string): boolean {
  let depth = 0
  for (let i = 0; i < subject.length; i += 1) {
    const ch = subject[i]
    if (ch === "(" || ch === "[") {
      depth += 1
      continue
    }
    if (ch === ")" || ch === "]") {
      depth -= 1
      continue
    }
    if (depth === 0 && subject.startsWith(":root", i)) {
      const after = subject[i + 5]
      if (after === undefined || !/[a-zA-Z0-9_-]/.test(after)) return true
    }
  }
  return false
}

/**
 * True when every comma-part's *subject* compound (the last compound, after the
 * final top-level combinator) selects the root element itself — e.g. `:root`,
 * `:root.brand_telemost`, `.theme_dark:root`, `.Orb-Brand_x :root`. Selectors
 * where `html`/`:root` appear only as an ancestor (`html[dir=rtl] .yamb-x`)
 * declare the property on a component element and are NOT root-scoped.
 * Functional arguments in these preludes are space-free, so splitting the part
 * on combinators is safe; deeper selector grammars degrade to "not root",
 * which prescribes the always-winning targeted rule.
 */
function selectorTargetsRootElement(selector: string): boolean {
  const parts = selector
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  if (parts.length === 0) return false
  return parts.every((part) => {
    const compounds = part.split(/[\s>+~]+/)
    const subject = compounds[compounds.length - 1]
    if (subject === undefined || subject.length === 0) return false
    return hasTopLevelRoot(subject)
  })
}

function classify(
  property: string,
  value: string,
  selector: string,
  tokens: readonly ColorToken[],
): { kind: OccurrenceKind; override: OverrideMethodId } {
  const isCustom = property.startsWith("--")
  const hasLiteral = tokens.some((token) => token.type !== "var")
  const hasVar = tokens.some((token) => token.type === "var")

  if (isCustom) {
    const orbRamp = /^--orb-color-[a-z0-9-]+-(alpha-\d+|light-\d+|\d+)$/.test(property)
    // token-redefinition is only prescribed when it can actually win: buildCss()
    // emits light/darkOverrides on :root / .theme_dark scopes (including
    // .brand_telemost compounds) inside the injected sheet appended last, so it
    // beats an author definition whose subject is the root element on cascade
    // ties. A definition on any other element beats inherited root values
    // outright — the winning move there is a targeted rule on the same
    // selector, which appended-last wins at equal specificity.
    return {
      kind: "token-definition",
      override: orbRamp
        ? "orb-ramp"
        : selectorTargetsRootElement(selector)
          ? "token-redefinition"
          : "targeted-rule",
    }
  }
  if (SVG_PAINT_PROPS.has(property)) return { kind: "svg-paint", override: hasVar ? "upstream-token" : "targeted-rule" }
  if (NATIVE_CONTROL_PROPS.has(property) || NATIVE_PSEUDO.test(selector)) {
    return { kind: "native-control", override: hasVar ? "upstream-token" : "targeted-rule" }
  }
  if (GRADIENT_FUNC.test(value)) {
    return { kind: "gradient", override: hasVar && !hasLiteral ? "upstream-token" : "full-value-replacement" }
  }
  if (SHADOW_PROPS.has(property) || /drop-shadow\(/i.test(value)) {
    return { kind: "shadow", override: hasVar && !hasLiteral ? "upstream-token" : "full-value-replacement" }
  }
  if (hasVar && !hasLiteral) return { kind: "token-reference", override: "upstream-token" }
  if (hasLiteral) return { kind: "literal-color", override: "targeted-rule" }
  return { kind: "other", override: "targeted-rule" }
}

function classifySources(tokens: readonly ColorToken[]): string[] {
  const usesOrb = tokens.some((token) => token.type === "var" && (token.name ?? "").startsWith("--orb-"))
  const usesComponent = tokens.some((token) => token.type === "var" && !(token.name ?? "").startsWith("--orb-"))
  const hasLiteral = tokens.some((token) => token.type !== "var")

  const sources: string[] = []
  if (usesOrb) sources.push("orb-token")
  if (usesComponent) sources.push("component-token")
  if (hasLiteral) sources.push("literal-css")
  if (sources.length === 0) sources.push("other")
  return sources
}

export function parseStylesheet(css: string): ScanResult {
  const occurrences: Occurrence[] = []
  let skippedFragments = 0
  let truncatedValues = 0
  let nextId = 1

  const stack: Frame[] = [{ kind: "root", prelude: "" }]
  const atRules = (): string[] => stack.slice(1).filter((f) => f.kind === "atrule").map((f) => f.prelude)
  const selector = (): string => {
    for (let i = stack.length - 1; i >= 1; i -= 1) {
      const frame = stack[i]
      if (frame && frame.kind === "rule") return frame.prelude
    }
    return ""
  }

  let buffer = ""
  let bufferLine = 1
  let bufferColumn = 1
  let line = 1
  let column = 1

  // Index-based so columns count UTF-16 code units exactly like the main loop does.
  const track = (text: string): void => {
    for (let k = 0; k < text.length; k += 1) {
      if (text[k] === "\n") {
        line += 1
        column = 1
      } else {
        column += 1
      }
    }
  }

  const flushDeclaration = (): void => {
    const text = buffer.trim()
    buffer = ""
    if (text.length === 0) return

    const colon = text.indexOf(":")
    if (colon === -1) {
      // @import/@charset-style statement fragment; not a declaration.
      skippedFragments += 1
      return
    }

    const property = text.slice(0, colon).trim().toLowerCase()
    const rawValue = text.slice(colon + 1).trim()
    if (property.length === 0) {
      skippedFragments += 1
      return
    }

    const tokens = scanColorsInValue(rawValue)
    if (!isColorBearing(property, tokens)) return

    const rule = selector()
    const { kind, override } = classify(property, rawValue, rule, tokens)
    const value = rawValue.length > MAX_VALUE_CHARS ? rawValue.slice(0, MAX_VALUE_CHARS) : rawValue
    if (value.length !== rawValue.length) truncatedValues += 1

    // Value-shape flags stay visible even when `kind` is dominated by a
    // token-definition — a gradient living inside --component-x still matters.
    const flags: string[] = []
    if (GRADIENT_FUNC.test(rawValue)) flags.push("gradient")
    if (/drop-shadow\(/i.test(rawValue)) flags.push("drop-shadow")
    if (NATIVE_PSEUDO.test(rule)) flags.push("native-pseudo")

    occurrences.push({
      id: nextId,
      line: bufferLine,
      column: bufferColumn,
      atRules: atRules(),
      selector: rule,
      property,
      value,
      kind,
      sources: classifySources(tokens),
      override,
      flags,
      tokens,
    })
    nextId += 1
  }

  let i = 0
  while (i < css.length) {
    const ch = css[i]

    if (ch === '"' || ch === "'") {
      const end = consumeString(css, i)
      buffer += css.slice(i, end)
      track(css.slice(i, end))
      i = end
      continue
    }

    if (ch === "/" && css[i + 1] === "*") {
      const end = consumeComment(css, i)
      track(css.slice(i, end))
      i = end
      continue
    }

    // The buffer ends with the url() *name* right as the "(" is examined (the
    // paren itself is not in the buffer yet). The preceding char must be a
    // non-ident char so only the genuine `url` function token is masked —
    // data URIs legally carry `;` and `{`/`}` inside the token body.
    if (ch === "(" && /(?:^|[^a-zA-Z0-9_\\-])url$/i.test(buffer)) {
      const end = consumeUrlBody(css, i + 1)
      buffer += css.slice(i, end)
      track(css.slice(i, end))
      i = end
      continue
    }

    if (ch === "{") {
      const prelude = buffer.trim()
      buffer = ""
      stack.push({ kind: prelude.startsWith("@") ? "atrule" : "rule", prelude })
      column += 1
      i += 1
      continue
    }

    if (ch === "}") {
      flushDeclaration()
      if (stack.length > 1) stack.pop()
      column += 1
      i += 1
      continue
    }

    if (ch === ";") {
      flushDeclaration()
      column += 1
      i += 1
      continue
    }

    if (buffer.trim().length === 0 && !/\s/.test(ch)) {
      bufferLine = line
      bufferColumn = column
    }

    buffer += ch
    // Ordinary newlines are content too: advance the line counter so
    // occurrences outside strings/comments/url bodies report real positions.
    if (ch === "\n") {
      line += 1
      column = 1
    } else {
      column += 1
    }
    i += 1
  }
  flushDeclaration()

  return { occurrences, skippedFragments, truncatedValues }
}

// ---------------------------------------------------------------------------
// Aggregation — deterministic orders only
// ---------------------------------------------------------------------------

function countBy<T>(items: readonly T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of items) {
    const k = key(item)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return counts
}

function sortedCounts(counts: Map<string, number>): Array<{ name: string; count: number }> {
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}

interface ColorAggregate {
  value: string
  count: number
  kinds: string[]
}

function aggregateColors(occurrences: readonly Occurrence[]): ColorAggregate[] {
  const byValue = new Map<string, { value: string; count: number; kinds: Set<string> }>()
  for (const occurrence of occurrences) {
    for (const token of occurrence.tokens) {
      const entry = byValue.get(token.normalized) ?? { value: token.normalized, count: 0, kinds: new Set<string>() }
      entry.count += 1
      entry.kinds.add(token.type)
      byValue.set(token.normalized, entry)
    }
  }
  return [...byValue.values()]
    .map((entry) => ({ value: entry.value, count: entry.count, kinds: [...entry.kinds].sort() }))
    .sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : a.value > b.value ? 1 : 0))
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function parseArgs(argv: readonly string[]): string {
  let out = DEFAULT_OUT_RELATIVE
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--out") {
      const value = argv[i + 1]
      if (!value) throw new Error("--out requires a path")
      out = value
      i += 1
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }
  const resolved = resolve(ROOT, out)
  // The pinned asset is READ-ONLY evidence (SHA-256-identified in the report);
  // refuse any --out spelling that would resolve onto it.
  if (resolved === resolve(ROOT, ASSET_RELATIVE)) {
    throw new Error(`--out must not overwrite the pinned read-only input asset: ${ASSET_RELATIVE}`)
  }
  return resolved
}

async function main(): Promise<void> {
  const outPath = parseArgs(process.argv.slice(2))

  const assetBytes = await Bun.file(resolve(ROOT, ASSET_RELATIVE)).arrayBuffer()
  // Read-only by construction: the asset is only ever hashed and parsed here.
  const sha256 = new Bun.CryptoHasher("sha256").update(new Uint8Array(assetBytes)).digest("hex")
  const css = new TextDecoder().decode(assetBytes)

  const { occurrences, skippedFragments, truncatedValues } = parseStylesheet(css)

  // Factual, derived count of url() occurrences in the stylesheet text — the
  // note must not misstate the asset it describes (same case-sensitive literal
  // count a reader can verify with `css.match(/url\(/g)`).
  const urlReferenceCount = (css.match(/url\(/g) ?? []).length

  const byKind = sortedCounts(countBy(occurrences, (o) => o.kind))
  const bySource = sortedCounts(countBy(occurrences, (o) => o.sources.join("+")))
  const byProperty = sortedCounts(countBy(occurrences, (o) => o.property))
  const byOverride = sortedCounts(countBy(occurrences, (o) => o.override))
  const byFlag = sortedCounts(
    countBy(
      occurrences.flatMap((o) => o.flags),
      (flag) => flag,
    ),
  )
  const colors = aggregateColors(occurrences)

  const report = {
    schema: "telemost-ui-color-inventory/1",
    asset: {
      path: ASSET_RELATIVE,
      sha256,
      bytes: assetBytes.byteLength,
      lines: css.split("\n").length,
    },
    summary: {
      totalOccurrences: occurrences.length,
      uniqueColors: colors.length,
      byKind: Object.fromEntries(byKind.map((entry) => [entry.name, entry.count])),
      bySource: Object.fromEntries(bySource.map((entry) => [entry.name, entry.count])),
      byFlag: Object.fromEntries(byFlag.map((entry) => [entry.name, entry.count])),
      byOverrideMethod: Object.fromEntries(byOverride.map((entry) => [entry.name, entry.count])),
    },
    overrideMethods: OVERRIDE_METHODS,
    heuristics: {
      colorishVarName: COLORISH_NAME.source,
      notes: [
        "Custom property is color-bearing when its value holds a literal color, a color-ish var(), or its own name is color-ish and it holds any var().",
        "A var() inside a color shorthand (e.g. border, background) counts only when the referenced name is color-ish; the referenced token is not resolved, so a var() may stand for a non-color component.",
        "url(...) bodies are masked on purpose: colors baked into data URIs/images are pixel sources, out of scope for a CSS scan.",
        "Token references are resolved by name only; no cascade or computed values are simulated.",
      ],
      skippedFragments,
      truncatedValues,
    },
    unverified: [
      { source: "inline-style", note: "Element style attributes are not part of this stylesheet; live-call DOM is unverified." },
      {
        source: "svg-dom",
        note: `SVG drawn in the DOM (attributes/presentation) is not visible in CSS; the stylesheet text contains ${urlReferenceCount} url() occurrence${urlReferenceCount === 1 ? "" : "s"}, masked from the token inventory and not verified.`,
      },
      { source: "image", note: "Raster and data-URI image pixels are out of scope for static analysis." },
      { source: "video", note: "Video frames are pixel sources; not analyzable here." },
      { source: "canvas", note: "Canvas painting is a pixel source; not analyzable here." },
      { source: "iframe", note: "Embedded documents carry their own stylesheets; not analyzable here." },
      { source: "live-call-dom", note: "The live call DOM remains unverified and belongs to the runtime half of tto-6ia.1." },
    ],
    properties: Object.fromEntries(byProperty.map((entry) => [entry.name, entry.count])),
    colors,
    occurrences,
  }

  await mkdir(dirname(outPath), { recursive: true })
  const json = `${JSON.stringify(report, null, 2)}\n`
  await writeFile(outPath, json, "utf8")

  // Concise semantic/source summary for the console. Fixed orders with
  // zero-fill so consecutive runs and half-empty tables stay comparable.
  const width = 28
  const row = (label: string, count: number): string => `  ${label.padEnd(width)}${String(count)}`
  const formatCounts = (entries: Array<{ name: string; count: number }>): string =>
    entries.map((entry) => row(entry.name, entry.count)).join("\n")
  const zeroFilled = (order: readonly string[], entries: Array<{ name: string; count: number }>): string => {
    const counts = new Map(entries.map((entry) => [entry.name, entry.count]))
    return order.map((name) => row(name, counts.get(name) ?? 0)).join("\n")
  }

  const topColors = colors
    .slice(0, 15)
    .map((entry) => row(entry.value, entry.count))
    .join("\n")

  process.stdout.write(
    [
      `asset   ${ASSET_RELATIVE}`,
      `        sha256 ${sha256.slice(0, 16)}…  ${assetBytes.byteLength} bytes`,
      "",
      `color occurrences: ${occurrences.length}  (unique colors: ${colors.length})`,
      "",
      "by kind:",
      zeroFilled(ALL_KINDS, byKind),
      "",
      "by source:",
      formatCounts(bySource),
      "",
      "by value-shape flag:",
      zeroFilled(ALL_FLAGS, byFlag),
      "",
      "by override method:",
      zeroFilled(ALL_OVERRIDES, byOverride),
      "",
      "top colors:",
      topColors,
      "",
      "unverified (not analyzable from this asset): inline-style, svg-dom, image, video, canvas, iframe, live-call-dom",
      `report  ${outPath}`,
      "",
    ].join("\n"),
  )
}

// Test seam: importing this module must not execute the audit; only the CLI
// entry point (`bun run scripts/audit-colors.ts`) does.
if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(`audit-colors failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
