/**
 * T-VER-01 — the runtime verifier must assert `semanticCanaries` over CDP
 * (plan §17 row T-VER-01, owner tto-6ia.8).
 *
 * Contract: `verify(session, mapping)` evaluates the page for the UNION of
 * `mapping.canaryTokens` and `mapping.semanticCanaries` — the semantic slots
 * are the feature's actual surface, so a verifier that reads only the legacy
 * `canaryTokens` can never notice a semantic slot going dark — and reports
 * every token that does not resolve as a mismatch in `report.missing`.
 *
 * RED by design: production `verify()` reads only `mapping.canaryTokens`
 * today, so the two T-VER-01 tests fail with
 * "verify never queried semantic canary …". They turn green when `verify`
 * consumes `[...canaryTokens, ...semanticCanaries]`. The control test pins the
 * existing legacy-canary behavior the fix must not break.
 *
 * No real browser is involved: the `CdpSession` boundary is faked, the in-page
 * expression is executed against a stubbed `document`, and the result is
 * validated through the same zod schema the real `session.evaluate` applies.
 *
 * Run: bun test src/inject.test.ts
 */

import { describe, expect, test } from "bun:test"
import { STYLE_ELEMENT_ID, verify, type CdpEvaluator } from "./inject"
import { mappingConfigSchema, type MappingConfig } from "./schema"

/* ------------------------------------------------------------------ *
 * Fixtures — a CdpSession double that runs the in-page expression locally
 * ------------------------------------------------------------------ */

function mappingWith(canaryTokens: string[], semanticCanaries: string[]): MappingConfig {
  return mappingConfigSchema.parse({
    ramps: [{ family: "ya-telemost", seed: "interactive", alphaSource: 700, emitLightTrio: true }],
    canaryTokens,
    semanticCanaries,
  }) as MappingConfig
}

/**
 * Builds a fake `CdpSession` whose `evaluate` executes the generated in-page
 * expression against a stubbed document and records which custom properties
 * the expression actually asks the page to resolve.
 */
function fakeCdpSession(computedValues: Record<string, string>) {
  const queriedTokens: string[] = []
  const evaluate = async <T>(
    expression: string,
    schema: { safeParse(input: unknown): { success: boolean; data?: unknown; error?: unknown } },
  ): Promise<T> => {
    const document = {
      documentElement: { className: "theme_dark theme_auto" },
      getElementById: (id: string) => (id === STYLE_ELEMENT_ID ? { id } : null),
    }
    const getComputedStyle = () => ({
      getPropertyValue: (token: string) => {
        queriedTokens.push(token)
        return computedValues[token] ?? ""
      },
    })
    // The in-page source is a single IIFE expression; run it against the stub.
    const run = new Function("document", "getComputedStyle", `return (${expression});`)
    const parsed = schema.safeParse(run(document, getComputedStyle))
    if (!parsed.success) throw new Error("in-page report failed the verificationReportSchema validation")
    return parsed.data as T
  }
  return { session: { evaluate } satisfies CdpEvaluator, queriedTokens }
}

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */

describe("verify() reports canary resolution over CDP (T-VER-01)", () => {
  test("control: legacy canaryTokens resolve into the report, unresolvable ones land in missing", async () => {
    const mapping = mappingWith(["--common-bg", "--common-divider"], [])
    const { session, queriedTokens } = fakeCdpSession({ "--common-bg": "#101014" })

    const report = await verify(session, mapping)

    expect(queriedTokens, "exactly the configured canaries are queried").toEqual([...mapping.canaryTokens])
    expect(report.styleTagPresent, "style tag presence is reported").toBe(true)
    expect(report.rootClasses).toBe("theme_dark theme_auto")
    expect(report.resolved["--common-bg"]).toBe("#101014")
    expect(report.missing).toEqual(["--common-divider"])
  })

  test("T-VER-01: verify requests both canaryTokens and semanticCanaries", async () => {
    const mapping = mappingWith(["--common-bg"], ["--orb-text-primary", "--orb-surface-brand"])
    const { session, queriedTokens } = fakeCdpSession({
      "--common-bg": "#101014",
      "--orb-text-primary": "#e8eaed",
      "--orb-surface-brand": "#1f1f24",
    })

    const report = await verify(session, mapping)

    const expectedTokens = [...mapping.canaryTokens, ...mapping.semanticCanaries].sort()
    for (const token of mapping.semanticCanaries) {
      expect(queriedTokens, `verify never queried semantic canary ${token}`).toContain(token)
    }
    expect(queriedTokens, "the queried token set is exactly [...canaryTokens, ...semanticCanaries]").toEqual(
      expectedTokens,
    )
    expect(report.missing, "everything resolves, nothing is reported missing").toEqual([])
    expect(Object.keys(report.resolved).sort()).toEqual(expectedTokens)
  })

  test("T-VER-01: a semantic canary that does not resolve is reported as a mismatch", async () => {
    const mapping = mappingWith(["--common-bg"], ["--orb-text-primary"])
    // --orb-text-primary is deliberately absent from the computed values.
    const { session, queriedTokens } = fakeCdpSession({ "--common-bg": "#101014" })

    const report = await verify(session, mapping)

    expect(queriedTokens, "the semantic canary must be queried to be verified").toContain("--orb-text-primary")
    expect(report.missing, "the unresolvable semantic canary is reported as a mismatch").toContain("--orb-text-primary")
    expect(report.resolved["--orb-text-primary"], "a missing token is never reported resolved").toBeUndefined()
    expect(report.resolved["--common-bg"]).toBe("#101014")
  })
})
