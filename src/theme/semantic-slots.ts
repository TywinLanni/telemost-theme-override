/**
 * Semantic slot registry — the code-owned contract data for semantic color
 * configuration (bead tto-6ia.2).
 *
 * Specification: `.beads/artifacts/tto-6ia.2/plan.md` §5 (slot registry),
 * §9 (scope matrix), §10 (rule bindings), §11 (allowlists).
 *
 * This is a data + lookup module only. Nothing here emits CSS; the emitter
 * (tto-6ia.4) consumes `resolveSemanticTargets` / `SEMANTIC_SCOPE_BLOCKS`,
 * and the loader (`src/config.ts`) consumes the rule-target allowlist and
 * the kind/property matrix.
 *
 * Every entry was transcribed from plan §5 and cross-checked against
 * `reports/telemost_ui_color_inventory.json` (`telemost-ui-color-inventory/1`)
 * and the pinned stylesheet
 * `research_notes/Полная перекраска интерфейса Телемоста/evidence/telemost_ui.css`
 * (sha256 7ee580fd…). Totals: 124 slots, 124 distinct token targets
 * (118 `def`, 4 `raw`, 2 `ref` evidence entries).
 *
 * Legend (plan §5):
 * - scopeClass: `R` root scopes; `RB` root+brand; `RC` root+component;
 *   `RBC` root+brand+component; `MN` merge-notice compounds; `REF` reference-only
 * - evidence: `def(n;cM)` — n inventory definition occurrences across M component
 *   scope groups; `raw(n)` — n definitions verified in raw CSS, skipped by the
 *   inventory heuristic because the stock value is not color-bearing;
 *   `ref(c)` — reference-only, c var() consumers, 0 definitions
 * - overrideMethod: `TR` token-redefinition; `FVR` full-value-replacement;
 *   `TAR` targeted-rule (rule bindings only)
 */

import type { SemanticCategory, SemanticSlots } from "../schema"

export type SemanticSlotKind = "color" | "shadow" | "gradient"

/** Plan §5 legend: R root; RB root+brand; RC root+component; RBC union; MN merge-notice; REF reference-only. */
export type ScopeClass = "R" | "RB" | "RC" | "RBC" | "MN" | "REF"

export type ThemeMode = "light" | "dark"
/** Rule-binding mode: a theme class derived from the selector, or `static` for theme-neutral selectors. */
export type RuleMode = ThemeMode | "static"

/** Plan §5 legend override methods. Every v1 registry slot is a token redefinition (`TR`). */
export type OverrideMethod = "TR" | "FVR" | "TAR"

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

export interface SemanticSlotEntry {
  /** Slot id — `category.key` (plan §3 `slotIdSchema`). */
  readonly id: string
  /** theme.json nesting: `semantic.<category>.<key>` */
  readonly category: SemanticCategory
  readonly key: string
  readonly kind: SemanticSlotKind
  /** Registry-owned default token target (plan §5, ADR-2b: not config-reachable). */
  readonly token: string
  readonly scopeClass: ScopeClass
  readonly evidence: SlotEvidence
  readonly overrideMethod: OverrideMethod
}

/** One verified rule target: a byte-exact `(selector, property)` pair and the theme mode its selector carries. */
export interface VerifiedRuleTarget {
  readonly selector: string
  readonly property: string
  readonly mode: RuleMode
}

const def = (definitions: number, scopeGroups: number): SlotEvidence => ({ source: "def", definitions, scopeGroups })
const raw = (definitions: number): SlotEvidence => ({ source: "raw", definitions })
const ref = (consumers: number): SlotEvidence => ({ source: "ref", consumers })

/**
 * All 124 slots, in plan §5 table order.
 *
 * The four `border.*` ids are registered under the `line` category because
 * `SEMANTIC_CATEGORIES` (plan §3) has no `border` category:
 * `border.compose` ≙ `semantic.line.compose` in theme.json.
 */
const SLOT_ENTRIES: readonly SemanticSlotEntry[] = [
  { id: "page.background", category: "page", key: "background", kind: "color", token: "--common-bg", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "page.backgroundSecondary", category: "page", key: "backgroundSecondary", kind: "color", token: "--common-bg-secondary", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "page.settingsBackground", category: "page", key: "settingsBackground", kind: "color", token: "--common-settings-bg", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "page.actionbar", category: "page", key: "actionbar", kind: "color", token: "--common-actionbar", scopeClass: "RC", evidence: raw(20), overrideMethod: "TR" },
  { id: "page.surface", category: "page", key: "surface", kind: "color", token: "--common-surface-bg", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "page.poll", category: "page", key: "poll", kind: "color", token: "--common-poll-bg", scopeClass: "RC", evidence: def(21, 6), overrideMethod: "TR" },
  { id: "page.conversation", category: "page", key: "conversation", kind: "color", token: "--conversation-bg", scopeClass: "RC", evidence: def(21, 6), overrideMethod: "TR" },
  { id: "surface.generic", category: "surface", key: "generic", kind: "color", token: "--orb-surface-generic", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "surface.genericHovered", category: "surface", key: "genericHovered", kind: "color", token: "--orb-surface-generic-hovered", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "surface.genericPressed", category: "surface", key: "genericPressed", kind: "color", token: "--orb-surface-generic-pressed", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "surface.genericMedium", category: "surface", key: "genericMedium", kind: "color", token: "--orb-surface-generic-medium", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "surface.genericMediumHovered", category: "surface", key: "genericMediumHovered", kind: "color", token: "--orb-surface-generic-medium-hovered", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "surface.genericMediumPressed", category: "surface", key: "genericMediumPressed", kind: "color", token: "--orb-surface-generic-medium-pressed", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "surface.genericAlt", category: "surface", key: "genericAlt", kind: "color", token: "--orb-surface-generic-alt", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "surface.disabled", category: "surface", key: "disabled", kind: "color", token: "--orb-surface-disabled", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "surface.inverse", category: "surface", key: "inverse", kind: "color", token: "--orb-surface-inverse", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "surface.inverseHovered", category: "surface", key: "inverseHovered", kind: "color", token: "--orb-surface-inverse-hovered", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "surface.inversePressed", category: "surface", key: "inversePressed", kind: "color", token: "--orb-surface-inverse-pressed", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "surface.staticLight", category: "surface", key: "staticLight", kind: "color", token: "--orb-surface-static-light", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "surface.staticHeavy", category: "surface", key: "staticHeavy", kind: "color", token: "--orb-surface-static-heavy", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "elevation.base", category: "elevation", key: "base", kind: "color", token: "--orb-elevation-base", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "elevation.risen", category: "elevation", key: "risen", kind: "color", token: "--orb-elevation-risen", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "elevation.sunken", category: "elevation", key: "sunken", kind: "color", token: "--orb-elevation-sunken", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "elevation.overlay", category: "elevation", key: "overlay", kind: "color", token: "--orb-elevation-overlay", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "elevation.overlayModal", category: "elevation", key: "overlayModal", kind: "color", token: "--orb-elevation-overlay-modal", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "elevation.sidebar", category: "elevation", key: "sidebar", kind: "color", token: "--orb-elevation-base-sidebar", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "modal.popup", category: "modal", key: "popup", kind: "color", token: "--ui-popup-bg", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "modal.card", category: "modal", key: "card", kind: "color", token: "--ui-card-neutral-bg", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "modal.cardContrast", category: "modal", key: "cardContrast", kind: "color", token: "--ui-card-contrast-bg", scopeClass: "RC", evidence: def(33, 5), overrideMethod: "TR" },
  { id: "overlay.scrim", category: "overlay", key: "scrim", kind: "color", token: "--common-overlay-bg", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "overlay.backdrop", category: "overlay", key: "backdrop", kind: "color", token: "--overlay-shadow-color", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "overlay.background", category: "overlay", key: "background", kind: "color", token: "--overlay-background-color", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "overlay.textPrimary", category: "overlay", key: "textPrimary", kind: "color", token: "--overlay-primary-color", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "overlay.textSecondary", category: "overlay", key: "textSecondary", kind: "color", token: "--overlay-secondary-color", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "line.generic", category: "line", key: "generic", kind: "color", token: "--orb-line-generic", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "line.genericLight", category: "line", key: "genericLight", kind: "color", token: "--orb-line-generic-light", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "line.genericMedium", category: "line", key: "genericMedium", kind: "color", token: "--orb-line-generic-medium", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "line.genericHeavy", category: "line", key: "genericHeavy", kind: "color", token: "--orb-line-generic-heavy", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "line.divider", category: "line", key: "divider", kind: "color", token: "--common-divider", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "line.darkmode", category: "line", key: "darkmode", kind: "color", token: "--orb-misc-line-darkmode", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "border.compose", category: "line", key: "compose", kind: "color", token: "--ui-compose-border-color", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "border.mainBanner", category: "line", key: "mainBanner", kind: "color", token: "--main-banner-border-color", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "border.codeBlock", category: "line", key: "codeBlock", kind: "color", token: "--component-code-block-border-color", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "border.joinCallBanner", category: "line", key: "joinCallBanner", kind: "color", token: "--component-telemost-action-banner-join-call-border-color", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "line.codeIncomingDivider", category: "line", key: "codeIncomingDivider", kind: "color", token: "--component-code-incoming-divider-color", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "line.codeOutgoingDivider", category: "line", key: "codeOutgoingDivider", kind: "color", token: "--component-code-outgoing-divider-color", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "focus.color", category: "focus", key: "color", kind: "color", token: "--ui-focus-color", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "focus.cardOutline", category: "focus", key: "cardOutline", kind: "color", token: "--ui-card-focus-outline-color", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "text.primary", category: "text", key: "primary", kind: "color", token: "--orb-text-primary", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "text.secondary", category: "text", key: "secondary", kind: "color", token: "--orb-text-secondary", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "text.tertiary", category: "text", key: "tertiary", kind: "color", token: "--orb-text-tertiary", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "text.disabled", category: "text", key: "disabled", kind: "color", token: "--orb-text-disabled", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "text.inverse", category: "text", key: "inverse", kind: "color", token: "--orb-text-inverse", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "text.link", category: "text", key: "link", kind: "color", token: "--orb-text-link", scopeClass: "RBC", evidence: def(40, 11), overrideMethod: "TR" },
  { id: "text.linkHovered", category: "text", key: "linkHovered", kind: "color", token: "--orb-text-link-hovered", scopeClass: "RBC", evidence: def(40, 11), overrideMethod: "TR" },
  { id: "text.staticLight", category: "text", key: "staticLight", kind: "color", token: "--orb-text-static-light", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "text.staticHeavy", category: "text", key: "staticHeavy", kind: "color", token: "--orb-text-static-heavy", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "icon.primary", category: "icon", key: "primary", kind: "color", token: "--common-icons-primary", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "icon.secondary", category: "icon", key: "secondary", kind: "color", token: "--common-icons-secondary", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "control.brandSurface", category: "control", key: "brandSurface", kind: "color", token: "--orb-surface-brand", scopeClass: "RBC", evidence: def(42, 13), overrideMethod: "TR" },
  { id: "control.brandSurfaceHovered", category: "control", key: "brandSurfaceHovered", kind: "color", token: "--orb-surface-brand-hovered", scopeClass: "RBC", evidence: def(42, 13), overrideMethod: "TR" },
  { id: "control.brandSurfacePressed", category: "control", key: "brandSurfacePressed", kind: "color", token: "--orb-surface-brand-pressed", scopeClass: "RBC", evidence: def(42, 13), overrideMethod: "TR" },
  { id: "control.brandSurfaceLight", category: "control", key: "brandSurfaceLight", kind: "color", token: "--orb-surface-brand-light", scopeClass: "RBC", evidence: def(40, 11), overrideMethod: "TR" },
  { id: "control.brandSurfaceLightHovered", category: "control", key: "brandSurfaceLightHovered", kind: "color", token: "--orb-surface-brand-light-hovered", scopeClass: "RBC", evidence: def(40, 11), overrideMethod: "TR" },
  { id: "control.brandSurfaceLightPressed", category: "control", key: "brandSurfaceLightPressed", kind: "color", token: "--orb-surface-brand-light-pressed", scopeClass: "RBC", evidence: def(40, 11), overrideMethod: "TR" },
  { id: "control.buttonBrand", category: "control", key: "buttonBrand", kind: "color", token: "--orb-button-brand-background", scopeClass: "MN", evidence: def(4, 2), overrideMethod: "TR" },
  { id: "control.buttonBrandHover", category: "control", key: "buttonBrandHover", kind: "color", token: "--orb-button-brand-background-hover", scopeClass: "MN", evidence: def(4, 2), overrideMethod: "TR" },
  { id: "control.buttonBrandActive", category: "control", key: "buttonBrandActive", kind: "color", token: "--orb-button-brand-background-active", scopeClass: "MN", evidence: def(4, 2), overrideMethod: "TR" },
  { id: "control.buttonBrandText", category: "control", key: "buttonBrandText", kind: "color", token: "--orb-button-brand-text", scopeClass: "MN", evidence: def(4, 2), overrideMethod: "TR" },
  { id: "control.iconButtonPrimary", category: "control", key: "iconButtonPrimary", kind: "color", token: "--ui-icon-button-primary", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "control.iconButtonPrimaryHoverBg", category: "control", key: "iconButtonPrimaryHoverBg", kind: "color", token: "--ui-icon-button-primary-hover-bg", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "control.iconButtonAccent", category: "control", key: "iconButtonAccent", kind: "color", token: "--ui-icon-button-accent", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "control.iconButtonAccentHover", category: "control", key: "iconButtonAccentHover", kind: "color", token: "--ui-icon-button-accent-hover", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "control.iconButtonAccentPressed", category: "control", key: "iconButtonAccentPressed", kind: "color", token: "--ui-icon-button-accent-pressed", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "control.iconButtonAccentText", category: "control", key: "iconButtonAccentText", kind: "color", token: "--ui-icon-button-accent-text", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "control.messageButtonBackground", category: "control", key: "messageButtonBackground", kind: "color", token: "--component-message-button-background-color", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "control.messageButtonBackgroundHovered", category: "control", key: "messageButtonBackgroundHovered", kind: "color", token: "--component-message-button-background-color-hovered", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "control.messageButtonText", category: "control", key: "messageButtonText", kind: "color", token: "--component-message-button-text-color", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "control.sendButtonDestructive", category: "control", key: "sendButtonDestructive", kind: "color", token: "--ui-send-message-button-destructive-bg", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "state.cardHover", category: "state", key: "cardHover", kind: "color", token: "--ui-card-bg-hover", scopeClass: "RC", evidence: def(22, 7), overrideMethod: "TR" },
  { id: "state.cardActive", category: "state", key: "cardActive", kind: "color", token: "--ui-card-bg-active", scopeClass: "RC", evidence: def(22, 7), overrideMethod: "TR" },
  { id: "state.cardDisabled", category: "state", key: "cardDisabled", kind: "color", token: "--ui-card-bg-disabled", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "state.cardNeutralHover", category: "state", key: "cardNeutralHover", kind: "color", token: "--ui-card-neutral-bg-hover", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "state.cardNeutralActive", category: "state", key: "cardNeutralActive", kind: "color", token: "--ui-card-neutral-bg-active", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "state.cardContrastHover", category: "state", key: "cardContrastHover", kind: "color", token: "--ui-card-contrast-bg-hover", scopeClass: "RC", evidence: def(33, 5), overrideMethod: "TR" },
  { id: "state.cardContrastActive", category: "state", key: "cardContrastActive", kind: "color", token: "--ui-card-contrast-bg-active", scopeClass: "RC", evidence: def(33, 5), overrideMethod: "TR" },
  { id: "state.listItemActive", category: "state", key: "listItemActive", kind: "color", token: "--ui-list-item-active-background-color", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "selection.messageRow", category: "selection", key: "messageRow", kind: "color", token: "--component-message-row-selected-background", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "selection.reaction", category: "selection", key: "reaction", kind: "color", token: "--components-reaction-bg", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "selection.calendarCell", category: "selection", key: "calendarCell", kind: "color", token: "--orb-calendar-cell-background-selected", scopeClass: "REF", evidence: ref(2), overrideMethod: "TR" },
  { id: "selection.segmentedControlChecked", category: "selection", key: "segmentedControlChecked", kind: "color", token: "--local-orb-segmented-control-fill-color-checked-base", scopeClass: "REF", evidence: ref(2), overrideMethod: "TR" },
  { id: "status.dangerText", category: "status", key: "dangerText", kind: "color", token: "--orb-text-feedback-danger", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "status.dangerSurface", category: "status", key: "dangerSurface", kind: "color", token: "--orb-surface-feedback-danger", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "status.dangerSurfaceHovered", category: "status", key: "dangerSurfaceHovered", kind: "color", token: "--orb-surface-feedback-danger-hovered", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "status.dangerSurfacePressed", category: "status", key: "dangerSurfacePressed", kind: "color", token: "--orb-surface-feedback-danger-pressed", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "status.dangerSurfaceLight", category: "status", key: "dangerSurfaceLight", kind: "color", token: "--orb-surface-feedback-danger-light", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "status.dangerSurfaceLightHovered", category: "status", key: "dangerSurfaceLightHovered", kind: "color", token: "--orb-surface-feedback-danger-light-hovered", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "status.dangerSurfaceLightPressed", category: "status", key: "dangerSurfaceLightPressed", kind: "color", token: "--orb-surface-feedback-danger-light-pressed", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "status.warningText", category: "status", key: "warningText", kind: "color", token: "--orb-text-feedback-warning", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "status.warningSurface", category: "status", key: "warningSurface", kind: "color", token: "--orb-surface-feedback-warning", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "status.warningSurfaceLight", category: "status", key: "warningSurfaceLight", kind: "color", token: "--orb-surface-feedback-warning-light", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "status.successText", category: "status", key: "successText", kind: "color", token: "--orb-text-feedback-success", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "status.successSurface", category: "status", key: "successSurface", kind: "color", token: "--orb-surface-feedback-success", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "status.successSurfaceLight", category: "status", key: "successSurfaceLight", kind: "color", token: "--orb-surface-feedback-success-light", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "status.infoText", category: "status", key: "infoText", kind: "color", token: "--orb-text-feedback-info", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "status.infoSurface", category: "status", key: "infoSurface", kind: "color", token: "--orb-surface-feedback-info", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "status.infoSurfaceLight", category: "status", key: "infoSurfaceLight", kind: "color", token: "--orb-surface-feedback-info-light", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "status.neutralText", category: "status", key: "neutralText", kind: "color", token: "--orb-text-feedback-neutral", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "shadow.color", category: "shadow", key: "color", kind: "color", token: "--orb-misc-shadow", scopeClass: "R", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "shadow.brand", category: "shadow", key: "brand", kind: "color", token: "--orb-shadow-brand", scopeClass: "RBC", evidence: def(40, 11), overrideMethod: "TR" },
  { id: "shadow.popup", category: "shadow", key: "popup", kind: "shadow", token: "--ui-popup-shadow", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "shadow.focusInset", category: "shadow", key: "focusInset", kind: "shadow", token: "--ui-focus-shadow", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "shadow.focusPrimary", category: "shadow", key: "focusPrimary", kind: "shadow", token: "--ui-focus-shadow-primary", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "shadow.card", category: "shadow", key: "card", kind: "shadow", token: "--ui-card-box-shadow", scopeClass: "RC", evidence: def(22, 7), overrideMethod: "TR" },
  { id: "shadow.cardHover", category: "shadow", key: "cardHover", kind: "shadow", token: "--ui-card-box-shadow-hover", scopeClass: "RC", evidence: def(22, 7), overrideMethod: "TR" },
  { id: "shadow.cardNeutral", category: "shadow", key: "cardNeutral", kind: "shadow", token: "--ui-card-neutral-box-shadow", scopeClass: "RC", evidence: raw(20), overrideMethod: "TR" },
  { id: "shadow.cardNeutralHover", category: "shadow", key: "cardNeutralHover", kind: "shadow", token: "--ui-card-neutral-box-shadow-hover", scopeClass: "RC", evidence: raw(20), overrideMethod: "TR" },
  { id: "shadow.cardContrast", category: "shadow", key: "cardContrast", kind: "shadow", token: "--ui-card-contrast-box-shadow", scopeClass: "RC", evidence: def(33, 5), overrideMethod: "TR" },
  { id: "shadow.cardContrastHover", category: "shadow", key: "cardContrastHover", kind: "shadow", token: "--ui-card-contrast-box-shadow-hover", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "shadow.modal", category: "shadow", key: "modal", kind: "shadow", token: "--component-modal-box-shadow", scopeClass: "RC", evidence: raw(20), overrideMethod: "TR" },
  { id: "shadow.reactionsPicker", category: "shadow", key: "reactionsPicker", kind: "shadow", token: "--component-reactions-picker-shadow", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "shadow.joinCallBanner", category: "shadow", key: "joinCallBanner", kind: "shadow", token: "--component-telemost-action-banner-join-call-box-shadow", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
  { id: "gradient.messageSkeleton", category: "gradient", key: "messageSkeleton", kind: "gradient", token: "--component-message-balloon-skeleton-gradient", scopeClass: "RC", evidence: def(34, 6), overrideMethod: "TR" },
  { id: "gradient.diskLoading", category: "gradient", key: "diskLoading", kind: "gradient", token: "--component-disk-available-space-indicator-loading", scopeClass: "RC", evidence: def(20, 5), overrideMethod: "TR" },
]

/** Slot id → entry. Insertion order is the plan §5 table order. */
export const SEMANTIC_SLOT_REGISTRY: ReadonlyMap<string, SemanticSlotEntry> = new Map(
  SLOT_ENTRIES.map((entry) => [entry.id, entry]),
)

/** Token target → entry. The 124 targets are distinct, so this is a 1:1 index. */
export const SEMANTIC_SLOT_BY_TOKEN: ReadonlyMap<string, SemanticSlotEntry> = new Map(
  SLOT_ENTRIES.map((entry) => [entry.token, entry]),
)

/* ------------------------------------------------------------------ *
 * Plan §9 scope matrix — exact emission selector lists.
 * ------------------------------------------------------------------ */

const BRAND_COMPOUNDS = ["yamb-modal", "ui-popup", "Orb-Popover2"] as const
const MERGE_NOTICE_COMPOUNDS = ["yamb-desktop-merge-notice-banner", "yamb-merge-notice__content"] as const

const THEME_CLASS: Record<ThemeMode, string> = { light: "Orb-Theme_theme_light", dark: "Orb-Theme_theme_dark" }

/**
 * The five verified declaration forms per component compound (plan §0/§9).
 * The suffixed and descendant forms have higher specificity (0,3,0) than the
 * plain form (0,2,0) and are present in the pinned file for every
 * component-declared registry token; partial emission would lose inside
 * brand-tinted modals.
 */
function componentScopeSelectors(mode: ThemeMode, compound: string): string[] {
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
 * A block is skipped when empty; forms are exact and were enumerated from the
 * pinned file. `REF` rides the root scopes only (nothing to fight), and `MN`
 * uses the two merge-notice compounds in plain form only (no brand variants
 * exist in the pinned file).
 */
export const SEMANTIC_SCOPE_BLOCKS: Readonly<Record<ScopeClass, Readonly<Record<ThemeMode, readonly string[]>>>> = {
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
 * Plan §8 theme_auto scopes.
 * ------------------------------------------------------------------ */

/**
 * The two theme_auto scope sets (plan §8). Under `theme_auto` the `<html>`
 * element keeps no `theme_dark` class, so the dark media block re-declares
 * root-level values on these auto scopes. Light needs no media block: plain
 * `:root` declarations already match a `theme_auto` document.
 */
export const SEMANTIC_AUTO_SCOPES: Readonly<Record<"root" | "brand", readonly string[]>> = {
  root: [":root.theme_auto"],
  brand: [":root.theme_auto", ":root.theme_auto.brand_telemost", ":root.theme_auto.Orb-Brand_brand_telemost"],
}

/**
 * Which scope classes each theme_auto group serves (plan §8): the root group
 * carries the R and REF values (both declare on the plain root scopes, §9),
 * the brand group carries RB and RBC values. Component scopes — the RC
 * compounds and the MN merge-notice compounds — resolve their theme through
 * their own `Orb-Theme_*` classes, which the app applies even under
 * `theme_auto`, so they never enter the media block.
 */
export const SEMANTIC_AUTO_SCOPE_GROUPS: Readonly<Record<"root" | "brand", readonly ScopeClass[]>> = {
  root: ["R", "REF"],
  brand: ["RB", "RBC"],
}

/* ------------------------------------------------------------------ *
 * Plan §10/§11 — verified rule-target allowlist.
 * ------------------------------------------------------------------ */

/**
 * `{ selector, property, mode }` triples where the inventory override is
 * `targeted-rule` (kind `literal-color`, 175 occurrences) or
 * `full-value-replacement` (14 occurrences). Compiled once from
 * `reports/telemost_ui_color_inventory.json`, sorted by (mode, selector,
 * property) for determinism. Selector strings must match byte for byte —
 * no user regex, no at-rules, no selector lists (plan §10).
 */
export const VERIFIED_RULE_TARGETS: readonly VerifiedRuleTarget[] = [
  { selector: ".desktop .ui-notificationbar_design_line .ui-notificationbar__button:hover", property: "background-color", mode: "static" },
  { selector: ".desktop .yamb-lightbox-action-panel .yamb-suggest-item:hover,.yamb-lightbox-action-panel .yamb-suggest-item:focus,.yamb-lightbox-action-panel .yamb-suggest-item_focused", property: "background-color", mode: "static" },
  { selector: ".div-button-element", property: "background", mode: "static" },
  { selector: ".div-card", property: "border", mode: "static" },
  { selector: ".div-container-block_frame_border", property: "border", mode: "static" },
  { selector: ".div-container-block_frame_shadow", property: "box-shadow", mode: "static" },
  { selector: ".div-container-block_placeholder", property: "background", mode: "static" },
  { selector: ".div-date-element .div-text-element.div-date-element__month", property: "color", mode: "static" },
  { selector: ".div-image-block__img", property: "background-color", mode: "static" },
  { selector: ".div-image-element_placeholder", property: "background-color", mode: "static" },
  { selector: ".div-separator-block__delimiter", property: "border-bottom", mode: "static" },
  { selector: ".div-separator-element", property: "border-bottom", mode: "static" },
  { selector: ".div-slider__arrow", property: "color", mode: "static" },
  { selector: ".div-slider__circle", property: "background", mode: "static" },
  { selector: ".div-slider__circle", property: "color", mode: "static" },
  { selector: ".div-tabs-block__tabs-list_hasDelimiter_1", property: "border-bottom", mode: "static" },
  { selector: ".div-tail-icon_arrow", property: "border", mode: "static" },
  { selector: ".div-text-element_style_button", property: "color", mode: "static" },
  { selector: ".div-text-element_style_card_header", property: "color", mode: "static" },
  { selector: ".div-text-element_style_numbers_l", property: "color", mode: "static" },
  { selector: ".div-text-element_style_numbers_m", property: "color", mode: "static" },
  { selector: ".div-text-element_style_numbers_s", property: "color", mode: "static" },
  { selector: ".div-text-element_style_numbers_xs", property: "color", mode: "static" },
  { selector: ".div-text-element_style_text_m_grey,.div-text-element_style_text_s_grey", property: "color", mode: "static" },
  { selector: ".div-text-element_style_text_m,.div-text-element_style_text_m_grey,.div-text-element_style_text_m_medium", property: "color", mode: "static" },
  { selector: ".div-text-element_style_text_s,.div-text-element_style_text_s_grey,.div-text-element_style_text_s_medium", property: "color", mode: "static" },
  { selector: ".div-text-element_style_text_xs", property: "color", mode: "static" },
  { selector: ".div-text-element_style_text_xxs", property: "color", mode: "static" },
  { selector: ".div-text-element_style_title_l", property: "color", mode: "static" },
  { selector: ".div-text-element_style_title_m", property: "color", mode: "static" },
  { selector: ".div-text-element_style_title_s", property: "color", mode: "static" },
  { selector: ".div-text-element_style_title_xs", property: "color", mode: "static" },
  { selector: ".div-traffic-element__score", property: "border", mode: "static" },
  { selector: ".div-traffic-element__score", property: "color", mode: "static" },
  { selector: ".div-traffic-element__text", property: "color", mode: "static" },
  { selector: ".Orb-CalendarCell", property: "border", mode: "static" },
  { selector: ".Orb-CalendarCell_selectedInRange", property: "background-color", mode: "static" },
  { selector: ".Orb-DatePicker-Preset", property: "background-color", mode: "static" },
  { selector: ".Orb-SegmentedControl2-Radio", property: "-webkit-tap-highlight-color", mode: "static" },
  { selector: ".Orb-TimePicker-OptionItem", property: "background", mode: "static" },
  { selector: ".theme_auto .hljs .hljs", property: "background", mode: "static" },
  { selector: ".theme_auto .hljs .hljs", property: "color", mode: "static" },
  { selector: ".theme_auto .hljs .hljs-addition,.theme_auto .hljs .hljs-attribute,.theme_auto .hljs .hljs-meta .hljs-string,.theme_auto .hljs .hljs-regexp,.theme_auto .hljs .hljs-string", property: "color", mode: "static" },
  { selector: ".theme_auto .hljs .hljs-attr,.theme_auto .hljs .hljs-number,.theme_auto .hljs .hljs-selector-attr,.theme_auto .hljs .hljs-selector-class,.theme_auto .hljs .hljs-selector-pseudo,.theme_auto .hljs .hljs-template-variable,.theme_auto .hljs .hljs-type,.theme_auto .hljs .hljs-variable", property: "color", mode: "static" },
  { selector: ".theme_auto .hljs .hljs-built_in,.theme_auto .hljs .hljs-class .hljs-title,.theme_auto .hljs .hljs-title.class_", property: "color", mode: "static" },
  { selector: ".theme_auto .hljs .hljs-bullet,.theme_auto .hljs .hljs-link,.theme_auto .hljs .hljs-meta,.theme_auto .hljs .hljs-selector-id,.theme_auto .hljs .hljs-symbol,.theme_auto .hljs .hljs-title", property: "color", mode: "static" },
  { selector: ".theme_auto .hljs .hljs-comment,.theme_auto .hljs .hljs-quote", property: "color", mode: "static" },
  { selector: ".theme_auto .hljs .hljs-deletion,.theme_auto .hljs .hljs-name,.theme_auto .hljs .hljs-section,.theme_auto .hljs .hljs-selector-tag,.theme_auto .hljs .hljs-subst", property: "color", mode: "static" },
  { selector: ".theme_auto .hljs .hljs-doctag,.theme_auto .hljs .hljs-formula,.theme_auto .hljs .hljs-keyword", property: "color", mode: "static" },
  { selector: ".theme_auto .hljs .hljs-literal", property: "color", mode: "static" },
  { selector: ".theme_dark .hljs .hljs", property: "background", mode: "static" },
  { selector: ".theme_dark .hljs .hljs", property: "color", mode: "static" },
  { selector: ".theme_dark .hljs .hljs-addition,.theme_dark .hljs .hljs-attribute,.theme_dark .hljs .hljs-meta .hljs-string,.theme_dark .hljs .hljs-regexp,.theme_dark .hljs .hljs-string", property: "color", mode: "static" },
  { selector: ".theme_dark .hljs .hljs-attr,.theme_dark .hljs .hljs-number,.theme_dark .hljs .hljs-selector-attr,.theme_dark .hljs .hljs-selector-class,.theme_dark .hljs .hljs-selector-pseudo,.theme_dark .hljs .hljs-template-variable,.theme_dark .hljs .hljs-type,.theme_dark .hljs .hljs-variable", property: "color", mode: "static" },
  { selector: ".theme_dark .hljs .hljs-built_in,.theme_dark .hljs .hljs-class .hljs-title,.theme_dark .hljs .hljs-title.class_", property: "color", mode: "static" },
  { selector: ".theme_dark .hljs .hljs-bullet,.theme_dark .hljs .hljs-link,.theme_dark .hljs .hljs-meta,.theme_dark .hljs .hljs-selector-id,.theme_dark .hljs .hljs-symbol,.theme_dark .hljs .hljs-title", property: "color", mode: "static" },
  { selector: ".theme_dark .hljs .hljs-comment,.theme_dark .hljs .hljs-quote", property: "color", mode: "static" },
  { selector: ".theme_dark .hljs .hljs-deletion,.theme_dark .hljs .hljs-name,.theme_dark .hljs .hljs-section,.theme_dark .hljs .hljs-selector-tag,.theme_dark .hljs .hljs-subst", property: "color", mode: "static" },
  { selector: ".theme_dark .hljs .hljs-doctag,.theme_dark .hljs .hljs-formula,.theme_dark .hljs .hljs-keyword", property: "color", mode: "static" },
  { selector: ".theme_dark .hljs .hljs-literal", property: "color", mode: "static" },
  { selector: ".theme_light .hljs .hljs", property: "background", mode: "static" },
  { selector: ".theme_light .hljs .hljs", property: "color", mode: "static" },
  { selector: ".theme_light .hljs .hljs-addition,.theme_light .hljs .hljs-attribute,.theme_light .hljs .hljs-meta .hljs-string,.theme_light .hljs .hljs-regexp,.theme_light .hljs .hljs-string", property: "color", mode: "static" },
  { selector: ".theme_light .hljs .hljs-attr,.theme_light .hljs .hljs-number,.theme_light .hljs .hljs-selector-attr,.theme_light .hljs .hljs-selector-class,.theme_light .hljs .hljs-selector-pseudo,.theme_light .hljs .hljs-template-variable,.theme_light .hljs .hljs-type,.theme_light .hljs .hljs-variable", property: "color", mode: "static" },
  { selector: ".theme_light .hljs .hljs-built_in,.theme_light .hljs .hljs-class .hljs-title,.theme_light .hljs .hljs-title.class_", property: "color", mode: "static" },
  { selector: ".theme_light .hljs .hljs-bullet,.theme_light .hljs .hljs-link,.theme_light .hljs .hljs-meta,.theme_light .hljs .hljs-selector-id,.theme_light .hljs .hljs-symbol,.theme_light .hljs .hljs-title", property: "color", mode: "static" },
  { selector: ".theme_light .hljs .hljs-comment,.theme_light .hljs .hljs-quote", property: "color", mode: "static" },
  { selector: ".theme_light .hljs .hljs-deletion,.theme_light .hljs .hljs-name,.theme_light .hljs .hljs-section,.theme_light .hljs .hljs-selector-tag,.theme_light .hljs .hljs-subst", property: "color", mode: "static" },
  { selector: ".theme_light .hljs .hljs-doctag,.theme_light .hljs .hljs-formula,.theme_light .hljs .hljs-keyword", property: "color", mode: "static" },
  { selector: ".theme_light .hljs .hljs-literal", property: "color", mode: "static" },
  { selector: ".ui-InfiniteList-Thumb", property: "background-color", mode: "static" },
  { selector: ".ui-InfiniteList-Track:before", property: "background-color", mode: "static" },
  { selector: ".ui-notificationbar__close", property: "color", mode: "static" },
  { selector: ".ui-notificationbar_design_line", property: "background", mode: "static" },
  { selector: ".ui-notificationbar_design_line", property: "border-bottom", mode: "static" },
  { selector: ".ui-notificationbar_design_line", property: "color", mode: "static" },
  { selector: ".ui-notificationbar_design_line .ui-notificationbar__button", property: "background-color", mode: "static" },
  { selector: ".ui-notificationbar_design_line .ui-notificationbar__button", property: "color", mode: "static" },
  { selector: ".ui-notificationbar_design_line .ui-notificationbar__button:active", property: "background-color", mode: "static" },
  { selector: ".ui-popup__content_borderless", property: "background", mode: "static" },
  { selector: ".ui-popup_type_dialog .ui-popup__content:not(.ui-popup__content_borderless),.ui-popup_type_sheet .ui-popup__content:not(.ui-popup__content_borderless)", property: "box-shadow", mode: "static" },
  { selector: ".ui-popup_type_dialog,.ui-popup_type_sheet", property: "background-color", mode: "static" },
  { selector: ".yamb-call-button_view_action", property: "background-color", mode: "static" },
  { selector: ".yamb-call-button_view_action", property: "border", mode: "static" },
  { selector: ".yamb-call-button_view_action", property: "color", mode: "static" },
  { selector: ".yamb-call-button_view_outline", property: "background-color", mode: "static" },
  { selector: ".yamb-chat-action__button", property: "border", mode: "static" },
  { selector: ".yamb-chat-bar_separator:before", property: "background-color", mode: "static" },
  { selector: ".yamb-chat-overlay:before", property: "background", mode: "static" },
  { selector: ".yamb-compose_transparent", property: "background", mode: "static" },
  { selector: ".yamb-compose_transparent", property: "border", mode: "static" },
  { selector: ".yamb-conferences-history-details-summary__content.yamb-meeting-summary-markdown", property: "background", mode: "static" },
  { selector: ".yamb-conferences-history-filter-controls__action-bar", property: "border-block-start-color", mode: "static" },
  { selector: ".yamb-conversation_transparent", property: "background-color", mode: "static" },
  { selector: ".yamb-conversation_transparent", property: "border-color", mode: "static" },
  { selector: ".yamb-desktop-merge-notice-banner__icon", property: "background-color", mode: "static" },
  { selector: ".yamb-editable-avatar__button-text", property: "color", mode: "static" },
  { selector: ".yamb-embed-toolbar", property: "background", mode: "static" },
  { selector: ".yamb-forwarded-message:before", property: "background-color", mode: "static" },
  { selector: ".yamb-home-hub-page__actions:before", property: "background", mode: "static" },
  { selector: ".yamb-lightbox__shadow-overlay", property: "background-color", mode: "static" },
  { selector: ".yamb-lightbox__shadow-overlay_opaque-background", property: "background-color", mode: "static" },
  { selector: ".yamb-message-balloon_compact,.yamb-message-balloon_compact.yamb-message-balloon_own", property: "background-color", mode: "static" },
  { selector: ".yamb-message-emoji_compact,.yamb-message-emoji_transparent", property: "background-color", mode: "static" },
  { selector: ".yamb-message-emoji_forwarded", property: "background-color", mode: "static" },
  { selector: ".yamb-message-gallery__handler", property: "background", mode: "static" },
  { selector: ".yamb-message-gallery__images", property: "border", mode: "static" },
  { selector: ".yamb-message-image", property: "border", mode: "static" },
  { selector: ".yamb-message-image__handler", property: "background", mode: "static" },
  { selector: ".yamb-message-image__progress", property: "background", mode: "static" },
  { selector: ".yamb-message-image_compact", property: "background-color", mode: "static" },
  { selector: ".yamb-message-reply__content-container:before", property: "background-color", mode: "static" },
  { selector: ".yamb-message-sticker_forwarded", property: "background-color", mode: "static" },
  { selector: ".yamb-message-sticker_transparent", property: "background-color", mode: "static" },
  { selector: ".yamb-message-user__avatar_transparent .ui-avatar", property: "border-color", mode: "static" },
  { selector: ".yamb-message-voice-footer", property: "border", mode: "static" },
  { selector: ".yamb-message-voice-footer_compact", property: "background-color", mode: "static" },
  { selector: ".yamb-message-voice-footer_is-forwarded", property: "background-color", mode: "static" },
  { selector: ".yamb-statusbar", property: "background", mode: "static" },
  { selector: ".yamb-statusbar__link", property: "color", mode: "static" },
  { selector: ".yamb-telemost-login-page__scroll-area>.ui-scroll-area__container", property: "-webkit-mask-image", mode: "static" },
  { selector: ".yamb-telemost-login-page__scroll-area>.ui-scroll-area__container", property: "mask-image", mode: "static" },
  { selector: ".yamb-telemost-login-page_layout_touch .yamb-telemost-login-page__scroll-area>.ui-scroll-area__container", property: "-webkit-mask-image", mode: "static" },
  { selector: ".yamb-telemost-login-page_layout_touch .yamb-telemost-login-page__scroll-area>.ui-scroll-area__container", property: "mask-image", mode: "static" },
  { selector: ".yamb-telemost-login-page:before", property: "-webkit-mask-image", mode: "static" },
  { selector: ".yamb-telemost-login-page:before", property: "mask-image", mode: "static" },
  { selector: ".yamb-telemost-login-touch-page__cards:before", property: "-webkit-mask-image", mode: "static" },
  { selector: ".yamb-telemost-login-touch-page__cards:before", property: "mask-image", mode: "static" },
  { selector: ".yamb-telemost-promo__image-overlay", property: "-webkit-mask-image", mode: "static" },
  { selector: ".yamb-telemost-promo__image-overlay", property: "mask-image", mode: "static" },
  { selector: ".yamb-thinking-bubble-content__text", property: "-webkit-text-fill-color", mode: "static" },
  { selector: ".yamb-thinking-bubble-content__text", property: "color", mode: "static" },
  { selector: ".yamb-transfer-status", property: "color", mode: "static" },
  { selector: ".yamb-transfer-status__progress", property: "background", mode: "static" },
  { selector: ".yamb-upload-files-image__cancel", property: "background", mode: "static" },
  { selector: ".yamb-upload-files-item__cancel-container", property: "background", mode: "static" },
  { selector: ".yamb-url-preview_compact", property: "background", mode: "static" },
  { selector: ".yamb-url-preview_own.yamb-url-preview_important:not(.yamb-url-preview_compact)", property: "border-color", mode: "static" },
  { selector: ".yamb-video-player-light__sandbox", property: "background-color", mode: "static" },
]

const RULE_TARGET_INDEX: ReadonlyMap<string, VerifiedRuleTarget> = new Map(
  VERIFIED_RULE_TARGETS.map((target) => [`${target.selector}\u0000${target.property}`, target]),
)

/**
 * Byte-exact lookup of a verified rule target. The mode is registry-owned and
 * derived from the selector (plan §10), so a `(selector, property)` pair
 * always maps to exactly one mode.
 */
export function findVerifiedRuleTarget(selector: string, property: string): VerifiedRuleTarget | undefined {
  return RULE_TARGET_INDEX.get(`${selector}\u0000${property}`)
}

/**
 * Derives the theme mode a rule selector carries (plan §10): a selector
 * containing `Orb-Theme_theme_light` is `light`, `Orb-Theme_theme_dark` is
 * `dark`, anything else is `static`.
 */
export function deriveRuleMode(selector: string): RuleMode {
  if (selector.includes("Orb-Theme_theme_light")) return "light"
  if (selector.includes("Orb-Theme_theme_dark")) return "dark"
  return "static"
}

/**
 * Plan §11 kind/property matrix for rule bindings: color slots may target the
 * color-bearing properties, shadow slots only `box-shadow`, gradient slots
 * only the image properties.
 */
const KIND_PROPERTIES: Record<SemanticSlotKind, ReadonlySet<string>> = {
  color: new Set([
    "color",
    "background-color",
    "background",
    "background-image",
    "border-color",
    "border-top-color",
    "fill",
    "stroke",
    "outline-color",
  ]),
  shadow: new Set(["box-shadow"]),
  gradient: new Set(["background", "background-image"]),
}

export function slotKindAllowsProperty(kind: SemanticSlotKind, property: string): boolean {
  return KIND_PROPERTIES[kind].has(property)
}

/**
 * Whether a scope class emits on the `:root` scopes. Only the merge-notice
 * compounds (`MN`) are component-exclusive, so only they are invisible to
 * `getComputedStyle(documentElement)` and invalid as canary tokens.
 */
export function scopeClassIsRootScoped(scopeClass: ScopeClass): boolean {
  return scopeClass !== "MN"
}

/* ------------------------------------------------------------------ *
 * Lookups for the emitter (tto-6ia.4).
 * ------------------------------------------------------------------ */

/** Stable rule id (plan §12): `semantic.<slotId>.<mode>`, e.g. `semantic.gradient.messageSkeleton.dark`. */
export function semanticRuleId(slotId: string, mode: RuleMode): string {
  return `semantic.${slotId}.${mode}`
}

export interface ResolvedSemanticTarget {
  readonly slot: SemanticSlotEntry
  /** Emission scope selector lists per mode, exactly as declared in plan §9. */
  readonly scopeSelectors: Readonly<Record<ThemeMode, readonly string[]>>
}

/** Resolves a slot id to its registry entry and emission scope selectors. */
export function resolveSemanticTargets(slotId: string): ResolvedSemanticTarget | undefined {
  const slot = SEMANTIC_SLOT_REGISTRY.get(slotId)
  if (!slot) return undefined
  return { slot, scopeSelectors: SEMANTIC_SCOPE_BLOCKS[slot.scopeClass] }
}

/** Reads the semantic value a slot carries in one mode's `semantic` object. */
export function getSemanticSlotValue(
  semantic: SemanticSlots | undefined,
  entry: Pick<SemanticSlotEntry, "category" | "key">,
): string | undefined {
  if (!semantic) return undefined
  const cat = semantic[entry.category]
  if (!cat) return undefined
  return (cat as Record<string, string | undefined>)[entry.key]
}
