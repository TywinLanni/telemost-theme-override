# tto-6ia.7 — Research: dynamic and inline colors — verified no-code decision

Artifact for bd issue `tto-6ia.7` (child of epic `tto-6ia`). Written 2026-09-22.

Repo state measured: HEAD `7b9c09e` plus uncommitted working-tree edits in `src/main.ts`,
`src/theme/generate.ts`, `src/schema.ts`, `src/config.ts`. `src/inject.ts`, `src/start.ts` and
`src/cdp/client.ts` are identical to HEAD. Line references are 1-based and reflect this state.

## 1. Decision

No code change is needed for dynamic color coverage. Today's mechanisms already handle every
dynamically created node, route change, menu, modal, and theme class switch that the pinned
bundle proves. This document is the audit-backed "documentation of the decision" that the issue
acceptance criteria require.

Runtime hooks stay out. No inline-style observer, no MAIN-world patch, no adoptedStyleSheets
rewriting ships now. The live-call half of `tto-6ia.1` can reopen the decision (§7). Until then
the speculative inline-style hook is a rejected alternative, not an implementation item (§8).

## 2. Why plain CSS already covers the dynamic cases

The injected theme is one document-level stylesheet: `<style id="telemost-theme-override">`,
always appended last so it wins cascade ties at equal specificity
(`src/inject.ts:5-59`). Its content is CSS custom properties on theme scopes plus targeted
rules (`src/theme/generate.ts:462-528`). That carrier gives four platform guarantees, all
standard cascade behavior and none requiring our code:

| # | dynamic case | mechanism | evidence |
|---|---|---|---|
| 2.1 | nodes the SPA inserts later | live selector matching: the user agent matches every stylesheet, including the injected one, against each inserted node at style resolution time. No rescan exists in our code and none is needed | platform behavior (CSS Cascade); carrier in `src/inject.ts:5-59` |
| 2.2 | colors on new nodes | custom-property inheritance: `--orb-*` tokens set on `:root` resolve in every descendant at computed-value time. The app's whole color system is token-based (18,978 token-definition occurrences; `tto-6ia.1` §1.4, §4), so inheritance reaches new nodes for free | `reports/telemost_ui_color_inventory.json`; `src/inject.ts:5-59` |
| 2.3 | SPA route changes in the same document | the document never unloads, so the style node persists. Class and DOM changes just re-trigger matching. Nothing to re-apply | same carrier; theme scopes in `src/theme/generate.ts:509-513` |
| 2.4 | real navigations and reloads | two layers: `Page.addScriptToEvaluateOnNewDocument` re-runs the agent in every new document (`src/cdp/client.ts:177-181`, registered at `src/start.ts:134-136`), and `Page.frameNavigated` re-runs `applyToLiveDocument` (`src/start.ts:173-177`, apply CLI `src/main.ts:154-158`). Both are idempotent | `src/start.ts:133-136`, `src/start.ts:173-177`, `src/main.ts:154-158` |

Case-by-case verdicts:

- **Menus, popovers, tooltips, modals.** Their color rules are present in the pinned bundle
  (raw substring matches: menu 237, popover 20, tooltip 45, modal 344 — `tto-6ia.1` §3). The
  pinned JS chunk anchors overlay positioning to `document.documentElement` custom properties
  (§5 scan), so overlay content renders inside the main document cascade and inherits the same
  tokens. When a portal node is inserted, matching plus inheritance color it. Runtime
  confirmation of actual mount points is open (§7).
- **Theme class changes.** Telemost swaps `theme_light` / `theme_dark` / `theme_auto` classes on
  `<html>`. The injected sheet ships `:root.theme_dark`, `:root.brand_telemost` and a dark-only
  `@media (prefers-color-scheme: dark)` block (`src/theme/generate.ts:509-513`, media wrapper
  `src/theme/generate.ts:433`, assembled in `buildAutoMediaSections`). A class swap is only a
  re-match. `verify()` reads back `rootClasses` on every run (`src/inject.ts:103-126`), so a
  wrong class state is visible in the report rather than silent.
- **Dynamic containers without full rescan.** No code of ours ever rescans the DOM. The only
  observer performs two constant-time lookups (§3).

## 3. The only observer: idempotent self-heal, no mutation loop

`buildAgentSource` (`src/inject.ts:16-59`) embeds one `MutationObserver`:

- Created at `src/inject.ts:45`, observing `document.documentElement` with
  `{ childList: true, subtree: true }` (`src/inject.ts:53`).
- The callback (`src/inject.ts:46-48`) acts only when our style node is missing or no longer
  the parent's last child. It then calls `mount()`.
- `mount()` is idempotent by construction: node lookup keyed by `getElementById(STYLE_ELEMENT_ID)`
  (`src/inject.ts:5`, `src/inject.ts:27`), `textContent` written only when different
  (`src/inject.ts:33`), `appendChild` only when the node is not already last
  (`src/inject.ts:35`).

Loop analysis. The only DOM write that can re-trigger the observer is the `appendChild` in
`mount()`. After that write the node is last, so the next callback is a no-op. The
`textContent` guard prevents identical-content writes. The platform batches mutation records
per microtask, so callback cost is two lookups per batch regardless of how many app mutations
occurred. `attributes` and `characterData` are not observed, so app style-attribute writes do
not wake it. Termination is guaranteed by construction; AC "наблюдатель пакетирует изменения и
не создаёт цикл мутаций" holds without new code.

This observer is deliberately deaf to app DOM. It repairs one thing only: presence and last
position of the injected node. It never rewrites colors and never scans the tree.

## 4. Pinned bundle: the hard cases are absent (static proof)

Scan of the pinned evidence on 2026-09-22, literal pattern search over both files:

- `research_notes/Полная перекраска интерфейса Телемоста/evidence/telemost_ui.css`
  (1,889,891 bytes, SHA-256 `7ee580fd469fda95d42845de4a966ae7680bd0680ccf4af8e56c6507e485ebf2`),
- `research_notes/Полная перекраска интерфейса Телемоста/evidence/telemost_ui_chunk.js`
  (1,115,618 bytes, bundle `211.2.0`, app `3.0.1.9940`, QtWebEngine 6.8.3).

| pattern | telemost_ui.css | telemost_ui_chunk.js |
|---|---|---|
| `:host` | 0 | n/a |
| `attachShadow` | 0 | 0 |
| `adoptedStyleSheets` | 0 | 0 |
| `insertRule` | 0 | 0 |
| `cssText` | 0 | 0 |
| `style.<color-prop> =` for `color`, `backgroundColor`, `background`, `fill`, `stroke` | n/a | 0 |
| `setProperty(` — total | 0 | 12 |

The 12 `setProperty(` calls resolve as:

- 11 are layout and visibility plumbing on `document.documentElement.style`: geometry custom
  properties fed with pixel measurements, plus `visibility`, `pointerEvents`, `opacity` with
  constant values, and one `--message-balloon-min-width`. None carries a color.
- 1 is a generic writer `e.style.setProperty(t, n)` fed by a runtime iterator. Its key and value
  are computed at run time, so no color value is statically visible. It is the only spot where
  an inline color write cannot be fully excluded by static scan.

Verdict wording matters: **no confirmed** Shadow DOM, no confirmed `adoptedStyleSheets`
usage, no confirmed constructable stylesheet usage, no confirmed inline color mutation in the
pinned material. Two caveats keep this from being proof of impossibility:

1. The chunk set is not provably complete. Extra chunks load on the meeting route
   (`tto-6ia.1` §7).
2. Minified single-line bundles are pattern-scanned, not semantically executed.

## 5. Classification of hard limits (AC 3)

| source | class | what CSS can and cannot do |
|---|---|---|
| video | pixel limitation | pixels are decoded outside the cascade. CSS recolors the container, controls, and scrims around the frame. `filter` applies to the element as a whole and is out of scope for brand recoloring |
| canvas | pixel limitation | content is painted by script through 2D/WebGL contexts. Same container-only reach as video |
| cross-origin iframe | security limitation | same-origin policy blocks DOM and `cssRules` access to the child document. The child document is a separate target. CSS recolors the host-side container only |
| closed Shadow DOM | limitation, currently hypothetical | the shadow root reference exists only at `attachShadow` time and needs a MAIN-world patch to capture. Pinned bundle: 0 `attachShadow` and 0 `:host` matches, so nothing confirms presence |
| open Shadow DOM | covered, if ever present | custom properties inherit across the shadow boundary, which is the official theming channel. The injected tokens would reach slotted and shadow content automatically |
| raster and data-URI images | pixel limitation | `url()` bodies are masked by the audit by design (`tto-6ia.1` §6) |

## 6. Explicitly unverified areas — blockers delegated to tto-6ia.1 and tto-6ia.8

None of the items below contradicts the no-code decision. They are inputs the live half must
confirm. They are recorded here as blockers so the decision's boundary is explicit.

| # | area | why unverified | blocked issue |
|---|---|---|---|
| 6.1 | live-call DOM (tile grid, control bar, in-call chat) | no live capture exists. Call-surface rule families ship in the bundle, runtime behavior is unproven (`tto-6ia.1` §3, §7) | tto-6ia.1 (live half), tto-6ia.8 |
| 6.2 | inline call styles set at runtime | static scan is clean (§4), but the generic `setProperty(t, n)` writer and unpinned meeting-route chunks leave room. A runtime inline color write in call code would be the one case CSS cannot close from outside | tto-6ia.1, tto-6ia.8 |
| 6.3 | detached call windows (pop-out windows) | CDP script registration is per target. The tool attaches to the first target matching `isTelemostPage` (`src/start.ts:48-53`, attach at `src/start.ts:123`; `src/main.ts:37`, attach at `src/main.ts:71`, `src/main.ts:112`). A pop-out window is a new target that never receives the registration. Whether Telemost opens detached windows is unobserved | tto-6ia.1, tto-6ia.8 |
| 6.4 | speaker meters / audio-level indicators | render path unknown: CSS transform and opacity, or canvas. Unobserved | tto-6ia.1, tto-6ia.8 |
| 6.5 | screen share | tile type unknown: video element or canvas. Unobserved (`tto-6ia.1` §7) | tto-6ia.1, tto-6ia.8 |
| 6.6 | lobby, runtime menus and modals, runtime hover/pressed/focus/disabled, extra meeting-route CSS chunks, theme class after app init, child documents | carried over verbatim from `tto-6ia.1` §7 | tto-6ia.1 |

## 7. What would reopen the decision

The decision stands unless the live audit finds one of these:

1. An app-owned inline color write on a surface that must match the theme (6.2, 6.4).
2. A confirmed `attachShadow` with closed roots carrying brand colors (§5).
3. A surface rendered in a separate target or child document that needs theming (6.3).

Each finding gets a CSS-first attempt (token bridge or targeted rule in the injected sheet).
Only a demonstrated CSS failure justifies runtime handling, and then as a new scoped decision,
not as a general hook.

## 8. Rejected alternative — recorded, not implemented

A MAIN-world inline-style hook (patching `Element.prototype.setAttribute` and the `style`
property setters, or running a broad style-attribute `MutationObserver` that rewrites color
values) was considered and rejected:

- No confirmed case needs it (§4).
- It risks mutation feedback loops and per-frame cost on a heavy SPA.
- It fights the app instead of the cascade, against the project philosophy of primitives over
  point fixes (README; `src/theme/generate.ts:219-230` at HEAD).

This section documents why the hook is absent. It is not a design to build later.

## 9. Symbol map

| symbol | location | role in this decision |
|---|---|---|
| `STYLE_ELEMENT_ID` | `src/inject.ts:5` | idempotency key of the injected node |
| `buildAgentSource` | `src/inject.ts:16-59` | agent source: `mount()` at 24-36, `textContent` guard 33, append-last guard 35, DOMContentLoaded re-mount 40-42, observer 45-49, `startObserver` 51-54, observe options 53 |
| `applyToLiveDocument` | `src/inject.ts:62-64` | one-shot apply through `Runtime.evaluate` |
| `waitForAppStyles` | `src/inject.ts:78-95` | gates on a real Orb token before verifying |
| `verify` | `src/inject.ts:103-126` | reads `rootClasses`, `styleTagPresent`, canary `resolved`/`missing` |
| `addScriptOnNewDocument` | `src/cdp/client.ts:178-181` | `Page.addScriptToEvaluateOnNewDocument`, persists across navigations |
| `CdpSession.evaluate` | `src/cdp/client.ts:163-175` | transport for apply and verify |
| `waitForPageTarget` | `src/cdp/client.ts:49-71` | attaches to the first matching page target |
| `isTelemostPage` | `src/start.ts:48-53`; `src/main.ts:37` | target matcher (duplicated in both commands) |
| watch setup | `src/start.ts:133-136` | `Page.enable` + agent registration |
| frameNavigated re-apply | `src/start.ts:173-177`; `src/main.ts:154-158` | re-apply on navigation, idempotent, catches transient failures |
| `buildCss` | `src/theme/generate.ts:462-528` | section order: banner, `:root` ramps 509, `.theme_dark` ramps 510, semantic blocks 511, overrides 512-513, rule bindings 516, dark-only auto media ~522 |
| `buildRuleBindingSections` | called at `src/theme/generate.ts:516` | targeted-rule layer riding the same injected sheet |
| `buildAutoMediaSections` | called at `src/theme/generate.ts:522` | dark-only `@media (prefers-color-scheme: dark)` wrapper, template at 433 |

## 10. Acceptance trace for tto-6ia.7

| acceptance criterion | where satisfied |
|---|---|
| dynamic containers get colors without full DOM rescan | §2.1, §2.2, §3 (observer is constant-time per batch, never rescans) |
| observer batches changes and creates no mutation cycle | §3 (idempotent writes, termination proof, platform record batching) |
| cross-origin iframe, closed Shadow DOM, video, canvas classified | §5 (pixel and security limits, shadow DOM currently hypothetical) |
| if runtime handling is unneeded, proven by audit and closed with documentation | §4 (static proof of absence), this document is the decision record; live remainder is delegated with explicit blockers in §6 |

Closing note. The static scope of the decision is proven and documented here. Issue closure is
sound for that scope. The §6 blockers bind the live half of `tto-6ia.1` and the QA pass of
`tto-6ia.8`; a refutation there reopens `tto-6ia.7` under §7 conditions.

## 11. Privacy

This artifact contains no private names, messages, chat titles, meeting links, or personal
data. It references pinned public bundles and repository code only.
