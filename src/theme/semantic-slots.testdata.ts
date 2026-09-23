/**
 * Test-owned contract data for the semantic color registry — the complete,
 * machine-verified transcription of `.beads/artifacts/tto-6ia.2/plan.md`
 * sections 5 (slot registry), 9 (scope matrix) and 7 (value kinds).
 *
 * This file is SPECIFICATION, not production code. It exists so that
 *
 *   - `src/theme/semantic-slots.test.ts` can deep-compare the production
 *     `SEMANTIC_SLOT_REGISTRY` against the plan, and
 *   - `src/theme/generate.test.ts` can drive all 124 slots through `buildCss`
 *     without importing the (not-yet-implemented) registry module.
 *
 * Every evidence number below was recomputed from
 * `reports/telemost_ui_color_inventory.json` and the pinned stylesheet
 * `research_notes/Полная перекраска интерфейса Телемоста/evidence/telemost_ui.css`
 * (sha256 7ee580fd…) before being written down; the derivation rule is encoded
 * in `deriveEvidenceStats` in `src/theme/semantic-slots.test.ts` and matches
 * the plan table 124/124. Do not "fix" a number here by hand — re-derive it.
 *
 * Reading decision (plan-forced): `SEMANTIC_CATEGORIES` (plan §3) has 15
 * entries and does NOT contain `border`, so the four `border.*` slot ids live
 * under the `line` category in theme.json (`semantic.line.compose` etc.).
 * Their registry ids keep the plan's `border.*` spelling.
 */

export type SemanticSlotKind = "color" | "shadow" | "gradient"

/** Plan §5 legend: R root; RB root+brand; RC root+component; RBC union; MN merge-notice; REF reference-only. */
export type ScopeClass = "R" | "RB" | "RC" | "RBC" | "MN" | "REF"

/**
 * Plan §5 legend, structured:
 *  - def(n;cM): n inventory token-definition occurrences across M component scope groups
 *  - raw(n): n definitions in the raw pinned CSS, skipped by the inventory heuristic
 *  - ref(c): 0 definitions anywhere, c var() consumers in the raw pinned CSS
 */
export type SlotEvidence =
  | { readonly source: "def"; readonly definitions: number; readonly scopeGroups: number }
  | { readonly source: "raw"; readonly definitions: number }
  | { readonly source: "ref"; readonly consumers: number }

export interface SemanticSlotSpec {
  readonly id: string
  /** theme.json nesting: `semantic.<category>.<key>` */
  readonly category: string
  readonly key: string
  readonly kind: SemanticSlotKind
  /** Registry-owned default token target (plan §5, ADR-2b: not config-reachable). */
  readonly token: string
  readonly scopeClass: ScopeClass
  readonly evidence: SlotEvidence
}

const def = (definitions: number, scopeGroups: number): SlotEvidence => ({ source: "def", definitions, scopeGroups })
const raw = (definitions: number): SlotEvidence => ({ source: "raw", definitions })
const ref = (consumers: number): SlotEvidence => ({ source: "ref", consumers })

/** Plan §5.1 — page (7). */
const PAGE: readonly SemanticSlotSpec[] = [
  { id: "page.background", category: "page", key: "background", kind: "color", token: "--common-bg", scopeClass: "RC", evidence: def(20, 5) },
  { id: "page.backgroundSecondary", category: "page", key: "backgroundSecondary", kind: "color", token: "--common-bg-secondary", scopeClass: "RC", evidence: def(20, 5) },
  { id: "page.settingsBackground", category: "page", key: "settingsBackground", kind: "color", token: "--common-settings-bg", scopeClass: "RC", evidence: def(20, 5) },
  { id: "page.actionbar", category: "page", key: "actionbar", kind: "color", token: "--common-actionbar", scopeClass: "RC", evidence: raw(20) },
  { id: "page.surface", category: "page", key: "surface", kind: "color", token: "--common-surface-bg", scopeClass: "RC", evidence: def(20, 5) },
  { id: "page.poll", category: "page", key: "poll", kind: "color", token: "--common-poll-bg", scopeClass: "RC", evidence: def(21, 6) },
  { id: "page.conversation", category: "page", key: "conversation", kind: "color", token: "--conversation-bg", scopeClass: "RC", evidence: def(21, 6) },
]

/** Plan §5.2 — surface (13). */
const SURFACE: readonly SemanticSlotSpec[] = [
  { id: "surface.generic", category: "surface", key: "generic", kind: "color", token: "--orb-surface-generic", scopeClass: "R", evidence: def(20, 5) },
  { id: "surface.genericHovered", category: "surface", key: "genericHovered", kind: "color", token: "--orb-surface-generic-hovered", scopeClass: "R", evidence: def(20, 5) },
  { id: "surface.genericPressed", category: "surface", key: "genericPressed", kind: "color", token: "--orb-surface-generic-pressed", scopeClass: "R", evidence: def(20, 5) },
  { id: "surface.genericMedium", category: "surface", key: "genericMedium", kind: "color", token: "--orb-surface-generic-medium", scopeClass: "R", evidence: def(20, 5) },
  { id: "surface.genericMediumHovered", category: "surface", key: "genericMediumHovered", kind: "color", token: "--orb-surface-generic-medium-hovered", scopeClass: "R", evidence: def(20, 5) },
  { id: "surface.genericMediumPressed", category: "surface", key: "genericMediumPressed", kind: "color", token: "--orb-surface-generic-medium-pressed", scopeClass: "R", evidence: def(20, 5) },
  { id: "surface.genericAlt", category: "surface", key: "genericAlt", kind: "color", token: "--orb-surface-generic-alt", scopeClass: "R", evidence: def(20, 5) },
  { id: "surface.disabled", category: "surface", key: "disabled", kind: "color", token: "--orb-surface-disabled", scopeClass: "R", evidence: def(20, 5) },
  { id: "surface.inverse", category: "surface", key: "inverse", kind: "color", token: "--orb-surface-inverse", scopeClass: "R", evidence: def(20, 5) },
  { id: "surface.inverseHovered", category: "surface", key: "inverseHovered", kind: "color", token: "--orb-surface-inverse-hovered", scopeClass: "R", evidence: def(20, 5) },
  { id: "surface.inversePressed", category: "surface", key: "inversePressed", kind: "color", token: "--orb-surface-inverse-pressed", scopeClass: "R", evidence: def(20, 5) },
  { id: "surface.staticLight", category: "surface", key: "staticLight", kind: "color", token: "--orb-surface-static-light", scopeClass: "R", evidence: def(20, 5) },
  { id: "surface.staticHeavy", category: "surface", key: "staticHeavy", kind: "color", token: "--orb-surface-static-heavy", scopeClass: "R", evidence: def(20, 5) },
]

/** Plan §5.3 — elevation (6) and modal surfaces (3). */
const ELEVATION: readonly SemanticSlotSpec[] = [
  { id: "elevation.base", category: "elevation", key: "base", kind: "color", token: "--orb-elevation-base", scopeClass: "R", evidence: def(20, 5) },
  { id: "elevation.risen", category: "elevation", key: "risen", kind: "color", token: "--orb-elevation-risen", scopeClass: "R", evidence: def(20, 5) },
  { id: "elevation.sunken", category: "elevation", key: "sunken", kind: "color", token: "--orb-elevation-sunken", scopeClass: "R", evidence: def(20, 5) },
  { id: "elevation.overlay", category: "elevation", key: "overlay", kind: "color", token: "--orb-elevation-overlay", scopeClass: "R", evidence: def(20, 5) },
  { id: "elevation.overlayModal", category: "elevation", key: "overlayModal", kind: "color", token: "--orb-elevation-overlay-modal", scopeClass: "R", evidence: def(20, 5) },
  { id: "elevation.sidebar", category: "elevation", key: "sidebar", kind: "color", token: "--orb-elevation-base-sidebar", scopeClass: "R", evidence: def(20, 5) },
]

const MODAL: readonly SemanticSlotSpec[] = [
  { id: "modal.popup", category: "modal", key: "popup", kind: "color", token: "--ui-popup-bg", scopeClass: "RC", evidence: def(20, 5) },
  { id: "modal.card", category: "modal", key: "card", kind: "color", token: "--ui-card-neutral-bg", scopeClass: "RC", evidence: def(20, 5) },
  { id: "modal.cardContrast", category: "modal", key: "cardContrast", kind: "color", token: "--ui-card-contrast-bg", scopeClass: "RC", evidence: def(33, 5) },
]

/** Plan §5.4 — overlays (5). */
const OVERLAY: readonly SemanticSlotSpec[] = [
  { id: "overlay.scrim", category: "overlay", key: "scrim", kind: "color", token: "--common-overlay-bg", scopeClass: "RC", evidence: def(20, 5) },
  { id: "overlay.backdrop", category: "overlay", key: "backdrop", kind: "color", token: "--overlay-shadow-color", scopeClass: "RC", evidence: def(20, 5) },
  { id: "overlay.background", category: "overlay", key: "background", kind: "color", token: "--overlay-background-color", scopeClass: "RC", evidence: def(20, 5) },
  { id: "overlay.textPrimary", category: "overlay", key: "textPrimary", kind: "color", token: "--overlay-primary-color", scopeClass: "RC", evidence: def(20, 5) },
  { id: "overlay.textSecondary", category: "overlay", key: "textSecondary", kind: "color", token: "--overlay-secondary-color", scopeClass: "RC", evidence: def(20, 5) },
]

/**
 * Plan §5.5 — lines, borders, dividers (12).
 *
 * The four `border.*` ids are registered under the `line` category (see the
 * reading note in the file header): `border.compose` ≙ `semantic.line.compose`.
 */
const LINE: readonly SemanticSlotSpec[] = [
  { id: "line.generic", category: "line", key: "generic", kind: "color", token: "--orb-line-generic", scopeClass: "R", evidence: def(20, 5) },
  { id: "line.genericLight", category: "line", key: "genericLight", kind: "color", token: "--orb-line-generic-light", scopeClass: "R", evidence: def(20, 5) },
  { id: "line.genericMedium", category: "line", key: "genericMedium", kind: "color", token: "--orb-line-generic-medium", scopeClass: "R", evidence: def(20, 5) },
  { id: "line.genericHeavy", category: "line", key: "genericHeavy", kind: "color", token: "--orb-line-generic-heavy", scopeClass: "R", evidence: def(20, 5) },
  { id: "line.divider", category: "line", key: "divider", kind: "color", token: "--common-divider", scopeClass: "RC", evidence: def(20, 5) },
  { id: "line.darkmode", category: "line", key: "darkmode", kind: "color", token: "--orb-misc-line-darkmode", scopeClass: "R", evidence: def(20, 5) },
  { id: "border.compose", category: "line", key: "compose", kind: "color", token: "--ui-compose-border-color", scopeClass: "RC", evidence: def(20, 5) },
  { id: "border.mainBanner", category: "line", key: "mainBanner", kind: "color", token: "--main-banner-border-color", scopeClass: "RC", evidence: def(20, 5) },
  { id: "border.codeBlock", category: "line", key: "codeBlock", kind: "color", token: "--component-code-block-border-color", scopeClass: "RC", evidence: def(20, 5) },
  { id: "border.joinCallBanner", category: "line", key: "joinCallBanner", kind: "color", token: "--component-telemost-action-banner-join-call-border-color", scopeClass: "RC", evidence: def(20, 5) },
  { id: "line.codeIncomingDivider", category: "line", key: "codeIncomingDivider", kind: "color", token: "--component-code-incoming-divider-color", scopeClass: "RC", evidence: def(20, 5) },
  { id: "line.codeOutgoingDivider", category: "line", key: "codeOutgoingDivider", kind: "color", token: "--component-code-outgoing-divider-color", scopeClass: "RC", evidence: def(20, 5) },
]

/** Plan §5.6 — focus (2). */
const FOCUS: readonly SemanticSlotSpec[] = [
  { id: "focus.color", category: "focus", key: "color", kind: "color", token: "--ui-focus-color", scopeClass: "RC", evidence: def(20, 5) },
  { id: "focus.cardOutline", category: "focus", key: "cardOutline", kind: "color", token: "--ui-card-focus-outline-color", scopeClass: "RC", evidence: def(20, 5) },
]

/** Plan §5.7 — text (9). */
const TEXT: readonly SemanticSlotSpec[] = [
  { id: "text.primary", category: "text", key: "primary", kind: "color", token: "--orb-text-primary", scopeClass: "R", evidence: def(20, 5) },
  { id: "text.secondary", category: "text", key: "secondary", kind: "color", token: "--orb-text-secondary", scopeClass: "R", evidence: def(20, 5) },
  { id: "text.tertiary", category: "text", key: "tertiary", kind: "color", token: "--orb-text-tertiary", scopeClass: "R", evidence: def(20, 5) },
  { id: "text.disabled", category: "text", key: "disabled", kind: "color", token: "--orb-text-disabled", scopeClass: "R", evidence: def(20, 5) },
  { id: "text.inverse", category: "text", key: "inverse", kind: "color", token: "--orb-text-inverse", scopeClass: "R", evidence: def(20, 5) },
  { id: "text.link", category: "text", key: "link", kind: "color", token: "--orb-text-link", scopeClass: "RBC", evidence: def(40, 11) },
  { id: "text.linkHovered", category: "text", key: "linkHovered", kind: "color", token: "--orb-text-link-hovered", scopeClass: "RBC", evidence: def(40, 11) },
  { id: "text.staticLight", category: "text", key: "staticLight", kind: "color", token: "--orb-text-static-light", scopeClass: "R", evidence: def(20, 5) },
  { id: "text.staticHeavy", category: "text", key: "staticHeavy", kind: "color", token: "--orb-text-static-heavy", scopeClass: "R", evidence: def(20, 5) },
]

/**
 * Plan §5.8 — icons (2).
 *
 * Monochrome icons need no further slots: 28 `currentColor` occurrences in the
 * pinned file make them follow the text slots automatically.
 */
const ICON: readonly SemanticSlotSpec[] = [
  { id: "icon.primary", category: "icon", key: "primary", kind: "color", token: "--common-icons-primary", scopeClass: "RC", evidence: def(20, 5) },
  { id: "icon.secondary", category: "icon", key: "secondary", kind: "color", token: "--common-icons-secondary", scopeClass: "RC", evidence: def(20, 5) },
]

/** Plan §5.9 — controls and their states (20). */
const CONTROL: readonly SemanticSlotSpec[] = [
  { id: "control.brandSurface", category: "control", key: "brandSurface", kind: "color", token: "--orb-surface-brand", scopeClass: "RBC", evidence: def(42, 13) },
  { id: "control.brandSurfaceHovered", category: "control", key: "brandSurfaceHovered", kind: "color", token: "--orb-surface-brand-hovered", scopeClass: "RBC", evidence: def(42, 13) },
  { id: "control.brandSurfacePressed", category: "control", key: "brandSurfacePressed", kind: "color", token: "--orb-surface-brand-pressed", scopeClass: "RBC", evidence: def(42, 13) },
  { id: "control.brandSurfaceLight", category: "control", key: "brandSurfaceLight", kind: "color", token: "--orb-surface-brand-light", scopeClass: "RBC", evidence: def(40, 11) },
  { id: "control.brandSurfaceLightHovered", category: "control", key: "brandSurfaceLightHovered", kind: "color", token: "--orb-surface-brand-light-hovered", scopeClass: "RBC", evidence: def(40, 11) },
  { id: "control.brandSurfaceLightPressed", category: "control", key: "brandSurfaceLightPressed", kind: "color", token: "--orb-surface-brand-light-pressed", scopeClass: "RBC", evidence: def(40, 11) },
  { id: "control.buttonBrand", category: "control", key: "buttonBrand", kind: "color", token: "--orb-button-brand-background", scopeClass: "MN", evidence: def(4, 2) },
  { id: "control.buttonBrandHover", category: "control", key: "buttonBrandHover", kind: "color", token: "--orb-button-brand-background-hover", scopeClass: "MN", evidence: def(4, 2) },
  { id: "control.buttonBrandActive", category: "control", key: "buttonBrandActive", kind: "color", token: "--orb-button-brand-background-active", scopeClass: "MN", evidence: def(4, 2) },
  { id: "control.buttonBrandText", category: "control", key: "buttonBrandText", kind: "color", token: "--orb-button-brand-text", scopeClass: "MN", evidence: def(4, 2) },
  { id: "control.iconButtonPrimary", category: "control", key: "iconButtonPrimary", kind: "color", token: "--ui-icon-button-primary", scopeClass: "RC", evidence: def(20, 5) },
  { id: "control.iconButtonPrimaryHoverBg", category: "control", key: "iconButtonPrimaryHoverBg", kind: "color", token: "--ui-icon-button-primary-hover-bg", scopeClass: "RC", evidence: def(20, 5) },
  { id: "control.iconButtonAccent", category: "control", key: "iconButtonAccent", kind: "color", token: "--ui-icon-button-accent", scopeClass: "RC", evidence: def(20, 5) },
  { id: "control.iconButtonAccentHover", category: "control", key: "iconButtonAccentHover", kind: "color", token: "--ui-icon-button-accent-hover", scopeClass: "RC", evidence: def(20, 5) },
  { id: "control.iconButtonAccentPressed", category: "control", key: "iconButtonAccentPressed", kind: "color", token: "--ui-icon-button-accent-pressed", scopeClass: "RC", evidence: def(20, 5) },
  { id: "control.iconButtonAccentText", category: "control", key: "iconButtonAccentText", kind: "color", token: "--ui-icon-button-accent-text", scopeClass: "RC", evidence: def(20, 5) },
  { id: "control.messageButtonBackground", category: "control", key: "messageButtonBackground", kind: "color", token: "--component-message-button-background-color", scopeClass: "RC", evidence: def(20, 5) },
  { id: "control.messageButtonBackgroundHovered", category: "control", key: "messageButtonBackgroundHovered", kind: "color", token: "--component-message-button-background-color-hovered", scopeClass: "RC", evidence: def(20, 5) },
  { id: "control.messageButtonText", category: "control", key: "messageButtonText", kind: "color", token: "--component-message-button-text-color", scopeClass: "RC", evidence: def(20, 5) },
  { id: "control.sendButtonDestructive", category: "control", key: "sendButtonDestructive", kind: "color", token: "--ui-send-message-button-destructive-bg", scopeClass: "RC", evidence: def(20, 5) },
]

/** Plan §5.10 — card and list states (8). */
const STATE: readonly SemanticSlotSpec[] = [
  { id: "state.cardHover", category: "state", key: "cardHover", kind: "color", token: "--ui-card-bg-hover", scopeClass: "RC", evidence: def(22, 7) },
  { id: "state.cardActive", category: "state", key: "cardActive", kind: "color", token: "--ui-card-bg-active", scopeClass: "RC", evidence: def(22, 7) },
  { id: "state.cardDisabled", category: "state", key: "cardDisabled", kind: "color", token: "--ui-card-bg-disabled", scopeClass: "RC", evidence: def(20, 5) },
  { id: "state.cardNeutralHover", category: "state", key: "cardNeutralHover", kind: "color", token: "--ui-card-neutral-bg-hover", scopeClass: "RC", evidence: def(20, 5) },
  { id: "state.cardNeutralActive", category: "state", key: "cardNeutralActive", kind: "color", token: "--ui-card-neutral-bg-active", scopeClass: "RC", evidence: def(20, 5) },
  { id: "state.cardContrastHover", category: "state", key: "cardContrastHover", kind: "color", token: "--ui-card-contrast-bg-hover", scopeClass: "RC", evidence: def(33, 5) },
  { id: "state.cardContrastActive", category: "state", key: "cardContrastActive", kind: "color", token: "--ui-card-contrast-bg-active", scopeClass: "RC", evidence: def(33, 5) },
  { id: "state.listItemActive", category: "state", key: "listItemActive", kind: "color", token: "--ui-list-item-active-background-color", scopeClass: "RC", evidence: def(20, 5) },
]

/** Plan §5.11 — selection (4). The pinned file has zero `::selection` rules (T-INV-03). */
const SELECTION: readonly SemanticSlotSpec[] = [
  { id: "selection.messageRow", category: "selection", key: "messageRow", kind: "color", token: "--component-message-row-selected-background", scopeClass: "RC", evidence: def(20, 5) },
  { id: "selection.reaction", category: "selection", key: "reaction", kind: "color", token: "--components-reaction-bg", scopeClass: "RC", evidence: def(20, 5) },
  { id: "selection.calendarCell", category: "selection", key: "calendarCell", kind: "color", token: "--orb-calendar-cell-background-selected", scopeClass: "REF", evidence: ref(2) },
  { id: "selection.segmentedControlChecked", category: "selection", key: "segmentedControlChecked", kind: "color", token: "--local-orb-segmented-control-fill-color-checked-base", scopeClass: "REF", evidence: ref(2) },
]

/** Plan §5.12 — statuses (17). */
const STATUS: readonly SemanticSlotSpec[] = [
  { id: "status.dangerText", category: "status", key: "dangerText", kind: "color", token: "--orb-text-feedback-danger", scopeClass: "R", evidence: def(20, 5) },
  { id: "status.dangerSurface", category: "status", key: "dangerSurface", kind: "color", token: "--orb-surface-feedback-danger", scopeClass: "R", evidence: def(20, 5) },
  { id: "status.dangerSurfaceHovered", category: "status", key: "dangerSurfaceHovered", kind: "color", token: "--orb-surface-feedback-danger-hovered", scopeClass: "R", evidence: def(20, 5) },
  { id: "status.dangerSurfacePressed", category: "status", key: "dangerSurfacePressed", kind: "color", token: "--orb-surface-feedback-danger-pressed", scopeClass: "R", evidence: def(20, 5) },
  { id: "status.dangerSurfaceLight", category: "status", key: "dangerSurfaceLight", kind: "color", token: "--orb-surface-feedback-danger-light", scopeClass: "R", evidence: def(20, 5) },
  { id: "status.dangerSurfaceLightHovered", category: "status", key: "dangerSurfaceLightHovered", kind: "color", token: "--orb-surface-feedback-danger-light-hovered", scopeClass: "R", evidence: def(20, 5) },
  { id: "status.dangerSurfaceLightPressed", category: "status", key: "dangerSurfaceLightPressed", kind: "color", token: "--orb-surface-feedback-danger-light-pressed", scopeClass: "R", evidence: def(20, 5) },
  { id: "status.warningText", category: "status", key: "warningText", kind: "color", token: "--orb-text-feedback-warning", scopeClass: "R", evidence: def(20, 5) },
  { id: "status.warningSurface", category: "status", key: "warningSurface", kind: "color", token: "--orb-surface-feedback-warning", scopeClass: "R", evidence: def(20, 5) },
  { id: "status.warningSurfaceLight", category: "status", key: "warningSurfaceLight", kind: "color", token: "--orb-surface-feedback-warning-light", scopeClass: "R", evidence: def(20, 5) },
  { id: "status.successText", category: "status", key: "successText", kind: "color", token: "--orb-text-feedback-success", scopeClass: "R", evidence: def(20, 5) },
  { id: "status.successSurface", category: "status", key: "successSurface", kind: "color", token: "--orb-surface-feedback-success", scopeClass: "R", evidence: def(20, 5) },
  { id: "status.successSurfaceLight", category: "status", key: "successSurfaceLight", kind: "color", token: "--orb-surface-feedback-success-light", scopeClass: "R", evidence: def(20, 5) },
  { id: "status.infoText", category: "status", key: "infoText", kind: "color", token: "--orb-text-feedback-info", scopeClass: "R", evidence: def(20, 5) },
  { id: "status.infoSurface", category: "status", key: "infoSurface", kind: "color", token: "--orb-surface-feedback-info", scopeClass: "R", evidence: def(20, 5) },
  { id: "status.infoSurfaceLight", category: "status", key: "infoSurfaceLight", kind: "color", token: "--orb-surface-feedback-info-light", scopeClass: "R", evidence: def(20, 5) },
  { id: "status.neutralText", category: "status", key: "neutralText", kind: "color", token: "--orb-text-feedback-neutral", scopeClass: "R", evidence: def(20, 5) },
]

/** Plan §5.13 — shadows (14). Three `raw` slots (stock value `none` is not colorish). */
const SHADOW: readonly SemanticSlotSpec[] = [
  { id: "shadow.color", category: "shadow", key: "color", kind: "color", token: "--orb-misc-shadow", scopeClass: "R", evidence: def(20, 5) },
  { id: "shadow.brand", category: "shadow", key: "brand", kind: "color", token: "--orb-shadow-brand", scopeClass: "RBC", evidence: def(40, 11) },
  { id: "shadow.popup", category: "shadow", key: "popup", kind: "shadow", token: "--ui-popup-shadow", scopeClass: "RC", evidence: def(20, 5) },
  { id: "shadow.focusInset", category: "shadow", key: "focusInset", kind: "shadow", token: "--ui-focus-shadow", scopeClass: "RC", evidence: def(20, 5) },
  { id: "shadow.focusPrimary", category: "shadow", key: "focusPrimary", kind: "shadow", token: "--ui-focus-shadow-primary", scopeClass: "RC", evidence: def(20, 5) },
  { id: "shadow.card", category: "shadow", key: "card", kind: "shadow", token: "--ui-card-box-shadow", scopeClass: "RC", evidence: def(22, 7) },
  { id: "shadow.cardHover", category: "shadow", key: "cardHover", kind: "shadow", token: "--ui-card-box-shadow-hover", scopeClass: "RC", evidence: def(22, 7) },
  { id: "shadow.cardNeutral", category: "shadow", key: "cardNeutral", kind: "shadow", token: "--ui-card-neutral-box-shadow", scopeClass: "RC", evidence: raw(20) },
  { id: "shadow.cardNeutralHover", category: "shadow", key: "cardNeutralHover", kind: "shadow", token: "--ui-card-neutral-box-shadow-hover", scopeClass: "RC", evidence: raw(20) },
  { id: "shadow.cardContrast", category: "shadow", key: "cardContrast", kind: "shadow", token: "--ui-card-contrast-box-shadow", scopeClass: "RC", evidence: def(33, 5) },
  { id: "shadow.cardContrastHover", category: "shadow", key: "cardContrastHover", kind: "shadow", token: "--ui-card-contrast-box-shadow-hover", scopeClass: "RC", evidence: def(20, 5) },
  { id: "shadow.modal", category: "shadow", key: "modal", kind: "shadow", token: "--component-modal-box-shadow", scopeClass: "RC", evidence: raw(20) },
  { id: "shadow.reactionsPicker", category: "shadow", key: "reactionsPicker", kind: "shadow", token: "--component-reactions-picker-shadow", scopeClass: "RC", evidence: def(20, 5) },
  { id: "shadow.joinCallBanner", category: "shadow", key: "joinCallBanner", kind: "shadow", token: "--component-telemost-action-banner-join-call-box-shadow", scopeClass: "RC", evidence: def(20, 5) },
]

/** Plan §5.14 — gradients (2). Full-value slots: a gradient cannot be recolored stop by stop. */
const GRADIENT: readonly SemanticSlotSpec[] = [
  { id: "gradient.messageSkeleton", category: "gradient", key: "messageSkeleton", kind: "gradient", token: "--component-message-balloon-skeleton-gradient", scopeClass: "RC", evidence: def(34, 6) },
  { id: "gradient.diskLoading", category: "gradient", key: "diskLoading", kind: "gradient", token: "--component-disk-available-space-indicator-loading", scopeClass: "RC", evidence: def(20, 5) },
]

/** All 124 slots, in plan §5 table order. */
export const SEMANTIC_SLOT_SPECS: readonly SemanticSlotSpec[] = [
  ...PAGE, ...SURFACE, ...ELEVATION, ...MODAL, ...OVERLAY, ...LINE, ...FOCUS,
  ...TEXT, ...ICON, ...CONTROL, ...STATE, ...SELECTION, ...STATUS, ...SHADOW, ...GRADIENT,
]

/** Plan §3 category order (drives deterministic emission order, §12). */
export const EXPECTED_SEMANTIC_CATEGORIES: readonly string[] = [
  "page", "surface", "elevation", "modal", "overlay", "line", "focus", "text",
  "icon", "control", "state", "selection", "status", "shadow", "gradient",
]

/** Exact config key sets per category (the 15 strict objects of plan §3). */
export const EXPECTED_CATEGORY_KEYS: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  EXPECTED_SEMANTIC_CATEGORIES.map((category) => [
    category,
    SEMANTIC_SLOT_SPECS.filter((s) => s.category === category).map((s) => s.key),
  ]),
)

/* ------------------------------------------------------------------ *
 * Plan §9 scope matrix — exact emission selector lists.
 * ------------------------------------------------------------------ */

export const BRAND_COMPOUNDS = ["yamb-modal", "ui-popup", "Orb-Popover2"] as const
export const MERGE_NOTICE_COMPOUNDS = ["yamb-desktop-merge-notice-banner", "yamb-merge-notice__content"] as const

const THEME_CLASS = { light: "Orb-Theme_theme_light", dark: "Orb-Theme_theme_dark" } as const

export type ThemeMode = "light" | "dark"

/** The five verified declaration forms per component compound (plan §0/§9). */
export function componentScopeSelectors(mode: ThemeMode, compound: string): string[] {
  const theme = THEME_CLASS[mode]
  return [
    `.${compound}.${theme}`,
    `.${compound}.${theme}.brand_telemost`,
    `.${compound}.${theme}.Orb-Brand_brand_telemost`,
    `.brand_telemost .${compound}.${theme}`,
    `.Orb-Brand_brand_telemost .${compound}.${theme}`,
  ]
}

/**
 * Section 9 emission scope sets, selector lists exactly as emitted.
 * `SEMANTIC_SCOPE_BLOCKS` in the registry must deep-equal this per mode.
 */
export const SCOPE_SELECTORS: Readonly<Record<ScopeClass, Record<ThemeMode, readonly string[]>>> = {
  R: {
    light: [":root"],
    dark: [".theme_dark:root"],
  },
  RB: {
    light: [":root", ":root.brand_telemost", ":root.Orb-Brand_brand_telemost"],
    dark: [".theme_dark:root", ".theme_dark:root.brand_telemost", ".theme_dark:root.Orb-Brand_brand_telemost"],
  },
  RC: {
    light: [":root", ...BRAND_COMPOUNDS.flatMap((c) => componentScopeSelectors("light", c))],
    dark: [".theme_dark:root", ...BRAND_COMPOUNDS.flatMap((c) => componentScopeSelectors("dark", c))],
  },
  RBC: {
    light: [
      ":root", ":root.brand_telemost", ":root.Orb-Brand_brand_telemost",
      ...BRAND_COMPOUNDS.flatMap((c) => componentScopeSelectors("light", c)),
    ],
    dark: [
      ".theme_dark:root", ".theme_dark:root.brand_telemost", ".theme_dark:root.Orb-Brand_brand_telemost",
      ...BRAND_COMPOUNDS.flatMap((c) => componentScopeSelectors("dark", c)),
    ],
  },
  MN: {
    light: MERGE_NOTICE_COMPOUNDS.map((c) => `.${c}.Orb-Theme_theme_light`),
    dark: MERGE_NOTICE_COMPOUNDS.map((c) => `.${c}.Orb-Theme_theme_dark`),
  },
  REF: {
    light: [":root"],
    dark: [".theme_dark:root"],
  },
}

/* ------------------------------------------------------------------ *
 * Value builders — unique, per-slot, per-mode, contract-valid values.
 * ------------------------------------------------------------------ */

const hex6 = (n: number): string => `#${n.toString(16).padStart(6, "0")}`

/** A unique, schema-valid value for the slot at `index` in `mode`. */
export function specValue(spec: SemanticSlotSpec, index: number, mode: ThemeMode): string {
  const offset = mode === "light" ? 0 : 1000
  const a = hex6(index + 1 + offset)
  const b = hex6(index + 401 + offset)
  switch (spec.kind) {
    case "color":
      return a
    case "shadow":
      return `0 0 4px ${a}`
    case "gradient":
      return `linear-gradient(90deg,${a},${b})`
  }
}

/**
 * Builds a full `semantic` config object for the given assignments.
 * `assignments` maps slot id → { light?, dark? } values (already valid strings).
 */
export function buildSemanticConfig(
  assignments: Readonly<Record<string, { light?: string; dark?: string }>>,
): Record<string, Record<string, Record<string, string>>> {
  const config: Record<string, Record<string, Record<string, string>>> = {}
  for (const spec of SEMANTIC_SLOT_SPECS) {
    const values = assignments[spec.id]
    if (!values) continue
    for (const mode of ["light", "dark"] as const) {
      const value = values[mode]
      if (value === undefined) continue
      config[mode] ??= {}
      config[mode][spec.category] ??= {}
      config[mode][spec.category][spec.key] = value
    }
  }
  return config
}
