# tto-6ia.1 — Research: color surfaces of the Telemost UI (static half)

Artifact for bd issue `tto-6ia.1` (child of epic `tto-6ia`). Written 2026-09-22 against repo HEAD `7b9c09e`.
Scope: static inventory of the pinned stylesheet. The live-call half of `tto-6ia.1` stays open (§7).

## 1. Verified facts

### 1.1 Installed application

- Desktop Telemost build `3.0.1.9940`, runtime QtWebEngine 6.8.3 (Chrome 122).
- Provenance: `docs/brand-tokens.md` line 2 and `research_notes/Полная перекраска интерфейса Телемоста/current_engine.md` line 125.

### 1.2 Pinned stylesheet

- Bundle version `211.2.0`, single CSS bundle `ui.css`.
- Evidence file: `research_notes/Полная перекраска интерфейса Телемоста/evidence/telemost_ui.css`.
- Size: 1,889,891 bytes.
- SHA-256: `7ee580fd469fda95d42845de4a966ae7680bd0680ccf4af8e56c6507e485ebf2`.
- Re-verified 2026-09-22 by `sha256sum` and byte count on the pinned file. Both match the `asset` block of the generated JSON.

### 1.3 Audit run

- Command: `bun run audit-colors` (`scripts/audit-colors.ts`, default output `reports/telemost_ui_color_inventory.json`, schema `telemost-ui-color-inventory/1`).
- Total occurrences: 19,610. Unique color values: 1,286.

### 1.4 Occurrence kinds

| kind | occurrences |
|---|---|
| token-definition | 18,978 |
| token-reference | 397 |
| literal-color | 175 |
| shadow | 47 |
| gradient | 12 |
| svg-paint | 1 |
| **total** | **19,610** |

### 1.5 Sources

| source | occurrences |
|---|---|
| orb-token | 10,361 |
| literal-css | 6,908 |
| component-token | 2,245 |
| orb-token+component-token | 81 |
| component-token+literal-css | 14 |
| orb-token+literal-css | 1 |

Mixed-source occurrences total 96 (81 + 14 + 1). Summary buckets are exclusive. Per-occurrence `sources` arrays list every source. Cross-tab arithmetic reconciles exactly (§5).

### 1.6 Override methods

| method | occurrences |
|---|---|
| token-redefinition | 7,438 |
| orb-ramp | 6,482 |
| upstream-token | 443 |
| targeted-rule | 5,233 |
| full-value-replacement | 14 |

Method semantics come from the `overrideMethods` block of the generated JSON:

- `token-redefinition` — set the custom property through `config/mapping.json` overrides.
- `orb-ramp` — repaint the whole `--orb-color-<family>-<step>` ramp family through the ramp config.
- `upstream-token` — redefine the referenced token, not the consuming rule.
- `targeted-rule` — emit a same-selector rule in the injected sheet. Point rules are the scope of `tto-6ia.6`.
- `full-value-replacement` — replace the whole gradient or shadow value in the injected sheet.

## 2. Evidence provenance

| fact | evidence | verification method |
|---|---|---|
| app version 3.0.1.9940 | `docs/brand-tokens.md:2` | repo doc captured live over CDP |
| bundle version 211.2.0 | `research_notes/Полная перекраска интерфейса Телемоста/telemost_surface.md` §1 | notes recorded at capture time |
| pinned CSS bytes and SHA-256 | evidence file on disk | `sha256sum` + byte count, 2026-09-22 |
| all counts in §1 | `reports/telemost_ui_color_inventory.json` | recounted from the JSON, 2026-09-22 |
| override coverage | same JSON | checked every occurrence, 0 missing |
| home shell capture | `research_notes/Полная перекраска интерфейса Телемоста/evidence/telemost_home.html`, 98,686 bytes | file on disk |
| JS bundle capture | `research_notes/Полная перекраска интерфейса Телемоста/evidence/telemost_ui_chunk.js`, 1,115,618 bytes | file on disk |

Every count in §1 was recomputed from the corrected generated JSON. Kind and source totals reconcile to 19,610.

## 3. Checked screen and state matrix

Static evidence means rules present in the pinned bundle. Live evidence means a captured runtime surface. The captured shell document proves the Messenger home/chat surface only. It proves nothing about a call.

| screen / state | static bundle evidence | live evidence | verdict |
|---|---|---|---|
| Messenger home/chat shell | full pinned bundle | captured shell document | verified, shell only |
| call screen | call-surface class families shipped in bundle (video player, voice action panel) | none | runtime unverified |
| lobby (pre-join) | no lobby or pre-join selector substrings (0 matches) | none | unverified |
| menus | substring matches: menu 237, popover 20, tooltip 45 | none | rules present, runtime unverified |
| modals | substring matches: modal 344, modal elevation tokens present | none | rules present, runtime unverified |
| screen share | no screen-share selector substrings (0 matches) | none | unverified |
| hover | 56 `:hover` matches | none | authored only |
| pressed | 16 `:active` matches | none | authored only |
| focus | 25 `:focus` matches | none | authored only |
| disabled | 6 `:disabled` and 2 `aria-disabled` matches | none | authored only |
| dark theme | 116 `.theme_dark` matches, authored dark remap blocks, 2,631 occurrences under `prefers-color-scheme: dark` | none | authored only |

Substring counts are raw text matches in the pinned bundle. They prove rule presence, not runtime behavior.

## 4. Semantic surfaces

The bundle uses a three-level Orb custom property system defined at `:root`.

| surface family | token family | audit coverage |
|---|---|---|
| palette primitives | `--orb-color-<family>-<step>` | token-definition occurrences, 6,482 sit on ramp steps |
| page background and containers | `--orb-elevation-*` (sunken, base, risen, overlay, blurred, modal) | orb-token source |
| cards and panels | `--orb-surface-*`, `--ui-card-contrast-box-shadow` | component-token source, 2,245 occurrences |
| text | `--orb-text-*` | orb-token source |
| brand accent | `--orb-surface-brand`, `--orb-text-brand` resolve to `--orb-color-ya-telemost-*`, brand green `#0bb552` at step 700 | orb-token source |
| SVG paint | `fill`, `stroke` as CSS properties | svg-paint kind, 1 occurrence |
| shadows | shadow kind | 47 occurrences, 45 token-only |
| gradients | gradient kind | 12 occurrences |
| scrims and overlays | `--orb-color-black-alpha-*`, modal elevation tokens | orb-token source |

Theme switches by class on the root element: `theme_light`, `theme_dark`, `theme_auto`. Dark theme is a full remap of semantic tokens onto dark palette steps. The bundle contains an official brand remap precedent: a `brand_telemost` scope re-points `--orb-surface-brand` and `--orb-text-brand`. Redefining tokens at `:root` therefore follows the vendor pattern.

## 5. Hardcoded colors and per-occurrence override classification

The audit defines a hardcoded color as a literal color value in a rule, outside `var()`. Two layers exist and must not be confused.

| layer | count | override path |
|---|---|---|
| palette literals inside token definitions | 6,734 token-definition occurrences with literal-css source | token-redefinition or orb-ramp |
| literal colors in ordinary rules | literal-color kind | 175, targeted-rule |
| literals inside gradients | 12 gradient occurrences | full-value-replacement |
| literals inside shadows | 2 shadow occurrences | full-value-replacement |
| token-only shadows | 45 shadow occurrences | upstream-token |

The palette literals are the intended override surface, not leaks. Truly hardcoded rules are the kinds literal-color, shadow, gradient, and svg-paint outside the token layer.

Reconciliation of summary buckets against per-occurrence cross-tabs, recomputed 2026-09-22:

- orb-token: 10,443 cross-tab hits minus 82 mixed = 10,361.
- component-token: 2,340 cross-tab hits minus 95 mixed = 2,245.
- literal-css: 6,923 cross-tab hits minus 15 mixed = 6,908.

Every occurrence carries an override classification in the generated JSON. Verified: 19,610 of 19,610 occurrences have a non-empty `override` field, 0 missing. The classifier is `classify()` in `scripts/audit-colors.ts`.

Scanner limits, from the `heuristics` block of the generated JSON:

- A custom property counts as color-bearing by a name heuristic plus value inspection.
- A `var()` inside a color shorthand counts only when the referenced name is color-ish. References resolve by name only. No cascade or computed values are simulated.
- `url()` bodies are masked on purpose. Data-URI image pixels stay out of scope.
- 0 skipped fragments, 0 truncated values.

## 6. Pixel-source limitations

Classified as unreachable by CSS recoloring (JSON `unverified` block and base report):

- raster images and data-URI image pixels,
- video frames,
- canvas painting,
- SVG drawn through DOM attributes outside CSS,
- `url()` bodies, masked by the scanner by design.

CSS recolors containers, overlays, and controls around these sources only.

## 7. Explicitly unverified areas

The static audit cannot prove any of the following:

- live call DOM (tile grid, control bar, in-call chat),
- lobby,
- menus at runtime,
- modals at runtime,
- screen share rendering (tile type unknown, video versus canvas),
- interaction states exercised at runtime (hover, pressed, focus, disabled),
- inline styles set by the application at runtime,
- child documents (iframe content and its stylesheets),
- extra CSS chunks loaded on the meeting route,
- the theme class actually applied to the root element after app init.

Current GUI evidence proves only the Messenger home/chat shell. It does not prove a call surface. Runtime inspection belongs to the live half of `tto-6ia.1`.

## 8. Reproduction

```bash
# verify pinned asset integrity
sha256sum "research_notes/Полная перекраска интерфейса Телемоста/evidence/telemost_ui.css"
# expected 7ee580fd469fda95d42845de4a966ae7680bd0680ccf4af8e56c6507e485ebf2

# regenerate the inventory (overwrites the git-ignored output)
bun run audit-colors

# check headline numbers in reports/telemost_ui_color_inventory.json
# summary.totalOccurrences == 19610
# summary.uniqueColors == 1286
```

The generated JSON is reproducible uncommitted output. The root `.gitignore` excludes `reports/telemost_ui_color_inventory.json` (verified with `git check-ignore`). This artifact references the JSON instead of copying it.

## 9. Acceptance trace

| tto-6ia.1 acceptance criterion | where satisfied |
|---|---|
| asset version, screens, and states recorded | §1.2, §3 |
| table of semantic surfaces and hardcoded colors | §4, §5 |
| override method for every CSS color | §5, generated JSON carries `override` on all 19,610 occurrences |
| pixel sources and unverified areas explicitly classified | §6, §7 |

Open remainder inside `tto-6ia.1`: the live-call half (§7). This artifact does not close the issue.

## 10. Privacy

This artifact contains no private names, messages, chat titles, meeting links, or personal data. Evidence files hold the public shell document and public static bundles.
