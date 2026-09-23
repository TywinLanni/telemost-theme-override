import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import {
  SEMANTIC_SLOT_BY_TOKEN,
  SEMANTIC_SLOT_REGISTRY,
  findVerifiedRuleTarget,
  getSemanticSlotValue,
  scopeClassIsRootScoped,
  slotKindAllowsProperty,
} from "./theme/semantic-slots"
import { findTelemost } from "./paths"
import {
  appConfigSchema,
  desktopThemeSchema,
  mappingConfigSchema,
  type AppConfig,
  type MappingConfig,
} from "./schema"
import { resolveThemeBackgrounds } from "./theme/backgrounds"
import type { z } from "zod"

export type DesktopTheme = z.infer<typeof desktopThemeSchema>

export const DEFAULT_TELEMOST_EXE = "C:\\Program Files\\Yandex\\YandexTelemost\\YandexTelemost.exe"

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ConfigError"
  }
}

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"))
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new ConfigError(`cannot read JSON from ${path}: ${reason}`)
  }
}

function describeIssues(issues: ReadonlyArray<z.core.$ZodIssue>): string {
  return issues.map((issue) => `  - ${issue.path.join(".") || "<root>"}: ${issue.message}`).join("\n")
}

/**
 * `theme.<mode>.semantic` is already scoped per mode (plan §2): a variant's
 * `semantic` object holds the category keys directly. Rejects the
 * `semantic.light`/`semantic.dark` nesting a user might wrongly infer, so it
 * can never silently configure nothing.
 */
function assertNoModeNestingInSemantic(theme: DesktopTheme, source: string): void {
  for (const variant of [theme.light, theme.dark]) {
    const semantic = variant.semantic as Record<string, unknown> | undefined
    if (semantic?.light !== undefined || semantic?.dark !== undefined) {
      throw new ConfigError(
        `invalid theme ${source}: "semantic" is already scoped per mode — ` +
        `write light.semantic.<category>.<slot> instead of nesting light/dark inside semantic`,
      )
    }
  }
}

/**
 * Cross-validates rule-only semantic bindings against the registry and the
 * theme (plan §4, §10, §11). Every failure is a ConfigError naming the slot id.
 *
 * Checks per binding, in order: unknown slot id, byte-exact (selector,
 * property) allowlist match, mode consistency, kind/property matrix, duplicate
 * slot, and per-mode value presence (static rules need one equal light/dark
 * value). Value presence needs the theme; `loadMapping` demands it once any
 * binding exists.
 */
function validateSemanticBindings(mapping: MappingConfig, source: string, theme: unknown): void {
  const bindings = mapping.semanticBindings
  if (bindings.length === 0) return

  const seenSlots = new Set<string>()
  let parsedTheme: DesktopTheme | null = null
  const requireTheme = (): DesktopTheme => {
    if (parsedTheme) return parsedTheme
    if (theme === undefined) {
      throw new ConfigError(
        `invalid mapping file ${source}: semantic bindings are cross-validated against the theme — ` +
        `pass the parsed theme as the second loadMapping argument`,
      )
    }
    const parsed = desktopThemeSchema.safeParse(theme)
    if (!parsed.success) {
      throw new ConfigError(`invalid mapping file ${source}: theme argument rejected:\n${describeIssues(parsed.error.issues)}`)
    }
    assertNoModeNestingInSemantic(parsed.data, `theme argument of ${source}`)
    parsedTheme = parsed.data
    return parsedTheme
  }

  // Pass 1 — registry and allowlist checks; none of them need the theme, so
  // duplicates and allowlist misses are reported even without one.
  for (const [index, binding] of bindings.entries()) {
    const where = `semantic binding #${index + 1} (slot "${binding.slot}")`
    const slot = SEMANTIC_SLOT_REGISTRY.get(binding.slot)
    if (!slot) {
      throw new ConfigError(`invalid mapping file ${source}: ${where}: unknown slot id`)
    }
    const target = findVerifiedRuleTarget(binding.selector, binding.property)
    if (!target) {
      throw new ConfigError(
        `invalid mapping file ${source}: ${where}: (selector, property) pair ` +
        `(${JSON.stringify(binding.selector)}, ${binding.property}) is not in the verified rule allowlist`,
      )
    }
    if (binding.mode !== undefined && binding.mode !== target.mode) {
      throw new ConfigError(
        `invalid mapping file ${source}: ${where}: mode "${binding.mode}" contradicts the ` +
        `selector's derived mode "${target.mode}"`,
      )
    }
    if (!slotKindAllowsProperty(slot.kind, target.property)) {
      throw new ConfigError(
        `invalid mapping file ${source}: ${where}: a ${slot.kind} slot cannot target the property "${target.property}"`,
      )
    }
    if (seenSlots.has(binding.slot)) {
      throw new ConfigError(`invalid mapping file ${source}: ${where}: duplicate binding for this slot`)
    }
    seenSlots.add(binding.slot)
  }

  // Pass 2 — per-mode value presence against the theme (plan §10).
  for (const [index, binding] of bindings.entries()) {
    const where = `semantic binding #${index + 1} (slot "${binding.slot}")`
    const slot = SEMANTIC_SLOT_REGISTRY.get(binding.slot)!
    const target = findVerifiedRuleTarget(binding.selector, binding.property)!
    const themeData = requireTheme()
    const lightValue = getSemanticSlotValue(themeData.light.semantic, slot)
    const darkValue = getSemanticSlotValue(themeData.dark.semantic, slot)
    const path = `semantic.${slot.category}.${slot.key}`
    switch (target.mode) {
      case "light":
        if (lightValue === undefined) {
          throw new ConfigError(`invalid mapping file ${source}: ${where}: light.${path} must be set`)
        }
        break
      case "dark":
        if (darkValue === undefined) {
          throw new ConfigError(`invalid mapping file ${source}: ${where}: dark.${path} must be set`)
        }
        break
      case "static":
        if (lightValue === undefined || darkValue === undefined || lightValue !== darkValue) {
          throw new ConfigError(
            `invalid mapping file ${source}: ${where}: a static rule needs one value — ` +
            `set equal light.${path} and dark.${path}`,
          )
        }
        break
    }
  }
}

/**
 * semanticCanaries reach CDP verification (tto-6ia.8), which reads
 * `getComputedStyle(documentElement)`. Every token must therefore carry
 * registry evidence and be root-scoped (plan §4, T-SCH-14).
 */
function validateSemanticCanaries(mapping: MappingConfig, source: string): void {
  for (const token of mapping.semanticCanaries) {
    const slot = SEMANTIC_SLOT_BY_TOKEN.get(token)
    if (!slot) {
      throw new ConfigError(`invalid mapping file ${source}: semantic canary "${token}" has no registry evidence`)
    }
    if (!scopeClassIsRootScoped(slot.scopeClass)) {
      throw new ConfigError(
        `invalid mapping file ${source}: semantic canary "${token}" is component-scoped ` +
        `(${slot.scopeClass}, slot ${slot.id}) and is not observable on :root`,
      )
    }
  }
}

export async function loadTheme(path: string): Promise<DesktopTheme> {
  const parsed = desktopThemeSchema.safeParse(await readJson(path))
  if (!parsed.success) {
    throw new ConfigError(`invalid theme file ${path}:\n${describeIssues(parsed.error.issues)}`)
  }
  assertNoModeNestingInSemantic(parsed.data, `file ${path}`)
  try {
    return await resolveThemeBackgrounds(parsed.data, dirname(resolve(path)))
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new ConfigError(`invalid theme file ${path}: ${reason}`)
  }
}

/**
 * Parses a mapping file and cross-validates its semantic bindings.
 *
 * `theme` is the optional cross-validation input (plan §10): theme-classed
 * rule bindings consume the slot value of their mode, and static rules need
 * one equal light/dark value. When omitted, an empty `semanticBindings` array
 * loads unchanged; any binding fails with a ConfigError explaining that the
 * theme argument is required.
 */
export async function loadMapping(path: string, theme?: unknown): Promise<MappingConfig> {
  const parsed = mappingConfigSchema.safeParse(await readJson(path))
  if (!parsed.success) {
    throw new ConfigError(`invalid mapping file ${path}:\n${describeIssues(parsed.error.issues)}`)
  }
  validateSemanticBindings(parsed.data, path, theme)
  validateSemanticCanaries(parsed.data, path)
  return parsed.data
}

export interface CliOverrides {
  readonly theme?: string
  readonly preset?: string
  readonly mapping?: string
  readonly port?: number
  readonly exe?: string
  readonly watch?: boolean
}

export function buildAppConfig(root: string, overrides: CliOverrides): AppConfig {
  const parsed = appConfigSchema.safeParse({
    telemostExe: overrides.exe ?? findTelemost() ?? DEFAULT_TELEMOST_EXE,
    debugHost: "127.0.0.1",
    debugPort: overrides.port ?? 9333,
    themeFile: resolve(root, overrides.theme ?? "config/theme.json"),
    mappingFile: resolve(root, overrides.mapping ?? "config/mapping.json"),
    watch: overrides.watch ?? true,
    launchTimeoutMs: 45_000,
  })

  if (!parsed.success) {
    throw new ConfigError(`invalid runtime configuration:\n${describeIssues(parsed.error.issues)}`)
  }
  return parsed.data
}
