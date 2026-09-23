import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  bootstrap,
  consoleModeSchema,
  userConfigSchema,
  BootstrapError,
} from "./bootstrap"
import { DEFAULT_THEME } from "./defaults/theme"
import { DEFAULT_MAPPING } from "./defaults/mapping"
import { appConfigFilePath, configDir, presetsDir, themeFilePath } from "./paths"
import { savePreset } from "./presets"
import { desktopThemeSchema, type DesktopTheme } from "./schema"
import { buildCss } from "./theme/generate"

/* ------------------------------------------------------------------ *
 * Fixtures & Helpers
 * ------------------------------------------------------------------ */

const SEEDS = {
  neutral: "#4c4f69",
  primary: "#8839ef",
  success: "#40a02b",
  warning: "#df8e1d",
  error: "#d20f39",
  info: "#1e66f5",
  interactive: "#8839ef",
} as const

const ACCENT_SCALE = [
  "#faf4ff", "#f4e8ff", "#ebd5ff", "#dfbaff", "#cb90ff", "#b663ff",
  "#a238ff", "#8839ef", "#7225d3", "#5c1bb0", "#441188", "#2c0859",
] as const

function createDummyTheme(id = "dummy-theme", name = "Dummy Theme"): DesktopTheme {
  return desktopThemeSchema.parse({
    id,
    name,
    light: { seeds: SEEDS, accentScale: ACCENT_SCALE },
    dark: { seeds: SEEDS, accentScale: ACCENT_SCALE },
  })
}

/* ------------------------------------------------------------------ *
 * userConfigSchema & consoleModeSchema
 * ------------------------------------------------------------------ */

describe("userConfigSchema & consoleModeSchema", () => {
  test("consoleModeSchema accepts valid modes and rejects invalid values", () => {
    expect(consoleModeSchema.safeParse("auto").success).toBe(true)
    expect(consoleModeSchema.safeParse("always").success).toBe(true)
    expect(consoleModeSchema.safeParse("never").success).toBe(true)

    expect(consoleModeSchema.safeParse("sometimes").success).toBe(false)
    expect(consoleModeSchema.safeParse("").success).toBe(false)
    expect(consoleModeSchema.safeParse(null).success).toBe(false)
    expect(consoleModeSchema.safeParse(123).success).toBe(false)
  })

  test("userConfigSchema applies default values", () => {
    const parsed = userConfigSchema.parse({
      telemostExe: "C:\\Program Files\\Yandex\\YandexTelemost\\YandexTelemost.exe",
    })

    expect(parsed.telemostExe).toBe("C:\\Program Files\\Yandex\\YandexTelemost\\YandexTelemost.exe")
    expect(parsed.debugPort).toBe(9333)
    expect(parsed.watch).toBe(true)
    expect(parsed.launchTimeoutSeconds).toBe(45)
    expect(parsed.hideConsole).toBe("auto")
    expect(parsed.preset).toBeUndefined()
  })

  test("userConfigSchema validates port boundaries and required telemostExe", () => {
    // Valid custom values
    expect(
      userConfigSchema.safeParse({
        telemostExe: "C:\\Telemost.exe",
        debugPort: 1024,
        watch: false,
        launchTimeoutSeconds: 60,
        hideConsole: "never",
        preset: "nord",
      }).success,
    ).toBe(true)

    // Port out of bounds (< 1024 or > 65535)
    expect(userConfigSchema.safeParse({ telemostExe: "C:\\Telemost.exe", debugPort: 80 }).success).toBe(false)
    expect(userConfigSchema.safeParse({ telemostExe: "C:\\Telemost.exe", debugPort: 70000 }).success).toBe(false)

    // Empty telemostExe
    expect(userConfigSchema.safeParse({ telemostExe: "" }).success).toBe(false)
    expect(userConfigSchema.safeParse({}).success).toBe(false)
  })
})

/* ------------------------------------------------------------------ *
 * bootstrap() First Run & File Creation
 * ------------------------------------------------------------------ */

describe("bootstrap() first-run initialization and file creation", () => {
  let testDir: string
  let userAppData: string
  let programFilesDir: string
  let fakeTelemostExe: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `tto-bootstrap-init-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    userAppData = join(testDir, "appdata")
    programFilesDir = join(testDir, "ProgramFiles")
    await mkdir(userAppData, { recursive: true })
    await mkdir(programFilesDir, { recursive: true })

    // Create a dummy Telemost executable in Program Files candidate location:
    // %ProgramFiles%\Yandex\YandexTelemost\YandexTelemost.exe
    const telemostInstallDir = join(programFilesDir, "Yandex", "YandexTelemost")
    await mkdir(telemostInstallDir, { recursive: true })
    fakeTelemostExe = join(telemostInstallDir, "YandexTelemost.exe")
    await writeFile(fakeTelemostExe, "dummy executable content", "utf8")
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  test("creates config directory, presets directory, default theme.json and config.json on first run", async () => {
    const env: NodeJS.ProcessEnv = {
      LOCALAPPDATA: userAppData,
      ProgramFiles: programFilesDir,
    }

    const result = await bootstrap(env)

    expect(result.createdTheme).toBe(true)
    expect(result.createdConfig).toBe(true)
    expect(result.directory).toBe(configDir(env))
    expect(result.configPath).toBe(appConfigFilePath(env))
    expect(result.themePath).toBe(themeFilePath(env))
    expect(result.presetsPath).toBe(presetsDir(env))

    // Files exist on disk
    expect(existsSync(result.themePath)).toBe(true)
    expect(existsSync(result.configPath)).toBe(true)
    expect(existsSync(result.presetsPath)).toBe(true)

    // Theme content matches DEFAULT_THEME
    const savedTheme = JSON.parse(await readFile(result.themePath, "utf8")) as DesktopTheme
    expect(savedTheme.id).toBe(DEFAULT_THEME.id)
    expect(savedTheme.name).toBe(DEFAULT_THEME.name)

    // Config points to detected telemostExe
    const savedConfig = JSON.parse(await readFile(result.configPath, "utf8")) as { telemostExe: string }
    expect(savedConfig.telemostExe).toBe(fakeTelemostExe)

    // Mapping matches DEFAULT_MAPPING
    expect(result.mapping.ramps.length).toBe(DEFAULT_MAPPING.ramps.length)
    expect(result.activePresetName).toBeUndefined()
  })

  test("does not overwrite existing theme.json or config.json on subsequent runs", async () => {
    const env: NodeJS.ProcessEnv = {
      LOCALAPPDATA: userAppData,
      ProgramFiles: programFilesDir,
    }

    // First run creates defaults
    const firstResult = await bootstrap(env)
    expect(firstResult.createdTheme).toBe(true)
    expect(firstResult.createdConfig).toBe(true)

    // Modify user theme.json and config.json
    const customTheme = createDummyTheme("my-edited-theme", "My Edited Theme")
    await writeFile(firstResult.themePath, JSON.stringify(customTheme, null, 2), "utf8")

    const customConfig = {
      telemostExe: fakeTelemostExe,
      debugPort: 9888,
      watch: false,
      launchTimeoutSeconds: 20,
      hideConsole: "always",
    }
    await writeFile(firstResult.configPath, JSON.stringify(customConfig, null, 2), "utf8")

    // Second run
    const secondResult = await bootstrap(env)
    expect(secondResult.createdTheme).toBe(false)
    expect(secondResult.createdConfig).toBe(false)
    expect(secondResult.theme.id).toBe("my-edited-theme")
    expect(secondResult.config.debugPort).toBe(9888)
    expect(secondResult.config.watch).toBe(false)
  })

  test("throws BootstrapError on first run if Telemost executable cannot be found", async () => {
    const emptyProgramFiles = join(testDir, "empty-pf")
    await mkdir(emptyProgramFiles, { recursive: true })

    const env: NodeJS.ProcessEnv = {
      LOCALAPPDATA: userAppData,
      ProgramFiles: emptyProgramFiles,
      "ProgramFiles(x86)": emptyProgramFiles,
    }

    await expect(bootstrap(env)).rejects.toThrow(BootstrapError)
    await expect(bootstrap(env)).rejects.toThrow(/Could not find YandexTelemost\.exe in any known location/)
  })

  test("throws BootstrapError if configured telemostExe does not exist on disk", async () => {
    const env: NodeJS.ProcessEnv = {
      LOCALAPPDATA: userAppData,
    }
    const confDir = configDir(env)
    await mkdir(confDir, { recursive: true })

    const nonExistentExe = join(testDir, "ghost", "Telemost.exe")
    await writeFile(
      appConfigFilePath(env),
      JSON.stringify({ telemostExe: nonExistentExe }, null, 2),
      "utf8",
    )
    await writeFile(
      themeFilePath(env),
      JSON.stringify(DEFAULT_THEME, null, 2),
      "utf8",
    )

    await expect(bootstrap(env)).rejects.toThrow(BootstrapError)
    await expect(bootstrap(env)).rejects.toThrow(/Telemost executable not found at/)
  })
})

/* ------------------------------------------------------------------ *
 * bootstrap() Theme & Preset Resolution
 * ------------------------------------------------------------------ */

describe("bootstrap() theme and preset resolution", () => {
  let testDir: string
  let userAppData: string
  let fakeTelemostExe: string
  let env: NodeJS.ProcessEnv

  beforeEach(async () => {
    testDir = join(tmpdir(), `tto-bootstrap-preset-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    userAppData = join(testDir, "appdata")
    await mkdir(userAppData, { recursive: true })

    fakeTelemostExe = join(testDir, "YandexTelemost.exe")
    await writeFile(fakeTelemostExe, "fake executable content", "utf8")

    env = { LOCALAPPDATA: userAppData }

    // Seed valid config.json and theme.json
    const confDir = configDir(env)
    await mkdir(confDir, { recursive: true })
    await writeFile(
      appConfigFilePath(env),
      JSON.stringify({ telemostExe: fakeTelemostExe }, null, 2),
      "utf8",
    )
    await writeFile(
      themeFilePath(env),
      JSON.stringify(DEFAULT_THEME, null, 2),
      "utf8",
    )
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  test("loads theme.json when no preset is specified in config or options", async () => {
    const result = await bootstrap(env)

    expect(result.theme.id).toBe(DEFAULT_THEME.id)
    expect(result.theme.name).toBe(DEFAULT_THEME.name)
    expect(result.themePath).toBe(themeFilePath(env))
    expect(result.activePresetName).toBeUndefined()
  })

  test("loads theme.json when config preset is 'custom' or empty", async () => {
    // preset: 'custom'
    await writeFile(
      appConfigFilePath(env),
      JSON.stringify({ telemostExe: fakeTelemostExe, preset: "custom" }, null, 2),
      "utf8",
    )
    const resCustom = await bootstrap(env)
    expect(resCustom.theme.id).toBe(DEFAULT_THEME.id)
    expect(resCustom.activePresetName).toBeUndefined()

    // preset: '   ' (whitespace)
    await writeFile(
      appConfigFilePath(env),
      JSON.stringify({ telemostExe: fakeTelemostExe, preset: "   " }, null, 2),
      "utf8",
    )
    const resWhitespace = await bootstrap(env)
    expect(resWhitespace.theme.id).toBe(DEFAULT_THEME.id)
    expect(resWhitespace.activePresetName).toBeUndefined()
  })

  test("resolves preset specified in config.json", async () => {
    await writeFile(
      appConfigFilePath(env),
      JSON.stringify({ telemostExe: fakeTelemostExe, preset: "nord" }, null, 2),
      "utf8",
    )

    const result = await bootstrap(env)

    expect(result.theme.id).toBe("nord")
    expect(result.theme.name).toBe("Nord Frost")
    expect(result.activePresetName).toBe("Nord Frost")
    expect(result.config.preset).toBe("nord")
  })

  test("options.preset overrides config.json preset", async () => {
    await writeFile(
      appConfigFilePath(env),
      JSON.stringify({ telemostExe: fakeTelemostExe, preset: "dracula" }, null, 2),
      "utf8",
    )

    const result = await bootstrap(env, { preset: "emerald" })

    expect(result.theme.id).toBe("emerald")
    expect(result.theme.name).toBe("Cyberpunk Emerald")
    expect(result.activePresetName).toBe("Cyberpunk Emerald")
  })

  test("resolves custom user preset created in presets directory", async () => {
    const customUserTheme = createDummyTheme("custom-neon", "Custom Neon City")
    await savePreset(customUserTheme, "custom-neon", { env })

    const result = await bootstrap(env, { preset: "custom-neon" })

    expect(result.theme.id).toBe("custom-neon")
    expect(result.theme.name).toBe("Custom Neon City")
    expect(result.activePresetName).toBe("Custom Neon City")
    expect(result.themePath).toBe(join(presetsDir(env), "custom-neon.json"))
  })

  test("resolves direct file path passed in options.preset", async () => {
    const standaloneDir = join(testDir, "standalone")
    await mkdir(standaloneDir, { recursive: true })
    const directTheme = createDummyTheme("direct-file-theme", "Direct File Theme")
    const filePath = join(standaloneDir, "my-theme.json")
    await writeFile(filePath, JSON.stringify(directTheme, null, 2), "utf8")

    const result = await bootstrap(env, { preset: filePath })

    expect(result.theme.id).toBe("direct-file-theme")
    expect(result.theme.name).toBe("Direct File Theme")
    expect(result.themePath).toBe(filePath)
    expect(result.activePresetName).toBe("Direct File Theme")
  })

  test("throws BootstrapError when requested preset cannot be resolved", async () => {
    await expect(bootstrap(env, { preset: "ghost-preset-not-found" })).rejects.toThrow(
      BootstrapError,
    )
    await expect(bootstrap(env, { preset: "ghost-preset-not-found" })).rejects.toThrow(
      /Preset "ghost-preset-not-found" not found/,
    )
  })

  test("end-to-end: resolves local background images from theme.json to data URIs in buildCss", async () => {
    const confDir = configDir(env)
    const bgPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
    ])
    await writeFile(join(confDir, "bg.png"), bgPng)

    const themed = {
      ...DEFAULT_THEME,
      backgrounds: {
        chat: "bg.png",
      },
    }
    await writeFile(themeFilePath(env), JSON.stringify(themed, null, 2), "utf8")

    const result = await bootstrap(env)
    expect(result.theme.backgrounds?.chat).toBeDefined()

    const css = buildCss({ theme: result.theme, mapping: result.mapping })
    expect(css).toContain("data:image/png;base64,")
    expect(css).not.toContain('url("bg.png")')
  })

  test("throws BootstrapError when local background image file in theme.json does not exist", async () => {
    const themed = {
      ...DEFAULT_THEME,
      backgrounds: {
        chat: "missing-bg.png",
      },
    }
    await writeFile(themeFilePath(env), JSON.stringify(themed, null, 2), "utf8")

    await expect(bootstrap(env)).rejects.toThrow(BootstrapError)
    await expect(bootstrap(env)).rejects.toThrow(/cannot resolve background images for theme/)
  })
})

/* ------------------------------------------------------------------ *
 * bootstrap() Configuration Validation & Corrupt File Handling
 * ------------------------------------------------------------------ */

describe("bootstrap() configuration validation & corrupt file handling", () => {
  let testDir: string
  let userAppData: string
  let fakeTelemostExe: string
  let env: NodeJS.ProcessEnv

  beforeEach(async () => {
    testDir = join(tmpdir(), `tto-bootstrap-errors-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    userAppData = join(testDir, "appdata")
    await mkdir(userAppData, { recursive: true })

    fakeTelemostExe = join(testDir, "YandexTelemost.exe")
    await writeFile(fakeTelemostExe, "fake executable content", "utf8")

    env = { LOCALAPPDATA: userAppData }
    const confDir = configDir(env)
    await mkdir(confDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  test("throws BootstrapError when config.json is invalid JSON", async () => {
    await writeFile(appConfigFilePath(env), "{ corrupt: json", "utf8")
    await writeFile(themeFilePath(env), JSON.stringify(DEFAULT_THEME), "utf8")

    await expect(bootstrap(env)).rejects.toThrow(BootstrapError)
    await expect(bootstrap(env)).rejects.toThrow(/is not valid JSON[\s\S]*Delete the file to regenerate it with defaults/)
  })

  test("throws BootstrapError when config.json fails schema validation", async () => {
    // debugPort is invalid string
    await writeFile(
      appConfigFilePath(env),
      JSON.stringify({ telemostExe: fakeTelemostExe, debugPort: "not-a-port" }),
      "utf8",
    )
    await writeFile(themeFilePath(env), JSON.stringify(DEFAULT_THEME), "utf8")

    await expect(bootstrap(env)).rejects.toThrow(BootstrapError)
    await expect(bootstrap(env)).rejects.toThrow(/is not a valid config file/)
  })

  test("throws BootstrapError when theme.json is invalid JSON", async () => {
    await writeFile(
      appConfigFilePath(env),
      JSON.stringify({ telemostExe: fakeTelemostExe }),
      "utf8",
    )
    await writeFile(themeFilePath(env), "invalid { json", "utf8")

    await expect(bootstrap(env)).rejects.toThrow(BootstrapError)
    await expect(bootstrap(env)).rejects.toThrow(/is not valid JSON[\s\S]*Delete the file to regenerate it with defaults/)
  })

  test("throws BootstrapError when theme.json fails schema validation", async () => {
    await writeFile(
      appConfigFilePath(env),
      JSON.stringify({ telemostExe: fakeTelemostExe }),
      "utf8",
    )
    // Missing seeds
    await writeFile(
      themeFilePath(env),
      JSON.stringify({ name: "Broken Theme", id: "broken" }),
      "utf8",
    )

    await expect(bootstrap(env)).rejects.toThrow(BootstrapError)
    await expect(bootstrap(env)).rejects.toThrow(/is not a valid theme file/)
  })
})
