import { parseArgs } from "node:util"
import { writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { buildAppConfig, loadMapping, loadTheme, ConfigError } from "./config"
import { buildCss } from "./theme/generate"
import { CdpSession, fetchVersion, waitForPageTarget, type CdpTarget } from "./cdp/client"
import { applyToLiveDocument, buildAgentSource, verify, waitForAppStyles } from "./inject"
import { isDebuggerUp, launchTelemost } from "./launcher"
import {
  exportPreset,
  formatPresetList,
  importPreset,
  listPresets,
  PresetError,
  resolvePreset,
  savePreset,
} from "./presets"
import type { DesktopTheme } from "./schema"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const HELP = `telemost-theme-override

Repaints Yandex Telemost with a shuvcode theme. Telemost's own files are never
modified — the stylesheet is injected at runtime over Qt WebEngine's DevTools
protocol, which Telemost exposes through the stock QTWEBENGINE_REMOTE_DEBUGGING
environment variable.

Usage:
  bun run apply                 launch Telemost (if needed), inject, keep watching
  bun run apply -- --once       inject and exit
  bun run build-css             print the generated CSS, touch nothing
  bun run doctor                report what is currently running and resolvable
  bun run main.ts presets       list available presets

Options:
  --preset <name>   use theme preset (e.g. nord, tokyo-night, emerald, etc.)
  --theme <path>    seed colors file (default: config/theme.json)
  --mapping <path>  token mapping (default: config/mapping.json)
  --port <number>   CDP port on 127.0.0.1 (default: 9333)
  --exe <path>      Telemost executable
  --out <path>      with build-css/export: write to a file instead of stdout
  --list-presets    list available presets
  --save-preset <n> save current theme as a preset
  --import-preset <p> import a theme JSON file
  --export-preset <n> export self-contained theme JSON
  --once            do not stay attached
  --help            this text
`

function isTelemostPage(target: CdpTarget): boolean {
  return target.url.startsWith("ychat://") || target.url.includes("telemost")
}

async function resolveTheme(overrides: ReturnType<typeof readOverrides>, defaultThemeFile: string): Promise<DesktopTheme> {
  if (overrides.preset) {
    const resolved = await resolvePreset(overrides.preset, { repoDir: ROOT })
    return resolved.theme
  }
  return loadTheme(defaultThemeFile)
}

async function commandBuildCss(overrides: ReturnType<typeof readOverrides>, out: string | undefined): Promise<void> {
  const config = buildAppConfig(ROOT, overrides)
  // The parsed theme cross-validates rule bindings (plan §10 per-mode value
  // presence), so it must load before the mapping.
  const theme = await resolveTheme(overrides, config.themeFile)
  const mapping = await loadMapping(config.mappingFile, theme)
  const css = buildCss({ theme, mapping })

  if (out) {
    await writeFile(resolve(ROOT, out), css, "utf8")
    console.log(`wrote ${css.length} bytes to ${out}`)
  } else {
    process.stdout.write(css)
  }
}

async function commandDoctor(overrides: ReturnType<typeof readOverrides>): Promise<void> {
  const config = buildAppConfig(ROOT, overrides)
  const up = await isDebuggerUp(config.debugHost, config.debugPort)
  console.log(`CDP endpoint  : http://${config.debugHost}:${config.debugPort} — ${up ? "reachable" : "not reachable"}`)

  if (!up) {
    console.log("\nTelemost is not running with remote debugging enabled.")
    console.log("Run `bun run apply` to start it correctly.")
    return
  }

  const version = await fetchVersion(config.debugHost, config.debugPort)
  console.log(`browser       : ${version.Browser}`)
  console.log(`CDP protocol  : ${version["Protocol-Version"]}`)

  const target = await waitForPageTarget(config.debugHost, config.debugPort, isTelemostPage, 5_000)
  console.log(`page target   : ${target.url}`)

  const session = await CdpSession.connect(target.webSocketDebuggerUrl ?? "")
  try {
    // Bindings are cross-validated against the theme, so load it first.
    const theme = await resolveTheme(overrides, config.themeFile)
    const mapping = await loadMapping(config.mappingFile, theme)
    const report = await verify(session, mapping)
    console.log(`root classes  : ${report.rootClasses}`)
    console.log(`override tag  : ${report.styleTagPresent ? "present" : "absent"}`)
    console.log("\nresolved tokens:")
    for (const [token, value] of Object.entries(report.resolved)) {
      console.log(`  ${token.padEnd(38)} ${value}`)
    }
    if (report.missing.length > 0) {
      console.log("\nMISSING tokens (Telemost may have renamed them):")
      for (const token of report.missing) console.log(`  ${token}`)
    }
  } finally {
    session.close()
  }
}

async function commandApply(overrides: ReturnType<typeof readOverrides>, once: boolean): Promise<void> {
  const config = buildAppConfig(ROOT, overrides)
  const theme = await resolveTheme(overrides, config.themeFile)
  const mapping = await loadMapping(config.mappingFile, theme)
  const css = buildCss({ theme, mapping })
  const presetLabel = overrides.preset ? ` [preset: ${overrides.preset}]` : ""
  console.log(`theme         : ${theme.name} (${theme.id})${presetLabel}`)

  const launch = await launchTelemost(config, {
    onRestart: () => console.log("Telemost      : running without debugging — restarting to attach"),
  })

  console.log(
    launch.alreadyRunning
      ? `Telemost      : already running with debugging on port ${config.debugPort}`
      : `Telemost      : ${launch.restarted ? "restarted" : "started"} (pid ${launch.pid ?? "unknown"})`,
  )

  const target = await waitForPageTarget(config.debugHost, config.debugPort, isTelemostPage, config.launchTimeoutMs)
  console.log(`page target   : ${target.url}`)

  const wsUrl = target.webSocketDebuggerUrl
  if (!wsUrl) throw new Error("target has no webSocketDebuggerUrl")

  const session = await CdpSession.connect(wsUrl)

  try {
    await session.send("Page.enable")
    await session.send("Runtime.enable")

    // Survives reloads and in-app navigation.
    const identifier = await session.addScriptOnNewDocument(buildAgentSource(css))
    // And take effect on the document that is already on screen.
    await applyToLiveDocument(session, css)
    console.log(`injected      : persistent script ${identifier} + live document`)

    // The page target shows up before Telemost parses its CSS; verifying in
    // that window reports every token missing even though injection worked.
    const styled = await waitForAppStyles(session, mapping, 30_000)
    if (styled) await applyToLiveDocument(session, css)
    else console.warn("note          : Telemost still loading; verification may be incomplete")

    const report = await verify(session, mapping)
    console.log(`root classes  : ${report.rootClasses}`)
    console.log(`override tag  : ${report.styleTagPresent ? "present" : "absent"}`)

    const sample = Object.entries(report.resolved).slice(0, 6)
    for (const [token, value] of sample) console.log(`  ${token.padEnd(38)} ${value}`)

    if (report.missing.length > 0) {
      console.warn(`\nWARNING: ${report.missing.length} expected token(s) are missing:`)
      for (const token of report.missing) console.warn(`  ${token}`)
      console.warn("Telemost likely renamed them. Update config/mapping.json.")
      process.exitCode = 2
    }

    if (once || !config.watch) return

    console.log("\nAttached. Re-applies on every navigation. Ctrl+C to detach (Telemost keeps running).")
    session.on("Page.frameNavigated", () => {
      void applyToLiveDocument(session, css).catch((error: unknown) => {
        console.warn(`re-apply failed: ${error instanceof Error ? error.message : String(error)}`)
      })
    })

    await new Promise<void>((resolvePromise) => {
      const stop = (): void => resolvePromise()
      process.once("SIGINT", stop)
      process.once("SIGTERM", stop)
    })
  } finally {
    session.close()
  }
}

export const MAIN_CLI_OPTIONS = {
  theme: { type: "string" },
  preset: { type: "string" },
  mapping: { type: "string" },
  port: { type: "string" },
  exe: { type: "string" },
  out: { type: "string" },
  "list-presets": { type: "boolean", default: false },
  presets: { type: "boolean", default: false },
  "save-preset": { type: "string" },
  "import-preset": { type: "string" },
  "export-preset": { type: "string" },
  once: { type: "boolean", default: false },
  help: { type: "boolean", default: false },
} as const

export function parseMainArgs(args: string[]) {
  return parseArgs({
    args,
    allowPositionals: true,
    options: MAIN_CLI_OPTIONS,
  })
}

export function readOverrides(values: Record<string, string | boolean | undefined>): {
  theme?: string
  preset?: string
  mapping?: string
  port?: number
  exe?: string
  watch?: boolean
} {
  const port = typeof values.port === "string" ? Number.parseInt(values.port, 10) : undefined
  if (port !== undefined && Number.isNaN(port)) throw new ConfigError("--port must be a number")

  return {
    theme: typeof values.theme === "string" ? values.theme : undefined,
    preset: typeof values.preset === "string" ? values.preset : undefined,
    mapping: typeof values.mapping === "string" ? values.mapping : undefined,
    port,
    exe: typeof values.exe === "string" ? values.exe : undefined,
    watch: values.once === true ? false : undefined,
  }
}

async function main(): Promise<void> {
  const { values, positionals } = parseMainArgs(process.argv.slice(2))

  if (values.help) {
    process.stdout.write(HELP)
    return
  }

  if (values["list-presets"] || values.presets || positionals[0] === "presets") {
    const presets = await listPresets({ repoDir: ROOT })
    console.log(formatPresetList(presets))
    return
  }

  if (values["save-preset"]) {
    const nameOrId = values["save-preset"]
    const sourceTheme = resolve(ROOT, typeof values.theme === "string" ? values.theme : "config/theme.json")
    const result = await savePreset(sourceTheme, nameOrId)
    console.log(`Saved theme as preset "${result.preset.name}" (${result.preset.id}):\n  ${result.path}`)
    return
  }

  if (values["import-preset"]) {
    const sourceFile = values["import-preset"]
    const result = await importPreset(sourceFile)
    console.log(`Imported preset "${result.preset.name}" (${result.preset.id}):\n  ${result.path}`)
    return
  }

  if (values["export-preset"]) {
    const presetName = values["export-preset"]
    const result = await exportPreset(
      presetName,
      typeof values.out === "string" ? values.out : undefined,
      { repoDir: ROOT },
    )
    if (result.outPath) {
      console.log(`Exported preset "${result.preset.name}" to:\n  ${result.outPath}`)
    } else {
      process.stdout.write(result.exportedJson)
    }
    return
  }

  const command = positionals[0] ?? "apply"
  const overrides = readOverrides(values)

  switch (command) {
    case "apply":
      await commandApply(overrides, values.once === true)
      return
    case "build-css":
      await commandBuildCss(overrides, typeof values.out === "string" ? values.out : undefined)
      return
    case "doctor":
      await commandDoctor(overrides)
      return
    default:
      process.stderr.write(`unknown command: ${command}\n\n${HELP}`)
      process.exitCode = 1
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    if (error instanceof ConfigError || error instanceof PresetError) {
      process.stderr.write(`\nerror: ${error.message}\n`)
    } else {
      const message = error instanceof Error ? error.message : String(error)
      process.stderr.write(`\nerror: ${message}\n`)
    }
    process.exitCode = 1
  })
}
