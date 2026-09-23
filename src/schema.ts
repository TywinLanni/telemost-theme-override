import { z } from "zod"

/**
 * Zod schemas are the single source of truth for every external boundary:
 *  - theme files (seed colors)
 *  - the ramp-mapping config
 *  - CDP wire messages
 *
 * Anything crossing a boundary is parsed, never cast.
 */

export const hexColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "expected a hex color like #1dcc66 or #0bb55233")

/**
 * Seed colors — a deliberately reduced subset of shuvcode's palette.
 *
 * shuvcode themes also carry `diffAdd`/`diffDelete` seeds and a large
 * `overrides` map, but those describe an IDE surface (diff gutters, syntax
 * highlighting, markdown) with no analogue in Telemost. Verified empirically:
 * stripping all 251 overrides out of oc-1.json produced byte-identical CSS,
 * because nothing in this project ever read them.
 *
 * Only seeds matter here — Orb's primitive ramps are regenerated from them.
 */
export const themeSeedColorsSchema = z.object({
  neutral: hexColorSchema,
  primary: hexColorSchema,
  success: hexColorSchema,
  warning: hexColorSchema,
  error: hexColorSchema,
  info: hexColorSchema,
  interactive: hexColorSchema,
})

/**
 * A hand-authored 12-step scale, light-to-dark, copied from shuvcode's
 * `colors.css` (e.g. `cobalt-dark-1..12`).
 *
 * Preferred over deriving everything from `seeds.interactive`: those scales were
 * tuned by hand and already sit inside sRGB, whereas generating a ramp from one
 * highly saturated seed (cobalt is C=0.269 vs the stock green's C=0.194) clips
 * at the light end and drifts hue by up to 15 degrees.
 */
export const paletteScaleSchema = z.array(hexColorSchema).length(12)

/* ------------------------------------------------------------------ *
 * Semantic color slots (plan §2–§3)
 *
 * Optional per-light/dark semantic slots in theme.json, nested by category.
 * Strict at every level: unknown slot keys are config errors, not silent
 * no-ops. Values are hex colors, or full shadow/gradient strings for the two
 * value-slot kinds.
 * ------------------------------------------------------------------ */

export const cssCustomPropertyNameSchema = z
  .string()
  .regex(/^--[a-zA-Z0-9-]{2,}$/, "expected a CSS custom property name like --orb-text-primary")

export const cssPropertyNameSchema = z
  .string()
  .regex(/^-?[a-zA-Z][a-zA-Z0-9-]*$/, "expected a CSS property name like background-color")

/**
 * Every user value is banned from ; { } @ " ' ! so it can never close its
 * block, open an at-rule or flag, or break out of a quoted context.
 * Parentheses must balance so function bodies stay inside the declaration.
 * The `!` ban makes `!important` unreachable from user values.
 */
export function balancedParens(value: string): boolean {
  let depth = 0
  for (const ch of value) {
    if (ch === "(") depth++
    else if (ch === ")") {
      depth--
      if (depth < 0) return false
    }
  }
  return depth === 0
}

export const safeCssValueSchema = z
  .string()
  .min(1)
  .max(512)
  .regex(/^[^;{}@"'!]+$/, 'value must not contain ; { } @ " \' or !')
  .refine(balancedParens, "parentheses must be balanced")

export const semanticColorValueSchema = hexColorSchema

export const shadowValueSchema = safeCssValueSchema.refine(
  (v) => !/url\(/i.test(v),
  "shadow values must not contain url()",
)

export const gradientValueSchema = safeCssValueSchema
  .refine((v) => /gradient\(/i.test(v), "gradient values must contain gradient(")
  .refine((v) => !/url\(/i.test(v), "gradient values must not contain url()")

/** Slot ids are `category.key`, e.g. `page.background` (plan §5). */
export const slotIdSchema = z
  .string()
  .regex(/^[a-z]+\.[a-zA-Z0-9]+$/, "expected a slot id like page.background")

/**
 * Zod v4's `unrecognized_keys` issue stops its path at the owning object and
 * carries the offending key only in the message. Config errors must name the
 * full slot path (`light.semantic.page.backgroud`), so strictness is enforced
 * with an explicit check that pushes one path-carrying issue per unknown key.
 * The object itself is a `looseObject` purely so unknown keys survive parsing
 * long enough to be reported; failed parses produce no output, and valid
 * configs contain no unknown keys, so the output is identical to a strict
 * object's.
 */
function strictKeyed<S extends z.ZodRawShape>(shape: S) {
  return z.looseObject(shape).check((ctx) => {
    for (const key of Object.keys(ctx.value)) {
      if (!(key in shape)) {
        ctx.issues.push({
          code: "custom",
          input: ctx.value,
          path: [key],
          message: `unknown key "${key}"`,
        })
      }
    }
  })
}

/** Canonical category order (plan §3); drives deterministic emission order (§12). */
export const SEMANTIC_CATEGORIES = [
  "page",
  "surface",
  "elevation",
  "modal",
  "overlay",
  "line",
  "focus",
  "text",
  "icon",
  "control",
  "state",
  "selection",
  "status",
  "shadow",
  "gradient",
] as const

export type SemanticCategory = (typeof SEMANTIC_CATEGORIES)[number]

export const pageSemanticSlotsSchema = strictKeyed({
  background: semanticColorValueSchema.optional(),
  backgroundSecondary: semanticColorValueSchema.optional(),
  settingsBackground: semanticColorValueSchema.optional(),
  actionbar: semanticColorValueSchema.optional(),
  surface: semanticColorValueSchema.optional(),
  poll: semanticColorValueSchema.optional(),
  conversation: semanticColorValueSchema.optional(),
})

export const surfaceSemanticSlotsSchema = strictKeyed({
  generic: semanticColorValueSchema.optional(),
  genericHovered: semanticColorValueSchema.optional(),
  genericPressed: semanticColorValueSchema.optional(),
  genericMedium: semanticColorValueSchema.optional(),
  genericMediumHovered: semanticColorValueSchema.optional(),
  genericMediumPressed: semanticColorValueSchema.optional(),
  genericAlt: semanticColorValueSchema.optional(),
  disabled: semanticColorValueSchema.optional(),
  inverse: semanticColorValueSchema.optional(),
  inverseHovered: semanticColorValueSchema.optional(),
  inversePressed: semanticColorValueSchema.optional(),
  staticLight: semanticColorValueSchema.optional(),
  staticHeavy: semanticColorValueSchema.optional(),
})

export const elevationSemanticSlotsSchema = strictKeyed({
  base: semanticColorValueSchema.optional(),
  risen: semanticColorValueSchema.optional(),
  sunken: semanticColorValueSchema.optional(),
  overlay: semanticColorValueSchema.optional(),
  overlayModal: semanticColorValueSchema.optional(),
  sidebar: semanticColorValueSchema.optional(),
})

export const modalSemanticSlotsSchema = strictKeyed({
  popup: semanticColorValueSchema.optional(),
  card: semanticColorValueSchema.optional(),
  cardContrast: semanticColorValueSchema.optional(),
})

export const overlaySemanticSlotsSchema = strictKeyed({
  scrim: semanticColorValueSchema.optional(),
  backdrop: semanticColorValueSchema.optional(),
  background: semanticColorValueSchema.optional(),
  textPrimary: semanticColorValueSchema.optional(),
  textSecondary: semanticColorValueSchema.optional(),
})

export const lineSemanticSlotsSchema = strictKeyed({
  generic: semanticColorValueSchema.optional(),
  genericLight: semanticColorValueSchema.optional(),
  genericMedium: semanticColorValueSchema.optional(),
  genericHeavy: semanticColorValueSchema.optional(),
  divider: semanticColorValueSchema.optional(),
  darkmode: semanticColorValueSchema.optional(),
  compose: semanticColorValueSchema.optional(),
  mainBanner: semanticColorValueSchema.optional(),
  codeBlock: semanticColorValueSchema.optional(),
  joinCallBanner: semanticColorValueSchema.optional(),
  codeIncomingDivider: semanticColorValueSchema.optional(),
  codeOutgoingDivider: semanticColorValueSchema.optional(),
})

export const focusSemanticSlotsSchema = strictKeyed({
  color: semanticColorValueSchema.optional(),
  cardOutline: semanticColorValueSchema.optional(),
})

export const textSemanticSlotsSchema = strictKeyed({
  primary: semanticColorValueSchema.optional(),
  secondary: semanticColorValueSchema.optional(),
  tertiary: semanticColorValueSchema.optional(),
  disabled: semanticColorValueSchema.optional(),
  inverse: semanticColorValueSchema.optional(),
  link: semanticColorValueSchema.optional(),
  linkHovered: semanticColorValueSchema.optional(),
  staticLight: semanticColorValueSchema.optional(),
  staticHeavy: semanticColorValueSchema.optional(),
})

export const iconSemanticSlotsSchema = strictKeyed({
  primary: semanticColorValueSchema.optional(),
  secondary: semanticColorValueSchema.optional(),
})

export const controlSemanticSlotsSchema = strictKeyed({
  brandSurface: semanticColorValueSchema.optional(),
  brandSurfaceHovered: semanticColorValueSchema.optional(),
  brandSurfacePressed: semanticColorValueSchema.optional(),
  brandSurfaceLight: semanticColorValueSchema.optional(),
  brandSurfaceLightHovered: semanticColorValueSchema.optional(),
  brandSurfaceLightPressed: semanticColorValueSchema.optional(),
  buttonBrand: semanticColorValueSchema.optional(),
  buttonBrandHover: semanticColorValueSchema.optional(),
  buttonBrandActive: semanticColorValueSchema.optional(),
  buttonBrandText: semanticColorValueSchema.optional(),
  iconButtonPrimary: semanticColorValueSchema.optional(),
  iconButtonPrimaryHoverBg: semanticColorValueSchema.optional(),
  iconButtonAccent: semanticColorValueSchema.optional(),
  iconButtonAccentHover: semanticColorValueSchema.optional(),
  iconButtonAccentPressed: semanticColorValueSchema.optional(),
  iconButtonAccentText: semanticColorValueSchema.optional(),
  messageButtonBackground: semanticColorValueSchema.optional(),
  messageButtonBackgroundHovered: semanticColorValueSchema.optional(),
  messageButtonText: semanticColorValueSchema.optional(),
  sendButtonDestructive: semanticColorValueSchema.optional(),
})

export const stateSemanticSlotsSchema = strictKeyed({
  cardHover: semanticColorValueSchema.optional(),
  cardActive: semanticColorValueSchema.optional(),
  cardDisabled: semanticColorValueSchema.optional(),
  cardNeutralHover: semanticColorValueSchema.optional(),
  cardNeutralActive: semanticColorValueSchema.optional(),
  cardContrastHover: semanticColorValueSchema.optional(),
  cardContrastActive: semanticColorValueSchema.optional(),
  listItemActive: semanticColorValueSchema.optional(),
})

export const selectionSemanticSlotsSchema = strictKeyed({
  messageRow: semanticColorValueSchema.optional(),
  reaction: semanticColorValueSchema.optional(),
  calendarCell: semanticColorValueSchema.optional(),
  segmentedControlChecked: semanticColorValueSchema.optional(),
})

export const statusSemanticSlotsSchema = strictKeyed({
  dangerText: semanticColorValueSchema.optional(),
  dangerSurface: semanticColorValueSchema.optional(),
  dangerSurfaceHovered: semanticColorValueSchema.optional(),
  dangerSurfacePressed: semanticColorValueSchema.optional(),
  dangerSurfaceLight: semanticColorValueSchema.optional(),
  dangerSurfaceLightHovered: semanticColorValueSchema.optional(),
  dangerSurfaceLightPressed: semanticColorValueSchema.optional(),
  warningText: semanticColorValueSchema.optional(),
  warningSurface: semanticColorValueSchema.optional(),
  warningSurfaceLight: semanticColorValueSchema.optional(),
  successText: semanticColorValueSchema.optional(),
  successSurface: semanticColorValueSchema.optional(),
  successSurfaceLight: semanticColorValueSchema.optional(),
  infoText: semanticColorValueSchema.optional(),
  infoSurface: semanticColorValueSchema.optional(),
  infoSurfaceLight: semanticColorValueSchema.optional(),
  neutralText: semanticColorValueSchema.optional(),
})

export const shadowSemanticSlotsSchema = strictKeyed({
  color: semanticColorValueSchema.optional(),
  brand: semanticColorValueSchema.optional(),
  popup: shadowValueSchema.optional(),
  focusInset: shadowValueSchema.optional(),
  focusPrimary: shadowValueSchema.optional(),
  card: shadowValueSchema.optional(),
  cardHover: shadowValueSchema.optional(),
  cardNeutral: shadowValueSchema.optional(),
  cardNeutralHover: shadowValueSchema.optional(),
  cardContrast: shadowValueSchema.optional(),
  cardContrastHover: shadowValueSchema.optional(),
  modal: shadowValueSchema.optional(),
  reactionsPicker: shadowValueSchema.optional(),
  joinCallBanner: shadowValueSchema.optional(),
})

export const gradientSemanticSlotsSchema = strictKeyed({
  messageSkeleton: gradientValueSchema.optional(),
  diskLoading: gradientValueSchema.optional(),
})

/** The fifteen category keys of `theme.<mode>.semantic`, in §3 order. */
const semanticCategoryShape = {
  page: pageSemanticSlotsSchema.optional(),
  surface: surfaceSemanticSlotsSchema.optional(),
  elevation: elevationSemanticSlotsSchema.optional(),
  modal: modalSemanticSlotsSchema.optional(),
  overlay: overlaySemanticSlotsSchema.optional(),
  line: lineSemanticSlotsSchema.optional(),
  focus: focusSemanticSlotsSchema.optional(),
  text: textSemanticSlotsSchema.optional(),
  icon: iconSemanticSlotsSchema.optional(),
  control: controlSemanticSlotsSchema.optional(),
  state: stateSemanticSlotsSchema.optional(),
  selection: selectionSemanticSlotsSchema.optional(),
  status: statusSemanticSlotsSchema.optional(),
  shadow: shadowSemanticSlotsSchema.optional(),
  gradient: gradientSemanticSlotsSchema.optional(),
}

/**
 * The `theme.<mode>.semantic` value: the fifteen category keys.
 * Strict at every level: unknown category keys or unknown slot keys are
 * rejected as config errors.
 */
export const semanticSlotsSchema = strictKeyed(semanticCategoryShape)

export type SemanticSlots = z.infer<typeof semanticSlotsSchema>

/* ------------------------------------------------------------------ *
 * Background images configuration
 *
 * Configures background images, wallpapers, and textures across Telemost
 * UI surfaces (chat, page, sidebar, home, login, call, modals, settings).
 * ------------------------------------------------------------------ */

const DATA_URI_IMAGE_REGEX = /^data:image\/(?:png|jpeg|jpg|webp|gif|avif|svg\+xml);base64,[A-Za-z0-9+/=]+$/
const GRADIENT_START_REGEX = /^(?:repeating-)?(?:linear|radial|conic)-gradient\(/i
const ALLOWED_GRADIENT_FUNCTIONS = new Set([
  "linear-gradient",
  "radial-gradient",
  "conic-gradient",
  "repeating-linear-gradient",
  "repeating-radial-gradient",
  "repeating-conic-gradient",
  "rgb",
  "rgba",
  "hsl",
  "hsla",
  "oklch",
  "oklab",
  "color-mix",
  "calc",
  "var",
])

export function isValidGradientValue(value: string): boolean {
  const trimmed = value.trim()
  if (!GRADIENT_START_REGEX.test(trimmed) || !trimmed.endsWith(")")) {
    return false
  }
  if (/[;{}@"'\!\\@]/.test(trimmed) || /\/\*|\*\//.test(trimmed) || /[\r\n]/.test(trimmed)) {
    return false
  }
  let depth = 0
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]
    if (ch === "(") depth++
    else if (ch === ")") {
      depth--
      if (depth < 0) return false
      if (depth === 0 && i < trimmed.length - 1) {
        return false
      }
    }
  }
  if (depth !== 0) return false

  const funcMatches = trimmed.matchAll(/([a-zA-Z0-9_-]+)\s*\(/g)
  for (const match of funcMatches) {
    const funcName = match[1].toLowerCase()
    if (!ALLOWED_GRADIENT_FUNCTIONS.has(funcName)) {
      return false
    }
  }

  return true
}

const BANNED_CSS_IMAGE_FUNCTIONS_REGEX =
  /\b(?:url|image|image-set|-webkit-image-set|cross-fade|element|canvas)\s*\(/i

export function isValidLocalImagePath(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.length === 0) return false

  // If it starts like a gradient, it must be validated as a gradient, not a file path
  if (GRADIENT_START_REGEX.test(trimmed)) {
    return false
  }

  // Forbid CSS image functions
  if (BANNED_CSS_IMAGE_FUNCTIONS_REGEX.test(trimmed)) {
    return false
  }

  if (/[;{}@"'\!*]/.test(trimmed) || /\/\*|\*\//.test(trimmed) || /[\r\n]/.test(trimmed)) {
    return false
  }

  // UNC network paths (//host or \\host) are forbidden to prevent SMB/network leaks
  if (/^[/\\]{2}/.test(trimmed)) {
    return false
  }

  // Any URI scheme (http:, https:, file:, ftp:, etc.) is forbidden except Windows drive letters (C:\ or c:/)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(trimmed)) {
    if (!/^[a-zA-Z]:[/\\]/.test(trimmed)) {
      return false
    }
  }

  return true
}

export const backgroundImageValueSchema = z
  .string()
  .min(1)
  .max(50_000_000)
  .refine(
    (v) => {
      const trimmed = v.trim()
      if (DATA_URI_IMAGE_REGEX.test(trimmed)) return true
      if (isValidGradientValue(trimmed)) return true
      if (isValidLocalImagePath(trimmed)) return true
      return false
    },
    "image must be a valid base64 data URI (data:image/...), a single safe CSS gradient without url(), or a safe local file path",
  )

export const customBackgroundSelectorSchema = z
  .string()
  .min(1)
  .max(512)
  .regex(
    /^[a-zA-Z0-9#._: >+~,-]+$/,
    "selector may only contain alphanumeric characters, spaces, and CSS combinators (# . _ : > + ~ , -)",
  )
  .refine(
    (v) => !/[[\]"';{}@!\\/*]/.test(v),
    'selector must not contain [, ], ", \', ;, {, }, @, !, \\, or comments',
  )
  .refine(
    (v) => !/\b(?:input|textarea)\b/i.test(v),
    "custom selectors cannot target form input elements (keylogger prevention)",
  )

export const backgroundPropertiesSchema = strictKeyed({
  image: backgroundImageValueSchema.optional(),
  size: safeCssValueSchema.optional(),
  position: safeCssValueSchema.optional(),
  repeat: safeCssValueSchema.optional(),
  attachment: safeCssValueSchema.optional(),
  overlay: safeCssValueSchema.optional(),
  blendMode: safeCssValueSchema.optional(),
  opacity: z.number().min(0).max(1).optional(),
}).refine(
  (obj) => Object.keys(obj).length > 0,
  "background properties object must not be empty",
)

export const backgroundItemSchema = z.union([
  backgroundImageValueSchema,
  backgroundPropertiesSchema,
])

export const customBackgroundRuleSchema = strictKeyed({
  selector: customBackgroundSelectorSchema,
  image: backgroundImageValueSchema,
  size: safeCssValueSchema.optional(),
  position: safeCssValueSchema.optional(),
  repeat: safeCssValueSchema.optional(),
  attachment: safeCssValueSchema.optional(),
  overlay: safeCssValueSchema.optional(),
  blendMode: safeCssValueSchema.optional(),
  opacity: z.number().min(0).max(1).optional(),
})

export const backgroundsSchema = strictKeyed({
  page: backgroundItemSchema.optional(),
  app: backgroundItemSchema.optional(),
  chat: backgroundItemSchema.optional(),
  conversation: backgroundItemSchema.optional(),
  sidebar: backgroundItemSchema.optional(),
  threads: backgroundItemSchema.optional(),
  home: backgroundItemSchema.optional(),
  hub: backgroundItemSchema.optional(),
  login: backgroundItemSchema.optional(),
  call: backgroundItemSchema.optional(),
  meeting: backgroundItemSchema.optional(),
  modal: backgroundItemSchema.optional(),
  card: backgroundItemSchema.optional(),
  popup: backgroundItemSchema.optional(),
  settings: backgroundItemSchema.optional(),
  custom: z.array(customBackgroundRuleSchema).optional(),
})

export type BackgroundProperties = z.infer<typeof backgroundPropertiesSchema>
export type BackgroundItem = z.infer<typeof backgroundItemSchema>
export type CustomBackgroundRule = z.infer<typeof customBackgroundRuleSchema>
export type BackgroundsConfig = z.infer<typeof backgroundsSchema>

export const themeVariantSchema = z.object({
  seeds: themeSeedColorsSchema,
  /**
   * Optional explicit accent ramp. When present it drives the brand color;
   * otherwise the brand is derived from the seed named by the mapping.
   */
  accentScale: paletteScaleSchema.optional(),
  /**
   * Optional semantic slots (plan §2). Absent slots emit nothing; stock
   * Telemost rendering is preserved. Strict at every level.
   */
  semantic: semanticSlotsSchema.optional(),
  /**
   * Optional background images per variant (e.g. chat, page, sidebar wallpapers).
   */
  backgrounds: backgroundsSchema.optional(),
})

export type DesktopTheme = z.infer<typeof desktopThemeSchema>

/**
 * A theme is a light/dark pair of seed sets + optional semantic slots & backgrounds.
 */
export const desktopThemeSchema = z.object({
  name: z.string().min(1),
  id: z.string().min(1),
  light: themeVariantSchema,
  dark: themeVariantSchema,
  /**
   * Optional root-level background images shared across both modes.
   */
  backgrounds: backgroundsSchema.optional(),
})

export type ThemeSeedName = keyof z.infer<typeof themeSeedColorsSchema>

/**
 * Orb exposes a brand ramp as flat primitives. We regenerate that ramp from a
 * shuvcode seed instead of hand-patching the semantic tokens that consume it.
 */
export const rampStopSchema = z.union([
  z.literal(100),
  z.literal(150),
  z.literal(200),
  z.literal(250),
  z.literal(300),
  z.literal(400),
  z.literal(500),
  z.literal(600),
  z.literal(700),
  z.literal(800),
  z.literal(850),
  z.literal(900),
  z.literal(950),
  z.literal(1000),
])

export const seedNameSchema = z.enum(["primary", "interactive", "success", "info", "warning", "error", "neutral"])

export const brandRampConfigSchema = z.object({
  /** Orb primitive family to rewrite, e.g. "ya-telemost". */
  family: z.string().min(1),
  /**
   * Fallback seed, used only when the theme provides no `accentScale`.
   * Ramps generated this way are gamut-mapped, which costs some chroma.
   */
  seed: seedNameSchema,
  /** Stop that alpha variants are derived from. */
  alphaSource: rampStopSchema,
  /** Optional extra `<family>-light-{400,500,600}` trio, present for ya-telemost. */
  emitLightTrio: z.boolean().default(false),
})

export const semanticOverrideSchema = z.record(z.string(), z.string())

/* ------------------------------------------------------------------ *
 * Semantic bindings (plan §4, §10–§11)
 *
 * v1 bindings are rule-only: a slot bound to one verified (selector,
 * property) pair. A slot's token target is registry-owned and cannot be
 * redirected from config (ADR-2b).
 * ------------------------------------------------------------------ */

export const semanticBindingRuleSchema = z.object({
  kind: z.literal("rule"),
  slot: slotIdSchema,
  /** Byte-exact allowlist match against VERIFIED_RULE_TARGETS (plan §11). */
  selector: z.string().min(1),
  property: cssPropertyNameSchema,
  /** Defaults to the theme mode the selector carries (plan §10). */
  mode: z.enum(["light", "dark", "static"]).optional(),
})

export const semanticBindingSchema = z.discriminatedUnion("kind", [
  semanticBindingRuleSchema,
])

export type SemanticBinding = z.infer<typeof semanticBindingSchema>

export const mappingConfigSchema = z.object({
  /** Human-readable note carried into the generated CSS banner. */
  description: z.string().default(""),
  /**
   * Orb primitive families regenerated from seeds. This is what actually
   * removes the green: every brand token resolves through these primitives.
   */
  ramps: z.array(brandRampConfigSchema).min(1),
  /**
   * Direct token overrides applied after ramps, for anything a ramp cannot
   * express. Values are raw CSS (hex or var() refs).
   */
  darkOverrides: semanticOverrideSchema.default({}),
  lightOverrides: semanticOverrideSchema.default({}),
  /**
   * Tokens asserted against the running app after injection.
   *
   * Must be root-scoped: `getComputedStyle(documentElement)` can only see
   * custom properties declared on `:root`. Orb's four
   * `--orb-button-brand-*` tokens are declared on component scopes
   * (`.yamb-desktop-merge-notice-banner`) and are therefore NOT valid canaries,
   * even though they do consume the brand ramp.
   */
  canaryTokens: z.array(z.string()).default([]),
  /**
   * Rule-only semantic bindings (plan §4). Defaults to no bindings; every
   * entry is cross-validated against the theme by `loadMapping`.
   */
  semanticBindings: z.array(semanticBindingSchema).default([]),
  /**
   * Root-scoped semantic tokens asserted over CDP by tto-6ia.8. Every token
   * must carry registry evidence and be root-scoped (plan §4).
   */
  semanticCanaries: z.array(cssCustomPropertyNameSchema).default([]),
})

export type MappingConfig = z.infer<typeof mappingConfigSchema>
export type BrandRampConfig = z.infer<typeof brandRampConfigSchema>
export type RampStop = z.infer<typeof rampStopSchema>

export const appConfigSchema = z.object({
  telemostExe: z.string().min(1),
  /** Loopback only. Binding elsewhere would expose remote control of a live session. */
  debugHost: z.literal("127.0.0.1").default("127.0.0.1"),
  debugPort: z.number().int().min(1024).max(65535).default(9333),
  themeFile: z.string().min(1),
  mappingFile: z.string().min(1),
  /** Keep the injector attached and re-apply on navigation. */
  watch: z.boolean().default(true),
  launchTimeoutMs: z.number().int().positive().default(45_000),
})

export type AppConfig = z.infer<typeof appConfigSchema>

/* ---------------------------------- CDP ---------------------------------- */

export const cdpTargetSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  url: z.string(),
  webSocketDebuggerUrl: z.string().optional(),
})

export const cdpTargetListSchema = z.array(cdpTargetSchema)

export const cdpVersionSchema = z.object({
  Browser: z.string(),
  "Protocol-Version": z.string(),
  webSocketDebuggerUrl: z.string(),
})

export const cdpMessageSchema = z.object({
  id: z.number().int().optional(),
  method: z.string().optional(),
  params: z.unknown().optional(),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
    })
    .optional(),
})

export const runtimeEvaluateResultSchema = z.object({
  result: z.object({
    type: z.string(),
    value: z.unknown().optional(),
  }),
  exceptionDetails: z
    .object({
      text: z.string(),
      exception: z.object({ description: z.string().optional() }).optional(),
    })
    .optional(),
})

export const addScriptResultSchema = z.object({
  identifier: z.string(),
})

/** Shape returned by the in-page verification probe. */
export const verificationReportSchema = z.object({
  rootClasses: z.string(),
  styleTagPresent: z.boolean(),
  resolved: z.record(z.string(), z.string()),
  missing: z.array(z.string()),
})

export type VerificationReport = z.infer<typeof verificationReportSchema>
