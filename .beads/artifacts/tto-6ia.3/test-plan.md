# tto-6ia.3 — Test Plan: verified RED suite for the full semantic color configuration

Status: **verified against the working tree on 2026-09-22** (bun test v1.4.2, win32, HEAD `7b9c09e`).
Spec inputs: `.beads/artifacts/tto-6ia.2/plan.md` (§3–§12, §15, §17 matrix), epic `tto-6ia`.
This plan links every test in the suite to the epic acceptance criteria and to the
issues that own turning each failure green. No code or test file was modified to
produce it.

---

## 1. Suite inventory (files under test)

| File | Lines | Role | State today |
| --- | --- | --- | --- |
| `src/schema.test.ts` | 695 | RED contract tests: config boundary (zod schemas + `loadMapping`) | 70 tests: **4 pass / 66 expected fail** |
| `src/theme/generate.test.ts` | 841 | RED contract tests: `buildCss` semantic emission (§6, §8–§12) | 26 tests: **5 pass / 21 expected fail** |
| `src/theme/semantic-slots.testdata.ts` | 372 | Test-owned transcript of plan §5/§9/§7 — the 124-slot registry as *specification data*; the production registry module `src/theme/semantic-slots.ts` does **not** exist yet and is never imported | data source, not runnable |
| `tests/audit-colors.test.ts` | ~230 | Separate suite: defect regressions for `scripts/audit-colors.ts` (inventory evidence engine) | 12 tests: **12 pass / 0 fail** (see §6 caveat) |

All four files are untracked/new (not committed). The audit scanner fix in
`scripts/audit-colors.ts` (+119/−18) is also uncommitted.

## 2. Exact baseline results (verified 2026-09-22)

| Command | Result | Notes |
| --- | --- | --- |
| `bun test src/schema.test.ts` | **4 pass / 66 fail** (70 tests, 30 expect calls) | 66 failures in 3 root-cause categories (§3) |
| `bun test src/theme/generate.test.ts` | **5 pass / 21 fail** (26 tests, 16 expect calls) | 21 failures in 4 root-cause categories (§4) |
| `bun test tests/audit-colors.test.ts` | **12 pass / 0 fail** (12 tests, 28 expect calls) | separate suite; green only against the uncommitted scanner fix (§6) |
| `bun test` (all three files) | 21 pass / 87 fail (108 tests) | arithmetic: 4+5+12 pass, 66+21+0 fail |
| `bun run typecheck` | exit 0 | already green |
| `bun run build-css` | exit 0 | prints to stdout, touches nothing (6483 bytes for shipped OC-1 config) |

## 3. Schema suite (66 expected failures) — categories and counts

Two failure modes are declared in the file header; measurement splits them into
three observable categories:

**A. Missing export — 44 tests.** The semantic schemas do not exist in
`src/schema.ts` yet; tests reach them through a namespace import and
`needExport()` fails with a message naming the missing export
(`RED by design: export '<name>' does not exist in src/schema.ts yet`).

| describe block | tests | missing exports exercised |
| --- | --- | --- |
| mapping gains `semanticBindings`/`semanticCanaries` | 4 | `semanticBindingSchema` (T-SCH-08 ×2), `slotIdSchema`, `cssCustomPropertyNameSchema` |
| semantic color slots are hex-only | 13 | `semanticSlotsSchema` (11), `shadowValueSchema` (T-SCH-04), `gradientValueSchema` (T-SCH-05) |
| safeCssValue bans CSS-structural characters | 8 | `safeCssValueSchema` (T-SCH-02 ×2, T-SCH-03 ×2, length bounds), `shadowValueSchema` (T-SCH-04, T-SCH-06), `gradientValueSchema` (T-SCH-05, T-SCH-06), `semanticSlotsSchema` (end-to-end T-SCH-02/03) |
| semantic config is strict at every level | 19 | `SEMANTIC_CATEGORIES`, `semanticSlotsSchema` (15 × unknown-key per category, unknown category, 124-slot round-trip), all 15 `*SemanticSlotsSchema` exports |

**B. Silent stripping — 4 tests.** Today `z.object` silently drops unknown keys,
so `semantic`/`semanticBindings`/`semanticCanaries` payloads parse
"successfully" while disappearing:

| test | observed vs required |
| --- | --- |
| T-BC-02b: defaults `[]` when absent | keys stripped → `undefined` instead of `[]` |
| T-SCH-08: valid rule binding round-trips | payload stripped → `undefined` instead of the binding |
| T-SCH-01: full theme path rejection via `themeVariantSchema` | parse succeeds + strips instead of rejecting with `light.semantic.page.background` |
| T-SCH-07: end-to-end typo'd key rejects with its path | parse succeeds + strips instead of rejecting with `light.semantic.page.backgroud` |

**C. Loader accepts anything — 18 tests.** `loadMapping` (owner file
`src/config.ts`) neither validates bindings against the slot registry nor
enforces the allowlists, so every must-reject case resolves successfully:

| family | tests | required behavior |
| --- | --- | --- |
| T-SCH-09 | 2 | unknown slot id rejected, named, as `ConfigError` |
| T-SCH-10 | 1 | duplicate slot across bindings rejected (`shadow.popup`) |
| T-SCH-11 | 4 | selector/property outside the verified allowlists rejected byte-exactly (injection string, whitespace near-miss, non-allowlisted property, real-but-unused property) |
| T-SCH-12 | 5 | per-mode scoping: mode contradicting selector derivation rejected; theme-dark selectors outside the verified set; static rules need equal light/dark values (missing / different / equal) |
| T-SCH-13 | 3 | kind/property matrix: gradient→box-shadow rejected, shadow→box-shadow accepted, color→box-shadow rejected |
| T-SCH-14 | 3 | canaries: MN-scoped token rejected, root-scoped registry token accepted, unknown token rejected |

**4 passing tests (by design, "control"-tagged or self-pinning):**
T-BC-01 (shipped `config/theme.json` parses, no `semantic` key),
T-BC-02a (shipped `config/mapping.json` parses, fields untouched),
control: legacy-shaped fixtures keep parsing,
the plan §5 registry pin (124 slots = 110 color + 12 shadow + 2 gradient —
checks the testdata itself, passes today, and is the foundation every
data-driven test stands on).

## 4. Generator suite (21 expected failures) — categories and counts

Four failure modes declared in the file header; measured distribution:

1. **Missing semantic sections (§9) — 16 tests.** `buildCss` ignores
   `theme.light/dark.semantic`; `requireScopeBlock()` fails with
   `RED by design (missing semantic sections): expected exactly one scope block … found 0`.
   Covers: the all-124 data-driven test, T-EMIT-02 (unset emits nothing),
   T-EMIT-03 (no cross-mode fallback), §7 verbatim values, the 6 scope-class
   representatives (R/RB/RC/RBC/MN/REF), shadow/gradient full-value emission,
   §6.3 raw-override precedence, T-AUTO-04, compound-not-in-media, and both §12
   ordering tests (canonical order cannot be observed while sections are absent).
2. **Missing rule sections (§10/§12) — 2 tests.** `mapping.semanticBindings` is
   ignored; no `/* tto: semantic.<slot>.<mode> */` comment or rule body is
   emitted (mode derivation, light→dark→static order, no media duplication,
   verified (selector, property) matrix byte-exact).
3. **Auto gap (§6.4/§8.4) — 1 test.** T-BC-03b/T-AUTO-03: `darkOverrides` never
   reach the `@media (prefers-color-scheme: dark)` block — the documented fix.
4. **Dark semantics missing in auto media (§8) — 2 tests.** T-AUTO-01 (dark `R`
   values on `:root.theme_auto`), T-AUTO-02 (dark `RBC` values on brand
   theme_auto compounds).

**5 passing tests — all "control"-tagged** (behavior tto-6ia.4 must not break):
control T-BC-03a (legacy inputs reproduce the pinned `GOLDEN_LEGACY` bytes),
control T-DET-01 (two builds byte-identical), control REF tokens never reach
brand/component/merge-notice compounds, control no timestamps / no `!important`
/ exactly one dark media block, control hygiene (no `currentColor` rewriting, no
`--component-chat-list-item-border-top-color`, no `::selection`).

## 5. Audit scanner suite — 12 pass, with a state caveat

`tests/audit-colors.test.ts` pins `scripts/audit-colors.ts`, the engine that
produces `reports/telemost_ui_color_inventory.json` — the evidence source the
124-slot registry numbers were derived from. **9 defect regressions + 3
controls:**

| # | Kind | Defect pinned |
| --- | --- | --- |
| 1 | regression | line/column tracking across ordinary `\n` (the defective scan reported every occurrence on line 1) |
| 2 | regression | `line` in COLORISH_NAME inventories `--orb-*-line-height` typography tokens as colors (~900 report rows) |
| 3 | regression | var() name capture truncates non-ASCII CSS ident tails (`--brand-цвет` → `--brand-`) |
| 4 | regression | var() name starting with non-ASCII degrades to the whole `var(...)` call text |
| 5 | regression | component-scoped token definitions prescribed a `:root` redefinition that cannot win the cascade |
| 6 | regression | unquoted url(): `;` splits the declaration stream |
| 7 | regression | unquoted url(): `{`/`}` corrupt the rule frame |
| 8 | regression | `--out` resolving onto the SHA-256-pinned input asset is not refused |
| 9 | regression | svg-dom note misstates the url() paint-reference count (claims one; asset has six) |
| 10–12 | control | genuine `--orb-line-*` colors stay inventoried; `:root` definitions keep `token-redefinition`; ordinary `--out` paths and the default still accepted |

**Caveat (verified):** the suite header declares these tests RED at commit
`7b9c09e`; they pass **only because the working tree carries an uncommitted
`scripts/audit-colors.ts` fix (+119/−18)**. For the suite to stay green at HEAD
the fix must be committed. The inventory integrity these tests protect feeds
T-INV-01/02 (planned `src/theme/semantic-slots.test.ts`, owner tto-6ia.2
contract) and the tto-6ia.6 allowlist derivation, and is the baseline
tto-6ia.8 reports against.

## 6. All 124-slot data-driven coverage

The registry transcript (`semantic-slots.testdata.ts`) holds 124 specs:
page 7, surface 13, elevation 6, modal 3, overlay 5, line 12 (incl. the four
`border.*` ids under the `line` category), focus 2, text 9, icon 2, control 20,
state 8, selection 4, status 17, shadow 14, gradient 2 — kinds 110 color /
12 shadow / 2 gradient, each with token target, scope class (R/RB/RC/RBC/MN/REF),
and evidence tuple. `specValue()` gives every slot a unique, contract-valid
light and dark value (dark offset +1000; gradients get two distinct stops), so
any cross-slot or cross-mode leak changes a byte and fails.

| Mechanism | Where | Slot coverage | Status |
| --- | --- | --- | --- |
| Registry shape pin (124 = 110+12+2) | schema.test.ts | all 124, kind split | PASS (pins the testdata) |
| Parse: all 124 slots, both modes, round-trip exact (T-SCH-07) | schema.test.ts | 124 × 2 | RED (silent stripping) |
| Parse: per-slot kind binding — shadow-shaped value rejected at each slot's own path (T-SCH-01) | schema.test.ts | all 110 color slots | RED (missing export) |
| Parse: plain hex rejected at each gradient slot's own path (T-SCH-05) | schema.test.ts | 2 gradient slots (+ pins the 12 shadow slots' documented asymmetry: shadow accepts plain hex; safeCssValue imposes safety, not shape) | RED (missing export) |
| Parse: strict per-category key sets | schema.test.ts | 15 categories = all 124 keys | RED (missing export) |
| Generation: all 124 slots × both modes land on their registry token inside the exact §9 scope block, value byte-exact | generate.test.ts | 248 assertions | RED (missing semantic sections) |
| Generation: unset slots emit nothing (T-EMIT-02) / no cross-mode fallback (T-EMIT-03) | generate.test.ts | all tokens swept for absence | RED |
| Generation: determinism + canonical §12 order over the full sheet | generate.test.ts | all 124, both modes | RED (masked by missing sections); determinism control PASSES |
| Generation: hygiene sweeps (no `!important`, no `::selection`, no `currentColor`, single media block, REF never on compounds) | generate.test.ts | all 124 | PASS (controls) |

Per-slot parse+generation coverage is therefore complete for all 124 slots:
parse via round-trip + strictness (plus per-slot invalid-value checks for the
110+2 kind-bound slots), generation via the 248-assertion data-driven test.
T-INV-01..03 (registry deep-compare in the planned `src/theme/semantic-slots.test.ts`,
plan §17) remain unwritten — the production registry does not exist yet.

## 7. Test-to-epic acceptance trace

Epic `tto-6ia` acceptance criteria: **AC1** user independently sets semantic
light/dark colors · **AC2** every found CSS color bound to config or documented
as an exception · **AC3** containers and dynamic states use the chosen colors ·
**AC4** old configs keep working · **AC5** tests, typecheck and build pass.

| Test family (plan §17 ids) | Suite | Epic AC | tto-6ia.3 AC | Baseline |
| --- | --- | --- | --- | --- |
| T-SCH-01..07 (value schemas, strictness, injection/`!important`/parens/url bans) | schema | AC1 | every slot parseable, valid/invalid pinned | 44 RED-A + 2 RED-B |
| T-SCH-08 (rule-only bindings), T-SCH-09..13 (loader validation, allowlists, mode scoping, kind/property matrix) | schema | AC1, AC3 | bindings parse + reject correctly | 5 RED-A + 2 RED-B + 15 RED-C |
| T-SCH-14 (canary scoping) | schema | AC2 | canaries evidenced | 3 RED-C; config-side gate for .8 |
| T-BC-01, T-BC-02a/b | schema | AC4 | regression test of old config | 2 PASS + 1 RED-B |
| T-BC-03a/b (byte-identity + qualified auto fix) | generate | AC4 | regression test of old output | 1 PASS + 1 RED (auto gap) |
| T-EMIT-01..04, §7 verbatim, scope matrix ×6, shadow/gradient full values | generate | AC1, AC3 | every slot generates | 17 RED |
| T-AUTO-01..04 | generate | AC1 (theme_auto), AC4 (documented fix) | light/dark/auto | 4 RED |
| T-DET-01..04 | generate | AC5 (deterministic builds) | stable ids, fixed order | 2 PASS (T-DET-01, T-DET-04-as-control) + 2 RED (masked) |
| Hygiene controls (§5.8/§14: no `::selection`, no `currentColor` rewrite, REF compounds) | generate | AC2 (classifications hold) | — | 3 PASS |
| Registry pin + evidence transcript | testdata/schema | AC2 | every slot has a checked target | PASS |
| T-INV-01..03 (planned `src/theme/semantic-slots.test.ts`) | — | AC2 | registry deep-compare vs plan | not written (registry module missing; owner tto-6ia.2 contract → implemented with .4) |
| Audit suite (9 defects + 3 controls) | tests/audit-colors | AC2 (evidence integrity) | — | 12 PASS (§5 caveat) |
| T-VER-01 (`inject` verify reads `semanticCanaries` over CDP) | — | AC1, AC3 | — | not written; owner tto-6ia.8 |

tto-6ia.3 issue acceptance: *"новые тесты падают по ожидаемым причинам"* → §3–§4
(verified categories); *"каждый слот имеет проверку разбора и генерации"* → §6;
*"regression-тест старой конфигурации"* → 9 passing controls across both suites;
*"test-plan связывает тесты с критериями epic"* → this section.

## 8. Ownership mapping — who turns what green

| Owner | Owns | Tests it must turn/stay green |
| --- | --- | --- |
| **tto-6ia.4** | `src/schema.ts` semantic exports (§3/§4 shapes, `SEMANTIC_CATEGORIES`), new `src/theme/semantic-slots.ts` registry, `src/config.ts` `loadMapping` validation, `buildCss` semantic/rule/auto emission (§9/§12) and the §6.4 auto fix — its stated acceptance is "RED-тесты задачи становятся GREEN" | **all 66 schema RED + all 21 generator RED**; the 9 controls must stay passing, incl. `GOLDEN_LEGACY` byte-identity (T-BC-03a) |
| **tto-6ia.5** | Remaining RC/RBC container/state token coverage on real screens and the `--orb-color-ya-telemost-*` component re-declaration gap (plan §15) | scope-matrix rows (RC/RBC/MN) and the 28 control/state slots inside the 124-slot tests **stay green**; no new unit tests required by this suite |
| **tto-6ia.6** | Targeted-rule emission end to end: `VERIFIED_RULE_TARGETS` consumption in the sheet | schema T-SCH-11..13 (18 loader tests) + the 2 generator rule-binding tests **stay green** while rules ship |
| **tto-6ia.7** | Live-call DOM, inline styles, MutationObserver runtime (plan §19) | deliberately untested here; constraint: the static suites must not regress (no emission-format change) |
| **tto-6ia.8** | `T-VER-01` (CDP verify of `semanticCanaries`, not yet written), visual/WCAG QA | consumes T-SCH-14 (green after .4) as its config gate; audit suite (12) must stay green — it is the evidence baseline |
| (tto-6ia.1, context) | Inventory verification owns the audit scanner whose fix is currently uncommitted | commit `scripts/audit-colors.ts` so the 12 stay green at HEAD (§5) |

## 9. Commands

```bash
bun test src/schema.test.ts          # baseline: 4 pass / 66 fail (70 tests)
bun test src/theme/generate.test.ts  # baseline: 5 pass / 21 fail (26 tests)
bun test tests/audit-colors.test.ts  # baseline: 12 pass / 0 fail (12 tests)
bun test                             # baseline: 21 pass / 87 fail (108 tests)
bun run typecheck                    # exit 0 (verified)
bun run build-css                    # exit 0, stdout only (verified)
bun run doctor                       # epic AC5 gate (not exercised in this pass)
```

## 10. GREEN completion conditions

1. **tto-6ia.4 done ⇔ both RED suites fully green:** schema 70/70, generator
   26/26, every failure eliminated for its *declared* reason (missing export →
   export exists and behaves; silent stripping → strict parse/round-trip;
   loader → `ConfigError` with slot-id paths; missing sections/rules → emitted
   per §9/§10/§12; auto gap → darkOverrides in the media block). The 9 legacy
   controls — T-BC-01, T-BC-02a, legacy fixtures, registry pin, T-BC-03a,
   T-DET-01, REF-compounds, determinism/hygiene — remain green, proving
   AC4 (backward compatibility) survived the implementation.
2. **Full gate:** `bun test` → 108/108 pass; `bun run typecheck` exit 0;
   `bun run build-css` exit 0 and byte-stable for legacy configs (T-DET);
   `bun run doctor` passes.
3. **The audit scanner fix is committed**, so `tests/audit-colors.test.ts` is
   12/12 at HEAD, not only in the working tree.
4. **Deferred, not blocking tto-6ia.3 closure:** T-INV-01..03 (requires the
   `.4` registry module) and T-VER-01 (owner `.8`) — tracked by their owning
   issues; this suite's data files are their specification.
