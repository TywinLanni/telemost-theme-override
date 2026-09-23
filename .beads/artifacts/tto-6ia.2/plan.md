# tto-6ia.2 — Semantic Color Configuration Schema: Plan (rev 2)

- Issue: `tto-6ia.2` (feature, P0) under EPIC `tto-6ia`
- Scope of this issue: **contract only** — Zod shapes, slot registry, allowlists,
  validation, and the emission contract that later issues implement.
  Implementation ownership: emitter `tto-6ia.4`, container/state token wiring
  `tto-6ia.5`, targeted-rule emission `tto-6ia.6`, runtime/dynamic `tto-6ia.7`,
  CDP verification and WCAG QA `tto-6ia.8`, docs `tto-6ia.9`.
- This document defines the backward-compatible extension of `config/theme.json`
  (optional per-light/dark semantic colors) and `config/mapping.json` (optional
  targeted-rule bindings). No code is changed by this artifact.

## 0. Verified evidence base

All names and values in this plan were read out of the pinned stylesheet or the
static inventory, never guessed:

- Pinned asset: `research_notes/Полная перекраска интерфейса Телемоста/evidence/telemost_ui.css`
  (sha256 `7ee580fd469fda95d42845de4a966ae7680bd0680ccf4af8e56c6507e485ebf2`,
  1,889,891 bytes, 285 lines)
- Static audit: `reports/telemost_ui_color_inventory.json`
  (`telemost-ui-color-inventory/1`; 19,610 occurrences, 1,286 unique colors)
- Session checks: every registry token joined against inventory definition
  occurrences (count, declaring scopes, override method); tokens the inventory
  skips by design re-checked against the raw CSS (section 5 legend, `raw`);
  reference-only tokens counted at var() consumption sites.

Verified architecture (three layers, outermost wins by inheritance):

1. Orb primitives: `--orb-color-<family>-<step>` on `:root`
2. Orb semantics: `--orb-surface-*`, `--orb-text-*`, `--orb-line-*`,
   `--orb-elevation-*`, `--orb-shadow-*`, `--orb-misc-*`
3. Telemost semantics: `--common-*`, `--ui-*`, `--overlay-*`,
   `--conversation-*`, `--incoming-*`, `--outgoing-*`, `--component-*`,
   `--local-*`

Theme scoping (verified):

- Light values are declared on plain `:root`; `.theme_light:root` does not
  exist (0 occurrences). Plain `:root` matches `<html>` regardless of a
  `theme_auto` class, so light values already cover `theme_auto` under a light
  OS scheme.
- Dark values on `.theme_dark:root`.
- `.theme_auto:root` appears only inside `@media(prefers-color-scheme:dark)`
  and `@media(prefers-color-scheme:light)`.
- Brand root compounds: `:root.brand_telemost`, `:root.Orb-Brand_brand_telemost`,
  and the `.theme_dark:root.brand_telemost` / `.theme_auto:root.brand_telemost`
  variants.
- Theme component compounds re-declare the token layers:
  `.yamb-modal.Orb-Theme_theme_light|dark`, `.ui-popup.Orb-Theme_theme_light|dark`,
  `.Orb-Popover2.Orb-Theme_theme_light|dark`. For every registry token with
  component evidence, the pinned file declares these compounds in five verified
  forms: plain, `.brand_telemost`-suffixed, `.Orb-Brand_brand_telemost`-suffixed,
  `.brand_telemost `-prefixed, `.Orb-Brand_brand_telemost `-prefixed. The
  suffixed and descendant forms outrank the plain form, so partial emission
  would lose inside brand-tinted modals; the registry therefore requires all
  five forms per compound and mode (section 9).
- Two fixed scopes also re-declare the layers: `.yamb-aside_dark-in-light` and
  `.yamb-telemost-feedback__modal`. They encode an intentional dark-in-light
  look. No emission there in v1 (ADR-5).
- `--orb-button-brand-background/-hover/-active/-text` are declared only on
  `.yamb-desktop-merge-notice-banner.Orb-Theme_theme_light|dark` and
  `.yamb-merge-notice__content.Orb-Theme_theme_light|dark` (4 definition groups,
  plain forms only, no brand variants observed).
- The primitive `--orb-color-ya-telemost-600` is re-declared inside
  `.yamb-modal.Orb-Theme_theme_light`, `.ui-popup.Orb-Theme_theme_light`,
  `.Orb-Popover2.Orb-Theme_theme_light` (light only). Known gap of the ramp
  mechanism; owned by `tto-6ia.5`. Semantic slots bypass it because they bind
  the semantic tokens themselves.

## 1. Goals and non-goals

Goals:

- Optional semantic color slots, split light/dark, in `theme.json`.
- Optional **targeted-rule** slot bindings in `mapping.json` (token redirect
  bindings are rejected for v1, ADR-2b).
- Every slot has exactly one registry-owned, evidence-annotated target.
- Absent slots emit nothing; stock Telemost rendering is preserved.
- Old configs parse unchanged and keep their rendering, with one qualified
  exception (section 6.4: the `darkOverrides` + `theme_auto` fix).

Non-goals (owned elsewhere):

- Emitter implementation inside `buildCss`: `tto-6ia.4` implements sections 9
  and 12; this plan specifies them.
- Extending ramp families and remaining container/state token coverage:
  `tto-6ia.5`.
- Emitting targeted rules and their selector allowlist maintenance: `tto-6ia.6`.
- Live-call DOM, inline styles, MutationObserver runtime: `tto-6ia.7`.
- CDP verification wiring for `semanticCanaries`, WCAG visual QA: `tto-6ia.8`.

## 2. Contract overview

- `theme.json`: each variant (`light`, `dark`) gains an optional `semantic`
  object, strict at every level. Keys nest by category; values are colors, or
  full shadow/gradient strings for the two value-slot kinds.
- `mapping.json`: gains an optional `semanticBindings` array of **rule-only**
  bindings (slot → verified `(selector, property)` pair) and an optional
  `semanticCanaries` array (root-scoped tokens for later CDP assertion by
  `tto-6ia.8`). Token redirect bindings do not exist in v1.
- A built-in registry in code holds each slot's default token target, value
  kind, scope class, evidence, and override method. Both config files stay
  optional end to end.
- Value precedence per slot and mode: slot value in the active variant, else
  stock (emit nothing). Emission order guarantees raw `lightOverrides` /
  `darkOverrides` win cascade ties against semantic slots (sections 6 and 12).

## 3. Zod shapes — theme.json

Add to `src/schema.ts`. All category objects and the `semantic` wrapper are
`.strict()`: unknown slot keys are config errors, not silent no-ops.

```ts
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
 */
export const safeCssValueSchema = z
  .string()
  .min(1)
  .max(512)
  .regex(/^[^;{}@"'!]+$/, "value must not contain ; { } @ \" ' or !")
  .refine(v => balancedParens(v), "parentheses must be balanced")

export const semanticColorValueSchema = hexColorSchema   // reuse existing

export const shadowValueSchema = safeCssValueSchema
  .refine(v => !/url\(/i.test(v), "shadow values must not contain url()")

export const gradientValueSchema = safeCssValueSchema
  .refine(v => /gradient\(/i.test(v), "gradient values must contain gradient(")
  .refine(v => !/url\(/i.test(v), "gradient values must not contain url()")
```

`balancedParens` counts `(` and `)`; unequal counts reject. The `!` ban makes
`!important` unreachable from user values.

One strict schema per category; field names and value schemas come from
section 5. Two illustrated; the other thirteen follow identically:

```ts
export const pageSemanticSlotsSchema = z.strictObject({
  background:          semanticColorValueSchema.optional(),
  backgroundSecondary: semanticColorValueSchema.optional(),
  settingsBackground:  semanticColorValueSchema.optional(),
  actionbar:           semanticColorValueSchema.optional(),
  surface:             semanticColorValueSchema.optional(),
  poll:                semanticColorValueSchema.optional(),
  conversation:        semanticColorValueSchema.optional(),
})

export const gradientSemanticSlotsSchema = z.strictObject({
  messageSkeleton: gradientValueSchema.optional(),
  diskLoading:     gradientValueSchema.optional(),
})

export const semanticSlotsSchema = z.strictObject({
  page:      pageSemanticSlotsSchema.optional(),
  surface:   surfaceSemanticSlotsSchema.optional(),
  elevation: elevationSemanticSlotsSchema.optional(),
  modal:     modalSemanticSlotsSchema.optional(),
  overlay:   overlaySemanticSlotsSchema.optional(),
  line:      lineSemanticSlotsSchema.optional(),
  focus:     focusSemanticSlotsSchema.optional(),
  text:      textSemanticSlotsSchema.optional(),
  icon:      iconSemanticSlotsSchema.optional(),
  control:   controlSemanticSlotsSchema.optional(),
  state:     stateSemanticSlotsSchema.optional(),
  selection: selectionSemanticSlotsSchema.optional(),
  status:    statusSemanticSlotsSchema.optional(),
  shadow:    shadowSemanticSlotsSchema.optional(),
  gradient:  gradientSemanticSlotsSchema.optional(),
})

export const themeVariantSchema = z.object({
  seeds: themeSeedColorsSchema,
  accentScale: paletteScaleSchema.optional(),
  semantic: semanticSlotsSchema.optional(),        // NEW, additive
})

export type SemanticSlots = z.infer<typeof semanticSlotsSchema>
export const SEMANTIC_CATEGORIES = ["page","surface","elevation","modal","overlay",
  "line","focus","text","icon","control","state","selection","status","shadow","gradient"] as const
```

All fifteen category schemas use `z.strictObject` (equivalent to
`z.object({...}).strict()` on zod v4). Example `theme.json` fragment:

```json
{
  "light": {
    "seeds": { "..." : "..." },
    "semantic": {
      "page":   { "background": "#101418" },
      "text":   { "primary": "#e8eaed", "link": "#8ab4f8" },
      "status": { "dangerSurface": "#f28b82" }
    }
  },
  "dark": {
    "seeds": { "..." : "..." },
    "semantic": {
      "page": { "background": "#0d1117" },
      "shadow": { "color": "#00000066" }
    }
  }
}
```

## 4. Zod shapes — mapping.json

v1 bindings are rule-only. A slot's token target is registry-owned and cannot
be redirected from config (ADR-2b).

```ts
export const slotIdSchema = z.string().regex(
  /^[a-z]+\.[a-zA-Z0-9]+$/,
  "expected a slot id like page.background"
)

export const semanticBindingRuleSchema = z.object({
  kind: z.literal("rule"),
  slot: slotIdSchema,
  selector: z.string().min(1),      // byte-exact allowlist match, section 11
  property: cssPropertyNameSchema,
  mode: z.enum(["light", "dark", "static"]).optional(), // default: derived, section 10
})

export const semanticBindingSchema = z.discriminatedUnion("kind", [
  semanticBindingRuleSchema,
])

export const mappingConfigSchema = z.object({
  // ...existing fields untouched...
  semanticBindings: z.array(semanticBindingSchema).default([]),      // NEW
  semanticCanaries: z.array(cssCustomPropertyNameSchema).default([]), // NEW
})
```

Loader validation in `loadMapping` (`src/config.ts`), each failure a
`ConfigError` carrying the slot id:

- unknown slot id (not in `SEMANTIC_SLOT_REGISTRY`)
- duplicate slot across `semanticBindings`
- `(selector, property)` pair not in `VERIFIED_RULE_TARGETS`
- mode mismatch with the selector's theme class (section 10)
- property incompatible with the slot kind (section 11 matrix)
- `semanticCanaries` token not root-scoped per registry evidence

Generator-side validation (implemented by `tto-6ia.4` in
`buildSemanticSections`): two slots resolving to the same token in the same
mode throw, naming both slots.

`canaryTokens` and the existing `verify()` mechanism stay untouched in this
issue; `semanticCanaries` reaches CDP verification in `tto-6ia.8`.

## 5. Slot registry — exact slot IDs, targets, evidence

Registry source: `src/theme/semantic-slots.ts` (new, data + lookup). Every
entry carries:

- `scopeClass` — emission scope set (section 9 legend)
- `evidence` — how the target is verified (legend below)
- `overrideMethod` — the inventory classification for the fix

Legend used in the tables:

- scopeClass: `R` root scopes; `RB` root+brand; `RC` root+component;
  `RBC` root+brand+component; `MN` merge-notice compounds; `REF` reference-only
- evidence: `def(N;cM)` — N inventory definition occurrences across M component
  scope groups; `raw(N)` — N definitions verified in raw CSS, absent from the
  inventory because the stock value is not color-bearing (documented heuristic
  skip); `ref(C)` — reference-only, C var() consumers, 0 definitions
- overrideMethod: `TR` token-redefinition; `FVR` full-value-replacement;
  `TAR` targeted-rule (rule bindings only, section 10)

Registry totals: **124 slots, 124 distinct token targets**: 118 `def`, 4 `raw`,
2 `ref`. Slot counts per category: page 7, surface 13, elevation 6, modal 3,
overlay 5, line 12, focus 2, text 9, icon 2, control 20, state 8, selection 4,
status 17, shadow 14, gradient 2.

Stock values are from the pinned file; light/dark pairs are written
`light / dark`.

### 5.1 page (7)

| Slot ID | Kind | Default target | Stock | scopeClass | evidence | om |
| --- | --- | --- | --- | --- | --- | --- |
| `page.background` | color | `--common-bg` | `var(--orb-elevation-base)` | RC | def(20;c5) | TR |
| `page.backgroundSecondary` | color | `--common-bg-secondary` | `var(--orb-surface-generic)` | RC | def(20;c5) | TR |
| `page.settingsBackground` | color | `--common-settings-bg` | `var(--orb-elevation-base)` | RC | def(20;c5) | TR |
| `page.actionbar` | color | `--common-actionbar` | `var(--orb-elevation-base)` | RC | raw(20) | TR |
| `page.surface` | color | `--common-surface-bg` | `var(--orb-elevation-sunken)` = cool-gray-100 / cool-gray-1100 | RC | def(20;c5) | TR |
| `page.poll` | color | `--common-poll-bg` | `var(--orb-elevation-overlay)` | RC | def(21;c6) | TR |
| `page.conversation` | color | `--conversation-bg` | `var(--common-bg)` | RC | def(21;c6) | TR |

`page.actionbar` evidence note: the inventory's colorish heuristic skips it
(`--orb-elevation-base` contains no colorish word), so it is absent from
`occurrences`; raw-CSS verification found 20 definitions. The registry test
(T-INV-01) must accept `raw` evidence via direct pinned-file assertion.

### 5.2 surface (13)

| Slot ID | Kind | Default target | Stock | scopeClass | evidence | om |
| --- | --- | --- | --- | --- | --- | --- |
| `surface.generic` | color | `--orb-surface-generic` | cool-gray-alpha-150 | R | def(20;c5) | TR |
| `surface.genericHovered` | color | `--orb-surface-generic-hovered` | cool-gray-alpha-200 | R | def(20;c5) | TR |
| `surface.genericPressed` | color | `--orb-surface-generic-pressed` | cool-gray-alpha-300 | R | def(20;c5) | TR |
| `surface.genericMedium` | color | `--orb-surface-generic-medium` | cool-gray-alpha-250 | R | def(20;c5) | TR |
| `surface.genericMediumHovered` | color | `--orb-surface-generic-medium-hovered` | — | R | def(20;c5) | TR |
| `surface.genericMediumPressed` | color | `--orb-surface-generic-medium-pressed` | — | R | def(20;c5) | TR |
| `surface.genericAlt` | color | `--orb-surface-generic-alt` | cool-gray-alpha-250 | R | def(20;c5) | TR |
| `surface.disabled` | color | `--orb-surface-disabled` | cool-gray-alpha-150 | R | def(20;c5) | TR |
| `surface.inverse` | color | `--orb-surface-inverse` | cool-gray-100 | R | def(20;c5) | TR |
| `surface.inverseHovered` | color | `--orb-surface-inverse-hovered` | — | R | def(20;c5) | TR |
| `surface.inversePressed` | color | `--orb-surface-inverse-pressed` | — | R | def(20;c5) | TR |
| `surface.staticLight` | color | `--orb-surface-static-light` | white | R | def(20;c5) | TR |
| `surface.staticHeavy` | color | `--orb-surface-static-heavy` | cool-gray-950 | R | def(20;c5) | TR |

### 5.3 elevation and modal surfaces (6 + 3)

| Slot ID | Kind | Default target | Stock | scopeClass | evidence | om |
| --- | --- | --- | --- | --- | --- | --- |
| `elevation.base` | color | `--orb-elevation-base` | cool-gray-1000 (`#242429` observed) | R | def(20;c5) | TR |
| `elevation.risen` | color | `--orb-elevation-risen` | cool-gray-50 / cool-gray-950 | R | def(20;c5) | TR |
| `elevation.sunken` | color | `--orb-elevation-sunken` | cool-gray-100 / cool-gray-1100 | R | def(20;c5) | TR |
| `elevation.overlay` | color | `--orb-elevation-overlay` | cool-gray-900 | R | def(20;c5) | TR |
| `elevation.overlayModal` | color | `--orb-elevation-overlay-modal` | black-alpha-600 / black-alpha-700 | R | def(20;c5) | TR |
| `elevation.sidebar` | color | `--orb-elevation-base-sidebar` | cool-gray-dark-alpha-600 | R | def(20;c5) | TR |
| `modal.popup` | color | `--ui-popup-bg` | `var(--orb-elevation-overlay)` | RC | def(20;c5) | TR |
| `modal.card` | color | `--ui-card-neutral-bg` | `var(--common-bg-secondary)` | RC | def(20;c5) | TR |
| `modal.cardContrast` | color | `--ui-card-contrast-bg` | `var(--orb-surface-generic-alt)`; one dark bundle copy declares `var(--common-bg-secondary)` | RC | def(33;c5) | TR |

### 5.4 overlays (5)

| Slot ID | Kind | Default target | Stock | scopeClass | evidence | om |
| --- | --- | --- | --- | --- | --- | --- |
| `overlay.scrim` | color | `--common-overlay-bg` | `var(--orb-elevation-overlay)`; `--conversation-fg` reads the same token (verified coupling) | RC | def(20;c5) | TR |
| `overlay.backdrop` | color | `--overlay-shadow-color` | `var(--orb-elevation-overlay-modal)`; consumer `.yamb-overlay__shadow` | RC | def(20;c5) | TR |
| `overlay.background` | color | `--overlay-background-color` | literal `#000` | RC | def(20;c5) | TR |
| `overlay.textPrimary` | color | `--overlay-primary-color` | literal `#fafafa` | RC | def(20;c5) | TR |
| `overlay.textSecondary` | color | `--overlay-secondary-color` | `var(--common-text-secondary)` | RC | def(20;c5) | TR |

### 5.5 lines, borders, dividers (12)

| Slot ID | Kind | Default target | Stock | scopeClass | evidence | om |
| --- | --- | --- | --- | --- | --- | --- |
| `line.generic` | color | `--orb-line-generic` | cool-gray-alpha-300 | R | def(20;c5) | TR |
| `line.genericLight` | color | `--orb-line-generic-light` | cool-gray-alpha-150 | R | def(20;c5) | TR |
| `line.genericMedium` | color | `--orb-line-generic-medium` | cool-gray-500 | R | def(20;c5) | TR |
| `line.genericHeavy` | color | `--orb-line-generic-heavy` | cool-gray-50 | R | def(20;c5) | TR |
| `line.divider` | color | `--common-divider` | `var(--orb-line-generic-light)` | RC | def(20;c5) | TR |
| `line.darkmode` | color | `--orb-misc-line-darkmode` | white-alpha-00 / white-alpha-100 | R | def(20;c5) | TR |
| `border.compose` | color | `--ui-compose-border-color` | literal `transparent` | RC | def(20;c5) | TR |
| `border.mainBanner` | color | `--main-banner-border-color` | — | RC | def(20;c5) | TR |
| `border.codeBlock` | color | `--component-code-block-border-color` | — | RC | def(20;c5) | TR |
| `border.joinCallBanner` | color | `--component-telemost-action-banner-join-call-border-color` | — | RC | def(20;c5) | TR |
| `line.codeIncomingDivider` | color | `--component-code-incoming-divider-color` | — | RC | def(20;c5) | TR |
| `line.codeOutgoingDivider` | color | `--component-code-outgoing-divider-color` | — | RC | def(20;c5) | TR |

Removed since rev 1: `border.card` and `border.cardContrast`. Verified blocker:
`--ui-card-neutral-border` holds the full `border` shorthand `0` and
`--ui-card-contrast-border` holds `var(--line-05m) solid var(--orb-misc-line-darkmode)`;
both feed `border: var(--ui-card-border)` (verified chain). A hex color cannot
satisfy a border shorthand, so no color slot may target them. Card border
colors follow `line.darkmode` and the line slots through that chain. Border
widths `--line-m`, `--line-05m` are geometry and stay out of scope.

### 5.6 focus (2)

| Slot ID | Kind | Default target | Stock | scopeClass | evidence | om |
| --- | --- | --- | --- | --- | --- | --- |
| `focus.color` | color | `--ui-focus-color` | `var(--orb-line-brand)` | RC | def(20;c5) | TR |
| `focus.cardOutline` | color | `--ui-card-focus-outline-color` | `var(--ui-focus-color)` | RC | def(20;c5) | TR |

### 5.7 text (9)

| Slot ID | Kind | Default target | Stock | scopeClass | evidence | om |
| --- | --- | --- | --- | --- | --- | --- |
| `text.primary` | color | `--orb-text-primary` | cool-gray-50 | R | def(20;c5) | TR |
| `text.secondary` | color | `--orb-text-secondary` | cool-gray-450 | R | def(20;c5) | TR |
| `text.tertiary` | color | `--orb-text-tertiary` | cool-gray-600 | R | def(20;c5) | TR |
| `text.disabled` | color | `--orb-text-disabled` | cool-gray-alpha-500 | R | def(20;c5) | TR |
| `text.inverse` | color | `--orb-text-inverse` | cool-gray-50 / cool-gray-950 | R | def(20;c5) | TR |
| `text.link` | color | `--orb-text-link` | blue-400 | RBC | def(40;c11) | TR |
| `text.linkHovered` | color | `--orb-text-link-hovered` | blue-500 | RBC | def(40;c11) | TR |
| `text.staticLight` | color | `--orb-text-static-light` | white | R | def(20;c5) | TR |
| `text.staticHeavy` | color | `--orb-text-static-heavy` | cool-gray-950 | R | def(20;c5) | TR |

Verified alias chains (documented, never bound separately):
`--common-text-primary` = `var(--orb-text-primary)`;
`--common-text-secondary` = `var(--orb-text-tertiary)`;
`--ui-link-color` = `var(--orb-text-link)`;
`--ui-link-color-hovered` = `var(--orb-text-link-hovered)`;
`--ui-scrollbar-color` = `var(--common-text-primary)`;
`--incoming-primary` = `var(--orb-text-primary)`;
`--outgoing-primary` = `var(--common-text-primary)`;
`--conversation-fg` = `var(--common-overlay-bg)`.

### 5.8 icons (2)

| Slot ID | Kind | Default target | Stock | scopeClass | evidence | om |
| --- | --- | --- | --- | --- | --- | --- |
| `icon.primary` | color | `--common-icons-primary` | `var(--orb-text-primary)` | RC | def(20;c5) | TR |
| `icon.secondary` | color | `--common-icons-secondary` | `var(--orb-text-tertiary)` | RC | def(20;c5) | TR |

Verified currentColor mechanism, no slot needed: 28 `currentColor` occurrences
in the pinned file — 20 define `--component-chat-list-item-border-top-color:
currentColor`, 6 paint `background-color: currentColor`, 1 `background:`,
1 `color:`. Monochrome icons follow the text slots automatically. SVG paints
are unverified (section 19).

### 5.9 controls and their states (20)

| Slot ID | Kind | Default target | Stock | scopeClass | evidence | om |
| --- | --- | --- | --- | --- | --- | --- |
| `control.brandSurface` | color | `--orb-surface-brand` | ya-telemost-600 | RBC | def(42;c13) | TR |
| `control.brandSurfaceHovered` | color | `--orb-surface-brand-hovered` | ya-telemost-700 | RBC | def(42;c13) | TR |
| `control.brandSurfacePressed` | color | `--orb-surface-brand-pressed` | ya-telemost-800 | RBC | def(42;c13) | TR |
| `control.brandSurfaceLight` | color | `--orb-surface-brand-light` | ya-telemost-alpha-200 | RBC | def(40;c11) | TR |
| `control.brandSurfaceLightHovered` | color | `--orb-surface-brand-light-hovered` | ya-telemost-alpha-250 | RBC | def(40;c11) | TR |
| `control.brandSurfaceLightPressed` | color | `--orb-surface-brand-light-pressed` | ya-telemost-alpha-300 | RBC | def(40;c11) | TR |
| `control.buttonBrand` | color | `--orb-button-brand-background` | ya-telemost-600 | MN | def(4;c2) | TR |
| `control.buttonBrandHover` | color | `--orb-button-brand-background-hover` | ya-telemost-700 | MN | def(4;c2) | TR |
| `control.buttonBrandActive` | color | `--orb-button-brand-background-active` | ya-telemost-800 | MN | def(4;c2) | TR |
| `control.buttonBrandText` | color | `--orb-button-brand-text` | ya-telemost-950 | MN | def(4;c2) | TR |
| `control.iconButtonPrimary` | color | `--ui-icon-button-primary` | `var(--orb-text-primary)` | RC | def(20;c5) | TR |
| `control.iconButtonPrimaryHoverBg` | color | `--ui-icon-button-primary-hover-bg` | — | RC | def(20;c5) | TR |
| `control.iconButtonAccent` | color | `--ui-icon-button-accent` | `var(--orb-surface-brand)` | RC | def(20;c5) | TR |
| `control.iconButtonAccentHover` | color | `--ui-icon-button-accent-hover` | `var(--orb-surface-brand-hovered)` | RC | def(20;c5) | TR |
| `control.iconButtonAccentPressed` | color | `--ui-icon-button-accent-pressed` | `var(--orb-surface-brand-pressed)` | RC | def(20;c5) | TR |
| `control.iconButtonAccentText` | color | `--ui-icon-button-accent-text` | — | RC | def(20;c5) | TR |
| `control.messageButtonBackground` | color | `--component-message-button-background-color` | — | RC | def(20;c5) | TR |
| `control.messageButtonBackgroundHovered` | color | `--component-message-button-background-color-hovered` | — | RC | def(20;c5) | TR |
| `control.messageButtonText` | color | `--component-message-button-text-color` | — | RC | def(20;c5) | TR |
| `control.sendButtonDestructive` | color | `--ui-send-message-button-destructive-bg` | `var(--orb-text-feedback-danger)` | RC | def(20;c5) | TR |

MN emission uses the two verified compounds per mode, plain forms only:
`.yamb-desktop-merge-notice-banner.Orb-Theme_theme_light|dark`,
`.yamb-merge-notice__content.Orb-Theme_theme_light|dark`. No brand variants of
these declarations exist in the pinned file.

### 5.10 card and list states (8)

| Slot ID | Kind | Default target | Stock | scopeClass | evidence | om |
| --- | --- | --- | --- | --- | --- | --- |
| `state.cardHover` | color | `--ui-card-bg-hover` | — | RC | def(22;c7) | TR |
| `state.cardActive` | color | `--ui-card-bg-active` | — | RC | def(22;c7) | TR |
| `state.cardDisabled` | color | `--ui-card-bg-disabled` | — | RC | def(20;c5) | TR |
| `state.cardNeutralHover` | color | `--ui-card-neutral-bg-hover` | — | RC | def(20;c5) | TR |
| `state.cardNeutralActive` | color | `--ui-card-neutral-bg-active` | — | RC | def(20;c5) | TR |
| `state.cardContrastHover` | color | `--ui-card-contrast-bg-hover` | — | RC | def(33;c5) | TR |
| `state.cardContrastActive` | color | `--ui-card-contrast-bg-active` | — | RC | def(33;c5) | TR |
| `state.listItemActive` | color | `--ui-list-item-active-background-color` | `var(--orb-surface-generic)` | RC | def(20;c5) | TR |

### 5.11 selection (4)

Verified: the pinned stylesheet contains zero `::selection` rules. Text
selection is not recolorable through CSS here. No slot exists for it and none
may be added silently (T-INV-03).

| Slot ID | Kind | Default target | Stock | scopeClass | evidence | om |
| --- | --- | --- | --- | --- | --- | --- |
| `selection.messageRow` | color | `--component-message-row-selected-background` | `var(--orb-surface-brand-light)` | RC | def(20;c5) | TR |
| `selection.reaction` | color | `--components-reaction-bg` | `var(--common-overlay-bg)`; note the plural `--components-` prefix is the real name | RC | def(20;c5) | TR |
| `selection.calendarCell` | color | `--orb-calendar-cell-background-selected` | consumer fallback `var(--orb-surface-inverse)` | REF | ref(2) | TR |
| `selection.segmentedControlChecked` | color | `--local-orb-segmented-control-fill-color-checked-base` | consumer fallback `var(--orb-surface-generic-alt)` | REF | ref(2) | TR |

`REF` targets are consumed by `.Orb-CalendarCell[data-selected=true]`,
`.Orb-CalendarCell_selected`, `.Orb-SegmentedControl2-Plate:before`,
`.Orb-SegmentedControl2-Radio_isSelected:before` with inline fallbacks. The
pinned file defines neither token (0 definitions, 2 whitespace-tolerant var()
consumers each); overriding the names on the root scopes feeds those consumers
through normal var() resolution.

### 5.12 statuses (17)

| Slot ID | Kind | Default target | Stock | scopeClass | evidence | om |
| --- | --- | --- | --- | --- | --- | --- |
| `status.dangerText` | color | `--orb-text-feedback-danger` | red-400 | R | def(20;c5) | TR |
| `status.dangerSurface` | color | `--orb-surface-feedback-danger` | red-500 | R | def(20;c5) | TR |
| `status.dangerSurfaceHovered` | color | `--orb-surface-feedback-danger-hovered` | red-600 | R | def(20;c5) | TR |
| `status.dangerSurfacePressed` | color | `--orb-surface-feedback-danger-pressed` | red-700 | R | def(20;c5) | TR |
| `status.dangerSurfaceLight` | color | `--orb-surface-feedback-danger-light` | red-alpha-150 / red-alpha-200 | R | def(20;c5) | TR |
| `status.dangerSurfaceLightHovered` | color | `--orb-surface-feedback-danger-light-hovered` | — | R | def(20;c5) | TR |
| `status.dangerSurfaceLightPressed` | color | `--orb-surface-feedback-danger-light-pressed` | — | R | def(20;c5) | TR |
| `status.warningText` | color | `--orb-text-feedback-warning` | orange-400 | R | def(20;c5) | TR |
| `status.warningSurface` | color | `--orb-surface-feedback-warning` | orange-600 / orange-500 (bundle-copy variants) | R | def(20;c5) | TR |
| `status.warningSurfaceLight` | color | `--orb-surface-feedback-warning-light` | orange-alpha-150 / orange-alpha-200 | R | def(20;c5) | TR |
| `status.successText` | color | `--orb-text-feedback-success` | green-400 | R | def(20;c5) | TR |
| `status.successSurface` | color | `--orb-surface-feedback-success` | green-500 | R | def(20;c5) | TR |
| `status.successSurfaceLight` | color | `--orb-surface-feedback-success-light` | green-alpha-150 / green-alpha-200 | R | def(20;c5) | TR |
| `status.infoText` | color | `--orb-text-feedback-info` | blue-400 | R | def(20;c5) | TR |
| `status.infoSurface` | color | `--orb-surface-feedback-info` | blue-500 | R | def(20;c5) | TR |
| `status.infoSurfaceLight` | color | `--orb-surface-feedback-info-light` | blue-alpha-150 / blue-alpha-200 | R | def(20;c5) | TR |
| `status.neutralText` | color | `--orb-text-feedback-neutral` | cool-gray-400 | R | def(20;c5) | TR |

Correction since rev 1: `--orb-surface-feedback-warning` **does exist** — 20
definition occurrences, stock `var(--orb-color-orange-600)` /
`var(--orb-color-orange-500)` depending on bundle copy, 41 consumers. It was
wrongly reported absent; it is now slot `status.warningSurface`.

Verified alias, not a slot: `--common-destructive` =
`var(--orb-surface-feedback-danger)`. Brand-fed status-ish aliases
(`--common-accent`, `--common-accent-text`, `--common-counter`,
`--ui-dot-background-color`) stay ramp-owned, not slots.

### 5.13 shadows (14)

| Slot ID | Kind | Default target | Stock | scopeClass | evidence | om |
| --- | --- | --- | --- | --- | --- | --- |
| `shadow.color` | color | `--orb-misc-shadow` | black-alpha-100 / black-alpha-400 | R | def(20;c5) | TR |
| `shadow.brand` | color | `--orb-shadow-brand` | per scope, see below | RBC | def(40;c11) | TR |
| `shadow.popup` | shadow | `--ui-popup-shadow` | `var(--common-shadow-level-03)` | RC | def(20;c5) | TR |
| `shadow.focusInset` | shadow | `--ui-focus-shadow` | `0 0 0 var(--line-m) var(--ui-focus-color) inset` | RC | def(20;c5) | TR |
| `shadow.focusPrimary` | shadow | `--ui-focus-shadow-primary` | `0 0 0 var(--line-05m) var(--orb-elevation-base),0 0 0 3px var(--ui-focus-color)` | RC | def(20;c5) | TR |
| `shadow.card` | shadow | `--ui-card-box-shadow` | — | RC | def(22;c7) | TR |
| `shadow.cardHover` | shadow | `--ui-card-box-shadow-hover` | — | RC | def(22;c7) | TR |
| `shadow.cardNeutral` | shadow | `--ui-card-neutral-box-shadow` | literal `none` | RC | raw(20) | TR |
| `shadow.cardNeutralHover` | shadow | `--ui-card-neutral-box-shadow-hover` | literal `none` | RC | raw(20) | TR |
| `shadow.cardContrast` | shadow | `--ui-card-contrast-box-shadow` | — | RC | def(33;c5) | TR |
| `shadow.cardContrastHover` | shadow | `--ui-card-contrast-box-shadow-hover` | — | RC | def(20;c5) | TR |
| `shadow.modal` | shadow | `--component-modal-box-shadow` | literal `none` | RC | raw(20) | TR |
| `shadow.reactionsPicker` | shadow | `--component-reactions-picker-shadow` | — | RC | def(20;c5) | TR |
| `shadow.joinCallBanner` | shadow | `--component-telemost-action-banner-join-call-box-shadow` | — | RC | def(20;c5) | TR |

`--orb-shadow-brand` per-scope stock values, verified in the pinned file:

- plain scopes (`:root`, `.theme_dark:root`, `.theme_auto:root`):
  `var(--orb-color-ya-messenger-alpha-200)` and, in a second bundle copy,
  `var(--orb-color-ya-messenger-alpha-250)`
- brand compounds (`:root.brand_telemost`, `.theme_dark:root.brand_telemost`,
  `.theme_auto:root.brand_telemost`, and component brand forms):
  `var(--orb-color-ya-telemost-alpha-250)`

`docs/brand-tokens.md` (live capture) reports the brand-compound value
`var(--orb-color-ya-telemost-alpha-250)`, which matches. Binding the token
repaints it everywhere; re-verify live during `tto-6ia.8`.

Evidence notes for the three `raw` shadow slots: the inventory skips them
because their stock value `none` is not color-bearing; raw-CSS verification
found 20 definitions each (21 and 1 consumers respectively for
`--ui-card-neutral-box-shadow` and `--component-modal-box-shadow`).

`shadow.color` recolors `--orb-shadow-level-01/02/03` and, through them,
`--common-shadow-level-01/02/03` and all their consumers. Verified chain:
`--orb-shadow-level-01` = `0px 2px 4px 0px var(--orb-misc-shadow)`;
`--ui-popup-shadow` = `var(--common-shadow-level-03)`.

### 5.14 gradients (2)

Token-defined gradients, full-value slots (a gradient cannot be recolored stop
by stop):

| Slot ID | Kind | Default target | Stock (light / dark) | scopeClass | evidence | om |
| --- | --- | --- | --- | --- | --- | --- |
| `gradient.messageSkeleton` | gradient | `--component-message-balloon-skeleton-gradient` | `linear-gradient(90deg,hsla(0,0%,100%,0) 25%,#fff 48.96%,rgba(221,242,244,0) 75%)` / `linear-gradient(90deg,hsla(0,0%,100%,0) 25%,hsla(0,0%,100%,.06) 48.96%,hsla(0,0%,100%,0) 75%)` | RC | def(34;c6) | TR |
| `gradient.diskLoading` | gradient | `--component-disk-available-space-indicator-loading` | `repeating-linear-gradient(90deg,var(--common-divider) 0%,var(--common-bg-secondary) 25%,var(--common-divider) 50%)` (same in both scopes) | RC | def(20;c5) | TR |

Gradients baked into rules (99 `linear-gradient` occurrences in the pinned
file) are rule-binding territory (section 10), owned by `tto-6ia.6`. Verified
selector contexts include `.yamb-modal.Orb-Theme_theme_light|dark`,
`.ui-popup.Orb-Theme_theme_light|dark`, `.Orb-Popover2.Orb-Theme_theme_light|dark`,
`.yamb-aside_dark-in-light`, `.yamb-upload-files-item__cancel-container`,
`.yamb-message-balloon_compact` (and `_compact.yamb-message-balloon_own`),
`.yamb-thinking-bubble-content__text`, `.yamb-telemost-feedback__modal`,
`.yamb-telemost-promo__image-overlay`, `.yamb-telemost-login-page:before`,
`.yamb-telemost-login-page__scroll-area>.ui-scroll-area__container` (plus its
`_layout_touch` variant), `.yamb-telemost-login-touch-page__cards:before`.
`--telemost-login-background-image` is a remote `url()` image, not a gradient;
images stay an EPIC-level exception.

## 6. Fallback precedence

For slot `S` and active mode `M` (light or dark):

1. `theme.<M>.semantic.<category>.<slot>` present → emit the slot's registry
   token target with that value on the target's scope class (section 9).
2. Otherwise emit nothing for `S`; the stock declaration applies. No cross-mode
   fallback exists: a light slot never takes the dark value, and no slot
   derives from seeds.
3. Raw `lightOverrides` / `darkOverrides` on the same token win cascade ties
   because raw override blocks are emitted after all semantic blocks
   (section 12, position 4 at top level and inside the dark media block).
   Deterministic and deliberate: the existing
   power-user escape hatch stays supreme.
4. **Compatibility qualification.** With `semantic` absent and
   `semanticBindings` empty, old configs parse unchanged. Output is
   byte-identical to the current build **only when `lightOverrides` and
   `darkOverrides` are both empty** (true for the shipped
   `config/mapping.json`). A non-empty `darkOverrides` additionally gains the
   dark `theme_auto` media block (section 8, an intentional fix of a real gap),
   so byte-identity is not promised for that case. Rendering still improves
   consistently; nothing is removed.

## 7. Slot values and cross-mode rules

- Color slots take hex only (`#rgb #rgba #rrggbb #rrggbbaa`).
- Shadow and gradient slots take the full CSS value for the target token
  (sections 8's constraints apply).
- A slot set in only one mode affects only that mode. Setting a slot in both
  modes is the normal case for theme-dependent surfaces.

## 8. theme_auto behavior

Telemost declares `.theme_auto:root` values only inside
`@media(prefers-color-scheme:dark|light)`. The contract:

- **Light under `theme_auto`**: plain `:root` light declarations already match
  `<html class="... theme_auto">`; no light media block is emitted. This mirrors
  the current `buildCss` behavior for ramps and stays correct because `:root`
  is class-agnostic.
- **Dark under `theme_auto`**: one `@media (prefers-color-scheme: dark)` block
  is emitted, containing, in the same order as the top-level sheet (ramps →
  semantic → raw overrides):
  1. dark ramps on `:root.theme_auto` (existing behavior)
  2. dark semantic values on `:root.theme_auto` for `R`-class slots
  3. dark semantic values on `:root.theme_auto.brand_telemost` and
     `:root.theme_auto.Orb-Brand_brand_telemost` for `RB`/`RBC` slots
     (all three selector forms verified in the pinned file)
  4. dark raw overrides on the same auto selectors — this closes the
     verified gap where `darkOverrides` never reached `theme_auto`
- Component-class slots (`RC`, `RBC`, `MN`) need no auto treatment: their
  compound selectors carry `.Orb-Theme_theme_dark`, which the app applies to
  components based on the resolved theme even when `<html>` carries
  `theme_auto`. Only the `:root`-level `theme_dark` class is missing under
  auto, which the media block replaces.
- Targeted rules are not duplicated inside media blocks. Theme-classed rule
  selectors fire under `theme_auto` through the component classes; static rule
  selectors apply their single value in both schemes (section 10 records this
  v1 limitation).

## 9. Scope matrix and cascade strategy

scopeClass → emission scope blocks. A block is skipped when empty. Forms are
exact; all were enumerated from the pinned file.

| Code | Emission scopes (selector lists as emitted) |
| --- | --- |
| `R` | light: `:root`; dark: `.theme_dark:root` |
| `RB` | light: `:root, :root.brand_telemost, :root.Orb-Brand_brand_telemost`; dark: `.theme_dark:root, .theme_dark:root.brand_telemost, .theme_dark:root.Orb-Brand_brand_telemost` |
| `RC` | `R` scopes plus, per mode, per compound `C` in {`yamb-modal`, `ui-popup`, `Orb-Popover2`}, all five verified forms: `.C.Orb-Theme_theme_m`, `.C.Orb-Theme_theme_m.brand_telemost`, `.C.Orb-Theme_theme_m.Orb-Brand_brand_telemost`, `.brand_telemost .C.Orb-Theme_theme_m`, `.Orb-Brand_brand_telemost .C.Orb-Theme_theme_m` |
| `RBC` | union of `RB` and `RC` |
| `MN` | `.yamb-desktop-merge-notice-banner.Orb-Theme_theme_light|dark`, `.yamb-merge-notice__content.Orb-Theme_theme_light|dark` (plain forms only) |
| `REF` | `R` scopes only (no Telemost declaration exists to fight) |

Rules:

- Rationale for the five component forms: the suffixed and descendant forms
  have higher specificity (0,3,0) than the plain form (0,2,0) and are present
  in the pinned file for every component-declared registry token. Partial
  emission would lose inside brand-tinted modals and popovers. Emitting all
  five ties or beats every Telemost declaration; the injected sheet is kept
  last in `head` by the in-page agent (`src/inject.ts`), so document order
  resolves ties. No `!important` anywhere.
- No emission ever targets `.yamb-aside_dark-in-light` or
  `.yamb-telemost-feedback__modal` (ADR-5).
- `buildCss` output order is specified in section 12; its implementation is
  `tto-6ia.4`.

## 10. Targeted rule bindings (schema surface for tto-6ia.6)

- A rule binding recolors one verified `(selector, property)` pair with the
  slot's value as its own rule in the injected sheet, preceded by its stable id
  comment (section 12).
- Selector strings must equal an allowlist entry byte for byte. No user regex,
  no at-rules, no selector lists.
- Rule targets are reserved for occurrences the inventory classifies
  `targeted-rule` (175) or `full-value-replacement` (14). Anything with a
  defining token must use its registry slot instead. Gradient slots may also
  target these pairs, kind permitting (section 11 matrix).
- **Per-mode scoping.** The mode is derived from the selector and stored on the
  registry entry:
  - selector contains `Orb-Theme_theme_light` → mode `light`; consumes
    `light.semantic[slot]`, which must be present.
  - selector contains `Orb-Theme_theme_dark` → mode `dark`; consumes
    `dark.semantic[slot]`, which must be present.
  - neither → mode `static`; the rule applies to both OS schemes. It consumes
    one value: `light.semantic[slot]` and `dark.semantic[slot]` must both be
    present and equal, else `ConfigError`. Rationale: Telemost declares
    theme-neutral rules once, so a mode-split value is meaningless; per-mode
    variants must use the theme-classed allowlist entries.
  - an explicit `mode` field on the binding must equal the derived mode.
- v1 limitation, recorded: static rules cannot express different light/dark
  values; `tto-6ia.6` may add theme-scoped wrapper forms to the allowlist if a
  need is demonstrated, as new registry data with inventory evidence.
- Default bindings contain no rule entries; `semanticBindings` is empty by
  default.

## 11. Selector and property allowlists

Compiled once into `src/theme/semantic-slots.ts` as frozen arrays. A test
regenerates the expectation from `reports/telemost_ui_color_inventory.json`
and fails on drift, so the allowlist is provably derived from the pinned asset.

- `VERIFIED_RULE_TARGETS`: `{ selector, property, mode }` triples where the
  inventory `override` is `targeted-rule` with `kind` `literal-color`
  (175 of the 5,233 `targeted-rule` occurrences; the other 5,058 are
  `token-definition`, handled by the token/override layers) or
  `full-value-replacement` (14 occurrences: 2 `shadow`, 12 `gradient`).
  Mechanically recomputed from the report: those 189 occurrences deduplicate
  to **139 unique `(selector, property)` pairs** (30 pairs occur more than
  once), across **121 unique selectors**, all derived `mode` `static`.
- Observed properties across the 139 pairs (counts verified against the
  report): `color` 55, `background-color` 29, `background` 22, `border` 11,
  `-webkit-mask-image` 5, `mask-image` 5, `border-bottom` 4, `border-color` 3,
  `box-shadow` 2, `-webkit-tap-highlight-color` 1, `border-block-start-color`
  1, `-webkit-text-fill-color` 1. The matrix properties `background-image`,
  `border-top-color`, `fill`, `stroke`, `outline-color` currently have zero
  allowlist pairs: admissible by policy, with no observed target.
- Token targets are not config-reachable in v1 (ADR-2b); the registry's 124
  token targets are the complete token surface.
- Kind/property matrix for rule bindings (production `KIND_PROPERTIES` in
  `src/theme/semantic-slots.ts`): color slots may target `color`,
  `background-color`, `background`, `background-image`, `border-color`,
  `border-top-color`, `fill`, `stroke`, `outline-color`; shadow slots only
  `box-shadow`; gradient slots only `background`, `background-image`.
- Disjoint partition of the 139 pairs by that matrix: 87 bindable by color
  slots only; 22 (`background`) by color or gradient slots; 2 (`box-shadow`)
  by shadow slots; 28 unbindable by any v1 kind.
- Exception policy (EPIC AC2). The 28 unbindable pairs — `border` (11),
  `border-bottom` (4), `-webkit-mask-image` (5), `mask-image` (5),
  `-webkit-tap-highlight-color` (1), `border-block-start-color` (1),
  `-webkit-text-fill-color` (1) — stay in `VERIFIED_RULE_TARGETS` as verified
  inventory targets, but they are documented v1 exceptions, **not
  configurable rules**: border shorthands carry width and style next to the
  color, so a hex-only color value is an invalid declaration there; the three
  color-valued properties are outside `KIND_PROPERTIES.color`; the two mask
  properties are outside `KIND_PROPERTIES.gradient` even though their stock
  values are gradient masks. Widening the matrix or adding value kinds is a
  registry change with inventory evidence (ADR-2b), never a config change.
  The complete per-target exception table (selector, property, audit
  occurrence class, reason, surface) lives in `docs/semantic-colors.md`; its
  row set was verified programmatically to equal exactly these 28 pairs.

## 12. Stable rule IDs and deterministic output order

Rule ID format: `semantic.<slotId>.<mode>` with mode `light|dark|static`, e.g.
`semantic.gradient.messageSkeleton.dark`. Emitted as a leading comment
`/* tto: semantic.gradient.messageSkeleton.dark */` above its rule or scope
block. IDs depend only on slot and mode, never on value or position.

Canonical output order (top level), implemented by `tto-6ia.4`:

1. Banner comment (existing format, no timestamps).
2. Ramps: `:root` light, then `.theme_dark` dark (existing order).
3. Semantic token scope blocks in this order: `R`, `RB`, the text half of `RBC`,
   `RC`, the remaining `RBC` slots, `MN`, `REF`. The `RBC` split preserves the
   section 9 cascade while keeping brand text before component scopes. Within a block, modes light then dark; within a mode,
   categories in `SEMANTIC_CATEGORIES` order, then slot key byte-order
   ascending; one declaration per line, `  <token>: <value>;`.
4. Raw overrides: `lightOverrides` block, then `darkOverrides` block
   (existing format; now positioned after semantics so raw wins ties, per
   section 6.3).
5. Targeted rule bindings: mode order `light`, `dark`, `static`; within a
   mode, category order then slot byte-order. Each rule carries its id comment.

Then the single `theme_auto` media block, whose internals follow the same
order restricted to auto scopes: dark ramps, dark semantics (R scopes, then
brand scopes), dark raw overrides (section 8). No light media block exists.

Determinism guards, tested: no timestamps; every iteration over config maps is
sorted; fixed selector list order in every block; binding arrays sorted by
(slot, selector, property) before emission. Duplicate resolved tokens in one
mode are a hard error (section 4), so ordering can never hide a config
mistake.

## 13. ADR — chosen design and alternatives

ADR-1 (chosen): named semantic slots in `theme.json` with registry-owned token
targets; rule-only bindings in `mapping.json`; targets restricted to
code-owned allowlists cross-checked against the pinned inventory. Values live
with the theme; targets live with the mapping; both optional.

ADR-2 (rejected): one free-form `overrides` map per mode in `theme.json`, as
shuvcode does. It cannot express per-role intent or fallbacks and creates
exactly the ambiguous single field the issue bans. The existing
`lightOverrides`/`darkOverrides` maps in `mapping.json` remain the documented
escape hatch and outrank semantics deterministically.

ADR-2b (rejected for v1): `kind: "token"` redirect bindings letting a slot
target an arbitrary custom property. Any such target would need the full
evidence treatment (definitions, scopes, override method) before it is safe,
and config is the wrong place to smuggle in unaudited targets. Extending
coverage is a registry change with inventory evidence, not a config change.

ADR-3 (rejected): one ramp family per role. Ramps generate 24 declarations
from one seed and cannot express "`status.dangerSurface` differs from
`status.dangerText`" without a family per token. Explosive and still
ambiguous.

ADR-4 (rejected): derive semantics from seeds via `color-mix()` or relative
color syntax. Relative color syntax is unavailable in QtWebEngine 6.8.3
(Chrome 122; shipped upstream in Chrome 131), and seed derivation contradicts
independent per-role control.

ADR-5 (rejected): emitting overrides on `.yamb-aside_dark-in-light` and
`.yamb-telemost-feedback__modal`. These scopes intentionally render dark
surfaces inside a light theme; forcing theme values there erases that design.
Allowlisted rule bindings remain available for explicit, reviewed intent.

ADR-6 (rejected): MutationObserver-style runtime recoloring for semantics.
Static emission is deterministic, diffable, and testable. Dynamic DOM work is
`tto-6ia.7`.

ADR-7 (rejected): `!important`. Unnecessary — the injected sheet is kept last,
ties resolve by order — and it would beat deliberate user-agent styling and
complicate the auto media block. User values cannot contain `!` anyway
(section 3).

## 14. Rejected unsafe approaches

- Interpolating raw user strings without the `[^;{}@"'!]` ban and the balanced
  parenthesis rule. A `}` escapes its block; an at-rule char opens one; an
  unbalanced quote swallows following CSS; `!important` would poison the
  cascade contract. All banned by construction (section 3).
- Accepting user-supplied selectors or at-rules. Only byte-exact allowlisted
  selectors and properties pass.
- Binding `--alice-oknyx-background`. Verified: 33 definitions, 0 var()
  consumers in the pinned file. Dead output implying false coverage. Listed
  unverified (section 19).
- Color slots targeting `--ui-card-neutral-border` /
  `--ui-card-contrast-border`. Both hold full `border` shorthand values
  (section 5.5); a hex value is invalid there. Slots removed in rev 2.
- Default-binding component-scoped tokens without enumerating their declaring
  selector forms. The MN family ships together with its two verified
  compounds; RC/RBC families with all five forms per compound.
- Binding alias tokens (`--common-accent`, `--common-counter`,
  `--common-destructive`, `--common-text-*`) as primary slots: two fields
  fighting over one outcome. Documented alias chains instead.
- Sprinkling `!important` to win specificity fights; hides future cascade
  regressions.
- Guessing stock values or selectors from memory where the pinned file
  disagrees; discrepancies are flagged (`--orb-shadow-brand`), never silently
  resolved.

## 15. Exact files and symbols to change, by issue

`tto-6ia.2` (this issue — contract only):

| File | Change | Symbols |
| --- | --- | --- |
| `src/schema.ts` | value schemas, 15 strict category schemas, `semanticSlotsSchema`, rule-only binding schema, extends | new: `cssCustomPropertyNameSchema`, `cssPropertyNameSchema`, `safeCssValueSchema`, `balancedParens`, `semanticColorValueSchema`, `shadowValueSchema`, `gradientValueSchema`, `slotIdSchema`, `pageSemanticSlotsSchema` … `gradientSemanticSlotsSchema`, `semanticSlotsSchema`, `semanticBindingRuleSchema`, `semanticBindingSchema`, `SEMANTIC_CATEGORIES`; types `SemanticSlots`, `SemanticBinding`; modified: `themeVariantSchema` (+`semantic`), `mappingConfigSchema` (+`semanticBindings`, +`semanticCanaries`) |
| `src/theme/semantic-slots.ts` | new file: registry and allowlists (data, no emitter) | `SEMANTIC_SLOT_REGISTRY`, `SEMANTIC_SCOPE_BLOCKS`, `VERIFIED_RULE_TARGETS`, `semanticRuleId`, `resolveSemanticTargets` |
| `src/config.ts` | binding/canary validation with slot-id error paths | modified: `loadMapping` |
| `src/schema.test.ts`, `src/theme/semantic-slots.test.ts` | new: contract tests (section 17, owner `tto-6ia.2` rows) | — |

Explicitly **not** changed by `tto-6ia.2`:

| File | Owner | Work |
| --- | --- | --- |
| `src/theme/generate.ts` | `tto-6ia.4` | implement sections 9 + 12: `buildSemanticSections`, `buildRuleBindingSections`, `buildAutoMediaSections`, `buildCss` integration; the section 12 order and the section 6.4 qualification are its acceptance criteria |
| `config/theme.json`, `config/mapping.json`, `src/defaults/*` | `tto-6ia.4/5` | optional fields stay absent until a feature needs them |
| remaining RC/RBC container/state wiring validation | `tto-6ia.5` | container/state token coverage and the `--orb-color-ya-telemost-*` component re-declaration gap |
| rule emission end to end | `tto-6ia.6` | `VERIFIED_RULE_TARGETS` consumption in the sheet |
| runtime/dynamic DOM | `tto-6ia.7` | live-call surfaces |
| `src/inject.ts` (`verify`, `semanticCanaries` wiring), WCAG | `tto-6ia.8` | CDP assertion of `semanticCanaries`; visual QA |

## 16. Phased implementation (tto-6ia.2 scope)

1. **Registry + allowlists.** Write `src/theme/semantic-slots.ts` from section
   5 (124 entries with `scopeClass`/`evidence`/`overrideMethod`) and section
   10/11 rule data. Tests: inventory cross-check per entry; `raw` entries
   asserted against the raw pinned CSS; `REF` entries asserted to have zero
   pinned-file definitions; `::selection` absence asserted.
2. **Schema.** Add the section 3/4 shapes to `src/schema.ts`. Tests: old
   configs parse unchanged; strictness rejections; every value constraint of
   section 3; rule-only bindings; per-mode scoping validation.
3. **Loader validation.** `loadMapping` refinements with slot-id error paths.
4. **Handoff.** `tto-6ia.3` turns the section 17 matrix into RED tests;
   `tto-6ia.4` implements the emitter against sections 9/12 and the T-EMIT /
   T-AUTO / T-DET rows; `tto-6ia.5/6/7/8` per section 15.

Each phase lands green: `bun test`, `bun run typecheck`.

## 17. RED test matrix

Owner column splits the matrix across issues. Every row fails before its
implementation lands.

| ID | Owner | File | Test | Assertion |
| --- | --- | --- | --- | --- |
| T-BC-01 | .2 | schema.test.ts | old theme parses unchanged | `desktopThemeSchema.safeParse(config/theme.json)` succeeds; no `semantic` key in output |
| T-BC-02 | .2 | schema.test.ts | old mapping parses unchanged | `mappingConfigSchema.safeParse(config/mapping.json)` succeeds; `semanticBindings`/`semanticCanaries` default `[]` |
| T-BC-03 | .2→.4 | generate.test.ts | byte-identity, qualified | with no `semantic` fields and empty `lightOverrides`/`darkOverrides`, new `buildCss` output equals the current golden string; with non-empty `darkOverrides`, output equals golden plus the dark auto media block (documented fix, section 6.4) |
| T-SCH-01 | .2 | schema.test.ts | hex-only color slots | `#rgb #rgba #rrggbb #rrggbbaa` pass; `red`, `rgb(…)`, `var(--x)` fail with path |
| T-SCH-02 | .2 | schema.test.ts | value injection rejected | values containing `;`, `{`, `}`, `@`, `"`, `'`, `!` fail |
| T-SCH-03 | .2 | schema.test.ts | balanced parentheses required | `rgba(0,0,0` fails; `rgba(0,0,0,1)` passes |
| T-SCH-04 | .2 | schema.test.ts | shadow slots reject `url()` | `"0 0 4px #000"` passes; `"0 0 4px url(#x)"` fails |
| T-SCH-05 | .2 | schema.test.ts | gradient slots need `gradient(` and reject `url()` | `"#fff"` and `"linear-gradient(90deg,#fff,url(#x))"` fail; `"linear-gradient(90deg,#fff,#000)"` passes |
| T-SCH-06 | .2 | schema.test.ts | `!important` unreachable | `"#fff !important"` fails (banned `!`) |
| T-SCH-07 | .2 | schema.test.ts | strict category objects | unknown key `backgroud` under `semantic.page` fails; unknown category `typo` fails |
| T-SCH-08 | .2 | schema.test.ts | token-kind bindings do not exist | `{kind:"token",...}` fails discrimination |
| T-SCH-09 | .2 | schema.test.ts | unknown slot in rule binding rejected | `slot:"page.bogus"` fails with slot id in message |
| T-SCH-10 | .2 | schema.test.ts | duplicate slot binding rejected | two bindings for `page.background` → `ConfigError` |
| T-SCH-11 | .2 | schema.test.ts | non-allowlisted rule target rejected | unlisted selector or property fails byte-match |
| T-SCH-12 | .2 | schema.test.ts | per-mode rule scoping enforced | `theme_dark` selector with mode `light` fails; static selector with unequal light/dark values fails; explicit `mode` must equal derived |
| T-SCH-13 | .2 | schema.test.ts | kind/property matrix enforced | gradient slot to `box-shadow` rule fails; shadow slot to `box-shadow` passes |
| T-SCH-14 | .2 | schema.test.ts | semanticCanaries must be root-scoped | `--orb-button-brand-background` rejected; `--common-bg` accepted |
| T-INV-01 | .2 | semantic-slots.test.ts | registry evidence holds | for each of the 124 entries: `def(n;cm)` matches inventory definition occurrences and scope groups; `raw(n)` matches raw-CSS definitions; `ref(c)` has 0 definitions and c consumers |
| T-INV-02 | .2 | semantic-slots.test.ts | rule allowlist derives from inventory | every `VERIFIED_RULE_TARGETS` triple occurs with override `targeted-rule`/`full-value-replacement`; counts match (175/14) |
| T-INV-03 | .2 | semantic-slots.test.ts | no `::selection` anywhere | registry, allowlists, and (later) emitted output contain none |
| T-EMIT-01 | .4 | generate.test.ts | scope matrix emission | per section 9: `R` on root scopes; `RC` on all five forms × three compounds × both modes; `MN` on the two merge-notice compounds; `REF` on root scopes only |
| T-EMIT-02 | .4 | generate.test.ts | absent slots emit nothing | no declaration for an unset slot in any mode |
| T-EMIT-03 | .4 | generate.test.ts | no cross-mode fallback | dark-only `text.primary` leaves light `--orb-text-primary` untouched |
| T-EMIT-04 | .4 | generate.test.ts | order: ramps → semantics → raw → rules | sheet sections appear in section 12 order; raw value wins ties on a shared token |
| T-EMIT-05 | .4 | generate.test.ts | duplicate resolved token is an error | two slots → `--common-bg` in one mode throws naming both |
| T-AUTO-01 | .4 | generate.test.ts | dark semantics inside dark media | `:root.theme_auto` carries dark values for `R` slots inside the dark media block |
| T-AUTO-02 | .4 | generate.test.ts | brand auto compounds | `:root.theme_auto.brand_telemost`, `:root.theme_auto.Orb-Brand_brand_telemost` carry dark `RBC` values |
| T-AUTO-03 | .4 | generate.test.ts | darkOverrides reach theme_auto | raw dark overrides appear inside the dark media block (gap fix) |
| T-AUTO-04 | .4 | generate.test.ts | no light media block | light values ride on plain `:root`; no `@media (prefers-color-scheme: light)` block is emitted |
| T-DET-01 | .4 | generate.test.ts | two builds byte-identical | `buildCss(...)` === `buildCss(...)` |
| T-DET-02 | .4 | generate.test.ts | fixed ordering snapshot | sheet matches the ordered snapshot of section 12 |
| T-DET-03 | .4 | generate.test.ts | rule ids stable | `semantic.<slot>.<mode>` comment format holds |
| T-DET-04 | .4 | generate.test.ts | no `!important`, no stray media | regex sweep over output |
| T-VER-01 | .8 | (inject tests) | semanticCanaries verified over CDP | `verify` reads `[...canaryTokens, ...semanticCanaries]` |

## 18. Definition of done (tto-6ia.2)

- [ ] `src/theme/semantic-slots.ts` exists: 124 slots, each with `scopeClass`,
      `evidence`, `overrideMethod`; T-INV-01..03 green.
- [ ] Zod shapes per sections 3–4; all fifteen category schemas strict; every
      value constraint of section 3 tested (T-SCH-01..08).
- [ ] Rule-only bindings with per-mode scoping validated (T-SCH-09..13).
- [ ] Old `config/theme.json` + `config/mapping.json` parse unchanged
      (T-BC-01/02); byte-identity claim carries the section 6.4 qualification
      and T-BC-03 asserts both branches.
- [ ] `loadMapping` rejects every section 4 violation with slot-id error paths.
- [ ] Sections 9, 10, 12 marked ready-for-implementation and handed to
      `tto-6ia.4`; section 15 ownership table recorded in the issue.
- [ ] `bun test`, `bun run typecheck` green; no changes outside
      `src/schema.ts`, `src/theme/semantic-slots.ts`, `src/config.ts`, and the
      two new test files.
- [ ] `--orb-shadow-brand` per-scope values recorded here and flagged for live
      re-verification in `tto-6ia.8`.
- [ ] Section 19 items remain explicitly unverified and unbound.

## 19. Unverified and live-call-only bindings

None of these may ship as a bound slot:

- `live-call-dom`: the live call surface is unverified. `tto-6ia.1`
  (verification) and `tto-6ia.7` (runtime).
- `inline-style`: element style attributes are outside any stylesheet.
- `svg-dom`: SVG drawn via DOM attributes; the pinned file has exactly one
  masked `url()` fill. currentColor glyphs are covered via text slots
  (section 5.8); painted SVG assets are not.
- `image` / `video` / `canvas` / `iframe`: pixel sources, out of scope per the
  EPIC. Includes `--telemost-login-background-image` (remote `url()`).
- `--alice-oknyx-background`: 33 definitions, 0 consumers in the pinned file.
  Excluded; binding would be dead output.
- `--orb-calendar-cell-background-selected`,
  `--local-orb-segmented-control-fill-color-checked-base`: bound as `REF` —
  consumed (2 occurrences each, inline fallbacks) but not defined in the
  pinned file; live resolution unverified.
- `--orb-shadow-brand`: per-scope values recorded in section 5.13; the plain
  `ya-messenger` vs brand `ya-telemost` split is verified statically, live
  behavior re-check owned by `tto-6ia.8`.
