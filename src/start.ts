/**
 * telemost-start — launches Telemost with the custom theme applied.
 *
 * Flow:
 *   1. ensure %LOCALAPPDATA%\TelemostThemeOverride\{theme,config}.json exist
 *   2. start Telemost with Qt's DevTools server enabled (env var only —
 *      no Telemost file is ever touched)
 *   3. attach over CDP, inject the generated stylesheet
 *   4. stay attached and re-apply on navigation, until Telemost exits
 *
 * Closing this process does not close Telemost; it only stops re-applying.
 */

import { parseArgs } from "node:util"

import { bootstrap, BootstrapError, userConfigSchema, type ConsoleMode, type UserConfig } from "./bootstrap"
import { hideConsoleWindow, inspectConsole } from "./console-window"
import { appConfigSchema } from "./schema"
import { buildCss } from "./theme/generate"
import { CdpSession, waitForPageTarget, type CdpTarget } from "./cdp/client"
import { applyToLiveDocument, buildAgentSource, verify, waitForAppStyles } from "./inject"
import { isDebuggerUp, launchTelemost } from "./launcher"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import {
  exportPreset,
  formatPresetList,
  importPreset,
  listPresets,
  PresetError,
  savePreset,
  setActivePreset,
} from "./presets"
import { appConfigFilePath, themeFilePath } from "./paths"

const HELP = `telemost-start — Telemost with a custom theme

Usage:
  telemost-start                          launch Telemost, apply active theme, keep it applied
  telemost-start --preset <name|path>     launch with specified theme preset or JSON file
  telemost-start --list-presets           list all available built-in and user presets
  telemost-start --set-preset <name>      set the default active preset in config.json
  telemost-start --save-preset <name>     save current theme.json as a new preset
  telemost-start --import-preset <path>   import a theme JSON file into presets folder
  telemost-start --export-preset <name>   export self-contained theme JSON (with --out <path>)
  telemost-start --once                   apply once and exit (Telemost keeps running)
  telemost-start --where                  print the config file locations and exit
  telemost-start --help                   this text

Configuration lives in:
  %LOCALAPPDATA%\\TelemostThemeOverride\\theme.json    current custom colors
  %LOCALAPPDATA%\\TelemostThemeOverride\\presets\\     user presets directory
  %LOCALAPPDATA%\\TelemostThemeOverride\\config.json   Telemost path, port, console, active preset

Both files are created on first run and never overwritten afterwards.
Delete a file to regenerate it with defaults.

config.json -> "hideConsole":
  "auto"    (default) hide this window once the theme is applied,
            keep it open if something needs reading
  "always"  hide it regardless
  "never"   always keep it visible

A console that belongs to an existing terminal is never hidden.
`

function isTelemostPage(target: CdpTarget): boolean {
  return target.url.startsWith("ychat://") || target.url.includes("telemost")
}

/**
 * Applies the configured console policy.
 *
 * `auto` keeps the window when something needs reading — that is the whole
 * reason this is done at runtime rather than via `--windows-hide-console`,
 * which would make failures invisible.
 */
function applyConsolePolicy(mode: ConsoleMode, succeeded: boolean): void {
  if (mode === "never") return
  if (mode === "auto" && !succeeded) {
    console.log("\n(console kept open because of the warning above; set hideConsole to \"always\" to suppress)")
    return
  }
  hideConsoleWindow()
}

function toAppConfig(config: UserConfig, themePath: string): ReturnType<typeof appConfigSchema.parse> {
  return appConfigSchema.parse({
    telemostExe: config.telemostExe,
    debugHost: "127.0.0.1",
    debugPort: config.debugPort,
    themeFile: themePath,
    mappingFile: "<compiled-in>",
    watch: config.watch,
    launchTimeoutMs: config.launchTimeoutSeconds * 1000,
  })
}

/**
 * Resolves once Telemost is gone, so the launcher can exit with it instead of
 * lingering as an orphan in the background.
 */
async function waitForTelemostExit(host: string, port: number, signal: AbortSignal): Promise<void> {
  let misses = 0
  while (!signal.aborted) {
    await new Promise((resolve) => setTimeout(resolve, 3_000))
    if (signal.aborted) return
    // Two consecutive misses to ride out a momentary hiccup.
    misses = (await isDebuggerUp(host, port)) ? 0 : misses + 1
    if (misses >= 2) return
  }
}

async function run(once: boolean, preset?: string): Promise<void> {
  const boot = await bootstrap(process.env, { preset })

  if (boot.createdTheme || boot.createdConfig) {
    console.log(`Created configuration in ${boot.directory}`)
    if (boot.createdTheme) {
      if (boot.activePresetName) {
        console.log(`  theme.json   colors (active preset "${boot.activePresetName}" overrides theme.json; switch back: --set-preset custom)`)
      } else {
        console.log(`  theme.json   colors — edit to taste`)
      }
    }
    if (boot.createdConfig) console.log(`  config.json  detected ${boot.config.telemostExe}`)
    console.log(`  presets/     custom presets directory`)
    console.log("")
  }

  const appConfig = toAppConfig(boot.config, boot.themePath)
  const css = buildCss({ theme: boot.theme, mapping: boot.mapping })

  if (boot.activePresetName) {
    console.log(`theme    : ${boot.theme.name} (${boot.theme.id}) [active preset: "${boot.activePresetName}" — theme.json is ignored; switch back: --set-preset custom]`)
  } else {
    console.log(`theme    : ${boot.theme.name} (${boot.theme.id})`)
  }

  const launch = await launchTelemost(appConfig, {
    onRestart: () =>
      console.log("Telemost : already running without debugging — restarting it so the theme can attach"),
  })

  console.log(
    launch.alreadyRunning
      ? `Telemost : already running with debugging on port ${appConfig.debugPort}`
      : `Telemost : ${launch.restarted ? "restarted" : "starting"} (pid ${launch.pid ?? "unknown"})`,
  )

  const target = await waitForPageTarget(
    appConfig.debugHost,
    appConfig.debugPort,
    isTelemostPage,
    appConfig.launchTimeoutMs,
  )

  const wsUrl = target.webSocketDebuggerUrl
  if (!wsUrl) throw new Error("Telemost page target exposes no debugger websocket")

  const session = await CdpSession.connect(wsUrl)

  try {
    await session.send("Page.enable")
    await session.send("Runtime.enable")
    await session.addScriptOnNewDocument(buildAgentSource(css))
    await applyToLiveDocument(session, css)

    // On a cold start the page target exists before Telemost has parsed any
    // CSS. Verifying too early reports everything as missing, so wait for the
    // app's own stylesheets to come up first.
    const styled = await waitForAppStyles(session, boot.mapping, 30_000)
    if (!styled) {
      console.log("applied  : stylesheet injected (Telemost still loading, could not verify)")
      applyConsolePolicy(boot.config.hideConsole, false)
      return
    }

    // Re-assert now that Telemost's stylesheets exist: the app may have
    // appended its own <style> nodes after ours during startup.
    await applyToLiveDocument(session, css)

    const report = await verify(session, boot.mapping)
    console.log(`applied  : ${Object.keys(report.resolved).length} brand tokens repainted`)

    const clean = report.missing.length === 0
    if (!clean) {
      console.warn(`\nWARNING: ${report.missing.length} expected token(s) missing:`)
      for (const token of report.missing) console.warn(`  ${token}`)
      console.warn("Telemost may have changed its design tokens; the theme may be partial.")
      process.exitCode = 2
    }

    if (once || !appConfig.watch) {
      applyConsolePolicy(boot.config.hideConsole, clean)
      return
    }

    console.log("Watching for navigation. Close Telemost (or press Ctrl+C) to stop.")
    applyConsolePolicy(boot.config.hideConsole, clean)

    const controller = new AbortController()
    session.on("Page.frameNavigated", () => {
      void applyToLiveDocument(session, css).catch(() => {
        /* transient during navigation; the persistent script still covers it */
      })
    })

    const interrupted = new Promise<void>((resolve) => {
      const stop = (): void => {
        controller.abort()
        resolve()
      }
      process.once("SIGINT", stop)
      process.once("SIGTERM", stop)
    })

    await Promise.race([waitForTelemostExit(appConfig.debugHost, appConfig.debugPort, controller.signal), interrupted])
    controller.abort()
  } finally {
    session.close()
  }
}

export const START_CLI_OPTIONS = {
  once: { type: "boolean", default: false },
  where: { type: "boolean", default: false },
  help: { type: "boolean", default: false },
  preset: { type: "string" },
  "list-presets": { type: "boolean", default: false },
  presets: { type: "boolean", default: false },
  "save-preset": { type: "string" },
  "import-preset": { type: "string" },
  "export-preset": { type: "string" },
  "set-preset": { type: "string" },
  out: { type: "string" },
} as const

export function parseStartArgs(args: string[]) {
  return parseArgs({
    args,
    options: START_CLI_OPTIONS,
  })
}

async function main(): Promise<void> {
  const { values } = parseStartArgs(process.argv.slice(2))

  if (values.help) {
    process.stdout.write(HELP)
    return
  }

  if (values["list-presets"] || values.presets) {
    const listResult = await listPresets()
    let active: string | undefined
    const configPath = appConfigFilePath()
    if (existsSync(configPath)) {
      try {
        const raw = await readFile(configPath, "utf8")
        const parsedJson = JSON.parse(raw)
        const parsed = userConfigSchema.safeParse(parsedJson)
        if (parsed.success) {
          if (parsed.data.preset) {
            active = parsed.data.preset.trim()
          }
        } else {
          console.warn(`warning: invalid config at ${configPath}:\n  ${parsed.error.message}`)
        }
      } catch (err) {
        console.warn(
          `warning: cannot read config file at ${configPath}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }
    console.log(formatPresetList(listResult, active))
    return
  }

  if (values["save-preset"]) {
    const nameOrId = values["save-preset"]
    const sourceTheme = themeFilePath()
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
    const result = await exportPreset(presetName, typeof values.out === "string" ? values.out : undefined)
    if (result.outPath) {
      console.log(`Exported preset "${result.preset.name}" to:\n  ${result.outPath}`)
    } else {
      process.stdout.write(result.exportedJson)
    }
    return
  }

  if (values["set-preset"]) {
    const presetName = values["set-preset"]
    const result = await setActivePreset(presetName)
    console.log(`Active preset set to "${result.preset}" in ${result.configPath}`)
    return
  }

  if (values.where) {
    const { configDir, themeFilePath, appConfigFilePath, presetsDir } = await import("./paths")
    const ownership = inspectConsole()
    console.log(`directory : ${configDir()}`)
    console.log(`theme     : ${themeFilePath()}`)
    console.log(`presets   : ${presetsDir()}`)
    console.log(`config    : ${appConfigFilePath()}`)
    console.log(
      `console   : ${ownership.hasConsole ? `${ownership.attachedProcesses} process(es) attached` : "none"}` +
        `${ownership.hasConsole ? (ownership.ownsConsole ? " — ours, hideable" : " — shared, will not hide") : ""}`,
    )
    return
  }

  await run(values.once, typeof values.preset === "string" ? values.preset : undefined)
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    if (error instanceof BootstrapError || error instanceof PresetError) {
      process.stderr.write(`\n${error.message}\n`)
    } else {
      process.stderr.write(`\nerror: ${error instanceof Error ? error.message : String(error)}\n`)
    }
    process.exitCode = 1
  })
}
