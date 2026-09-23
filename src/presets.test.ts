import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import {
  exportPreset,
  formatPresetList,
  importPreset,
  listPresets,
  normalizePresetId,
  PresetError,
  readThemeFile,
  resolvePreset,
  savePreset,
  setActivePreset,
  type PresetInfo,
} from "./presets"
import { BUILTIN_PRESETS } from "./defaults/presets"
import { DEFAULT_MAPPING } from "./defaults/mapping"
import { desktopThemeSchema, mappingConfigSchema, type DesktopTheme } from "./schema"
import { buildAppConfig } from "./config"
import { buildCss } from "./theme/generate"
import { userConfigSchema, type UserConfig } from "./bootstrap"
import { appConfigFilePath, presetsDir } from "./paths"

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

const SAMPLE_1PX_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
])

/* ------------------------------------------------------------------ *
 * normalizePresetId
 * ------------------------------------------------------------------ */

describe("normalizePresetId", () => {
  test("lowercases and converts spaces and special characters to hyphens", () => {
    expect(normalizePresetId("Nord Frost")).toBe("nord-frost")
    expect(normalizePresetId("Tokyo Night")).toBe("tokyo-night")
    expect(normalizePresetId("Catppuccin Mocha & Latte")).toBe("catppuccin-mocha-latte")
    expect(normalizePresetId("Cyberpunk_Emerald_v2.0")).toBe("cyberpunk-emerald-v2-0")
  })

  test("strips .json extension (case-insensitively)", () => {
    expect(normalizePresetId("nord.json")).toBe("nord")
    expect(normalizePresetId("TOKYO-NIGHT.JSON")).toBe("tokyo-night")
    expect(normalizePresetId("custom-theme.Json")).toBe("custom-theme")
  })

  test("collapses multiple consecutive non-alphanumeric characters and trims hyphens", () => {
    expect(normalizePresetId("  --nord---arctic--  ")).toBe("nord-arctic")
    expect(normalizePresetId("dracula...vampire///2026")).toBe("dracula-vampire-2026")
    expect(normalizePresetId("__emerald__")).toBe("emerald")
  })

  test("supports Unicode characters such as Cyrillic", () => {
    expect(normalizePresetId("Моя тема")).toBe("моя-тема")
    expect(normalizePresetId("Розовая Сакура 2026")).toBe("розовая-сакура-2026")
  })

  test("throws on empty strings or all-special strings", () => {
    expect(() => normalizePresetId("")).toThrow(PresetError)
    expect(() => normalizePresetId("   ")).toThrow(PresetError)
    expect(() => normalizePresetId("!@#$%^&*()")).toThrow(PresetError)
    expect(() => normalizePresetId("---")).toThrow(PresetError)
  })
})

/* ------------------------------------------------------------------ *
 * formatPresetList
 * ------------------------------------------------------------------ */

describe("formatPresetList", () => {
  const dummyPresets: PresetInfo[] = [
    {
      id: "dracula",
      name: "Dracula Vampire",
      source: "builtin",
      theme: createDummyTheme("dracula", "Dracula Vampire"),
    },
    {
      id: "nord",
      name: "Nord Frost",
      source: "builtin",
      theme: createDummyTheme("nord", "Nord Frost"),
    },
    {
      id: "custom-user",
      name: "Custom User Theme",
      source: "user",
      path: "C:\\AppData\\presets\\custom-user.json",
      theme: createDummyTheme("custom-user", "Custom User Theme"),
    },
  ]

  test("renders formatted table with header, column headers, separator, and usage guide", () => {
    const formatted = formatPresetList(dummyPresets)

    expect(formatted).toContain("Available theme presets:")
    expect(formatted).toContain("ID")
    expect(formatted).toContain("NAME")
    expect(formatted).toContain("SOURCE")
    expect(formatted).toContain("ACCENT")
    expect(formatted).toContain("----------------------------------------------------------------------")
    expect(formatted).toContain("dracula")
    expect(formatted).toContain("Dracula Vampire")
    expect(formatted).toContain("[builtin]")
    expect(formatted).toContain("nord")
    expect(formatted).toContain("Nord Frost")
    expect(formatted).toContain("custom-user")
    expect(formatted).toContain("Custom User Theme")
    expect(formatted).toContain("[user]")
    expect(formatted).toContain("Usage:")
    expect(formatted).toContain("--preset <id|path>")
    expect(formatted).toContain("--set-preset <id>")
  })

  test("highlights the active preset with '* ' marker when matched by ID or Name", () => {
    // Match by ID
    const formattedById = formatPresetList(dummyPresets, "nord")
    const linesById = formattedById.split("\n")
    const nordLine = linesById.find((line) => line.includes("nord"))
    const draculaLine = linesById.find((line) => line.includes("dracula"))

    expect(nordLine).toStartWith("* ")
    expect(draculaLine).toStartWith("  ")

    // Match by Name
    const formattedByName = formatPresetList(dummyPresets, "Dracula Vampire")
    const linesByName = formattedByName.split("\n")
    const nordLine2 = linesByName.find((line) => line.includes("nord"))
    const draculaLine2 = linesByName.find((line) => line.includes("dracula"))

    expect(draculaLine2).toStartWith("* ")
    expect(nordLine2).toStartWith("  ")
  })

  test("extracts accent from seeds.interactive or seeds.primary", () => {
    const customTheme = createDummyTheme("accent-test", "Accent Test")
    const themeWithPrimaryOnly = desktopThemeSchema.parse({
      ...customTheme,
      dark: {
        ...customTheme.dark,
        seeds: {
          ...customTheme.dark.seeds,
          primary: "#123456",
          interactive: "#123456",
        },
      },
    })
    const presets: PresetInfo[] = [
      {
        id: "accent-test",
        name: "Accent Test",
        source: "builtin",
        theme: themeWithPrimaryOnly,
      },
    ]

    const formatted = formatPresetList(presets)
    expect(formatted).toContain("#123456")
  })
})

/* ------------------------------------------------------------------ *
 * readThemeFile
 * ------------------------------------------------------------------ */

describe("readThemeFile", () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `tto-read-theme-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  test("successfully reads and parses a valid theme file", async () => {
    const validTheme = createDummyTheme("test-theme", "Test Theme")
    const filePath = join(testDir, "valid-theme.json")
    await writeFile(filePath, JSON.stringify(validTheme, null, 2), "utf8")

    const loaded = await readThemeFile(filePath)
    expect(loaded.id).toBe("test-theme")
    expect(loaded.name).toBe("Test Theme")
    expect(loaded.light.seeds.primary).toBe(SEEDS.primary)
  })

  test("throws PresetError when file does not exist", async () => {
    const missingPath = join(testDir, "does-not-exist.json")
    await expect(readThemeFile(missingPath)).rejects.toThrow(PresetError)
    await expect(readThemeFile(missingPath)).rejects.toThrow(/cannot read theme file/)
  })

  test("throws PresetError when file contains invalid JSON", async () => {
    const corruptPath = join(testDir, "corrupt.json")
    await writeFile(corruptPath, "{ this is not json }", "utf8")

    await expect(readThemeFile(corruptPath)).rejects.toThrow(PresetError)
    await expect(readThemeFile(corruptPath)).rejects.toThrow(/is not valid JSON/)
  })

  test("throws PresetError when file has invalid theme schema", async () => {
    const invalidSchemaPath = join(testDir, "invalid-schema.json")
    await writeFile(invalidSchemaPath, JSON.stringify({ name: "Incomplete Theme" }), "utf8")

    await expect(readThemeFile(invalidSchemaPath)).rejects.toThrow(PresetError)
    await expect(readThemeFile(invalidSchemaPath)).rejects.toThrow(/is not a valid theme/)
  })

  test("resolves relative background image paths relative to the theme file location", async () => {
    const imagePath = join(testDir, "wallpaper.png")
    await writeFile(imagePath, SAMPLE_1PX_PNG)

    const base = createDummyTheme("bg-theme", "Bg Theme")
    const themeWithBg = {
      ...base,
      light: {
        ...base.light,
        backgrounds: {
          chat: "./wallpaper.png",
        },
      },
    }
    const themePath = join(testDir, "theme.json")
    await writeFile(themePath, JSON.stringify(themeWithBg, null, 2), "utf8")

    const loaded = await readThemeFile(themePath)
    const chatBg = loaded.light.backgrounds?.chat
    expect(chatBg).toBeDefined()
    if (typeof chatBg === "object") {
      expect(chatBg.image).toStartWith("data:image/png;base64,")
    }
  })
})

/* ------------------------------------------------------------------ *
 * listPresets
 * ------------------------------------------------------------------ */

describe("listPresets", () => {
  let testDir: string
  let userAppData: string
  let customRepoDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `tto-list-presets-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    userAppData = join(testDir, "appdata")
    customRepoDir = join(testDir, "repo")
    await mkdir(userAppData, { recursive: true })
    await mkdir(customRepoDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  test("returns all built-in presets when no user or repo presets exist", async () => {
    const list = await listPresets({
      env: { LOCALAPPDATA: userAppData },
      repoDir: customRepoDir,
    })

    expect(list.length).toBeGreaterThanOrEqual(9)
    const builtinIds = Object.keys(BUILTIN_PRESETS)
    for (const id of builtinIds) {
      const found = list.find((p) => p.id === id)
      expect(found).toBeDefined()
      expect(found?.source).toBe("builtin")
      expect(found?.theme).toBeDefined()
    }
    // Result is sorted alphabetically by name
    for (let i = 1; i < list.length; i++) {
      expect(list[i]!.name.localeCompare(list[i - 1]!.name)).toBeGreaterThanOrEqual(0)
    }
  })

  test("includes presets from repo presets directory", async () => {
    const repoPresetsDir = join(customRepoDir, "presets")
    await mkdir(repoPresetsDir, { recursive: true })

    const customRepoTheme = createDummyTheme("repo-exclusive", "Repo Exclusive Theme")
    await writeFile(
      join(repoPresetsDir, "repo-exclusive.json"),
      JSON.stringify(customRepoTheme, null, 2),
      "utf8",
    )

    const list = await listPresets({
      env: { LOCALAPPDATA: userAppData },
      repoDir: customRepoDir,
    })

    const repoPreset = list.find((p) => p.id === "repo-exclusive")
    expect(repoPreset).toBeDefined()
    expect(repoPreset?.source).toBe("repo")
    expect(repoPreset?.name).toBe("Repo Exclusive Theme")
    expect(repoPreset?.path).toBe(join(repoPresetsDir, "repo-exclusive.json"))
  })

  test("includes presets from user presets directory", async () => {
    const userDir = presetsDir({ LOCALAPPDATA: userAppData })
    await mkdir(userDir, { recursive: true })

    const userTheme = createDummyTheme("my-user-preset", "My User Preset")
    await writeFile(
      join(userDir, "my-user-preset.json"),
      JSON.stringify(userTheme, null, 2),
      "utf8",
    )

    const list = await listPresets({
      env: { LOCALAPPDATA: userAppData },
      repoDir: customRepoDir,
    })

    const found = list.find((p) => p.id === "my-user-preset")
    expect(found).toBeDefined()
    expect(found?.source).toBe("user")
    expect(found?.path).toBe(join(userDir, "my-user-preset.json"))
  })

  test("user presets override repo and builtin presets with the same ID", async () => {
    const userDir = presetsDir({ LOCALAPPDATA: userAppData })
    const repoPresetsDir = join(customRepoDir, "presets")
    await mkdir(userDir, { recursive: true })
    await mkdir(repoPresetsDir, { recursive: true })

    // Override "nord" (which is a builtin preset)
    const userNord = createDummyTheme("nord", "Custom User Nord Overridden")
    await writeFile(join(userDir, "nord.json"), JSON.stringify(userNord, null, 2), "utf8")

    const list = await listPresets({
      env: { LOCALAPPDATA: userAppData },
      repoDir: customRepoDir,
    })

    const nord = list.find((p) => p.id === "nord")
    expect(nord).toBeDefined()
    expect(nord?.source).toBe("user")
    expect(nord?.name).toBe("Custom User Nord Overridden")
  })

  test("collects corrupt JSON and invalid theme files in list errors", async () => {
    const userDir = presetsDir({ LOCALAPPDATA: userAppData })
    const repoPresetsDir = join(customRepoDir, "presets")
    await mkdir(userDir, { recursive: true })
    await mkdir(repoPresetsDir, { recursive: true })

    // Write corrupt files
    await writeFile(join(userDir, "corrupt.json"), "{ broken json", "utf8")
    await writeFile(join(repoPresetsDir, "invalid.json"), JSON.stringify({ bad: true }), "utf8")

    const list = await listPresets({
      env: { LOCALAPPDATA: userAppData },
      repoDir: customRepoDir,
    })

    expect(list.length).toBeGreaterThanOrEqual(9)
    expect(list.find((p) => p.id === "corrupt")).toBeUndefined()
    expect(list.find((p) => p.id === "invalid")).toBeUndefined()
    expect(list.errors.length).toBeGreaterThanOrEqual(2)
    expect(list.errors.some((e) => e.path.includes("corrupt.json"))).toBe(true)
    expect(list.errors.some((e) => e.path.includes("invalid.json"))).toBe(true)

    const formatted = formatPresetList(list)
    expect(formatted).toContain("Errors loading preset files:")
    expect(formatted).toContain("corrupt.json")
  })
})

/* ------------------------------------------------------------------ *
 * resolvePreset
 * ------------------------------------------------------------------ */

describe("resolvePreset", () => {
  let testDir: string
  let userAppData: string
  let customRepoDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `tto-resolve-presets-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    userAppData = join(testDir, "appdata")
    customRepoDir = join(testDir, "repo")
    await mkdir(userAppData, { recursive: true })
    await mkdir(customRepoDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  test("resolves built-in preset by exact ID", async () => {
    const res = await resolvePreset("nord", {
      env: { LOCALAPPDATA: userAppData },
      repoDir: customRepoDir,
    })
    expect(res.id).toBe("nord")
    expect(res.name).toBe("Nord Frost")
    expect(res.source).toBe("builtin")
    expect(res.theme.light.seeds.primary).toBeDefined()
  })

  test("resolves built-in preset by full Name (case-insensitive)", async () => {
    const res = await resolvePreset("tokyo night", {
      env: { LOCALAPPDATA: userAppData },
      repoDir: customRepoDir,
    })
    expect(res.id).toBe("tokyo-night")
    expect(res.name).toBe("Tokyo Night")
    expect(res.source).toBe("builtin")
  })

  test("resolves built-in preset by slug-normalized identifier", async () => {
    const res = await resolvePreset("Tokyo_Night", {
      env: { LOCALAPPDATA: userAppData },
      repoDir: customRepoDir,
    })
    expect(res.id).toBe("tokyo-night")
    expect(res.source).toBe("builtin")
  })

  test("resolves from user presets directory (%LOCALAPPDATA%/TelemostThemeOverride/presets)", async () => {
    const userDir = presetsDir({ LOCALAPPDATA: userAppData })
    await mkdir(userDir, { recursive: true })

    const userTheme = createDummyTheme("synthwave", "Synthwave 84")
    const targetFile = join(userDir, "synthwave.json")
    await writeFile(targetFile, JSON.stringify(userTheme, null, 2), "utf8")

    const res = await resolvePreset("synthwave", {
      env: { LOCALAPPDATA: userAppData },
      repoDir: customRepoDir,
    })

    expect(res.id).toBe("synthwave")
    expect(res.name).toBe("Synthwave 84")
    expect(res.source).toBe("user")
    expect(res.path).toBe(targetFile)
  })

  test("resolves from repo presets directory", async () => {
    const repoPresetsDir = join(customRepoDir, "presets")
    await mkdir(repoPresetsDir, { recursive: true })

    const repoTheme = createDummyTheme("matrix", "Matrix Green")
    const targetFile = join(repoPresetsDir, "matrix.json")
    await writeFile(targetFile, JSON.stringify(repoTheme, null, 2), "utf8")

    const res = await resolvePreset("matrix", {
      env: { LOCALAPPDATA: userAppData },
      repoDir: customRepoDir,
    })

    expect(res.id).toBe("matrix")
    expect(res.name).toBe("Matrix Green")
    expect(res.source).toBe("repo")
    expect(res.path).toBe(targetFile)
  })

  test("resolves direct file path (relative, absolute, or .json extension)", async () => {
    const standaloneDir = join(testDir, "standalone")
    await mkdir(standaloneDir, { recursive: true })

    const standaloneTheme = createDummyTheme("standalone", "Standalone Theme")
    const filePath = join(standaloneDir, "my-theme.json")
    await writeFile(filePath, JSON.stringify(standaloneTheme, null, 2), "utf8")

    const res = await resolvePreset(filePath, {
      env: { LOCALAPPDATA: userAppData },
      repoDir: customRepoDir,
    })

    expect(res.id).toBe("standalone")
    expect(res.name).toBe("Standalone Theme")
    expect(res.source).toBe("file")
    expect(res.path).toBe(resolve(filePath))
  })

  test("respects precedence order: direct file > user preset > repo preset > builtin", async () => {
    const userDir = presetsDir({ LOCALAPPDATA: userAppData })
    const repoPresetsDir = join(customRepoDir, "presets")
    await mkdir(userDir, { recursive: true })
    await mkdir(repoPresetsDir, { recursive: true })

    // "dracula" exists as builtin. Create conflicting versions in repo, user, and direct file.
    const repoDracula = createDummyTheme("dracula", "Repo Dracula")
    const userDracula = createDummyTheme("dracula", "User Dracula")
    const fileDracula = createDummyTheme("dracula", "File Dracula")

    await writeFile(join(repoPresetsDir, "dracula.json"), JSON.stringify(repoDracula), "utf8")
    await writeFile(join(userDir, "dracula.json"), JSON.stringify(userDracula), "utf8")
    const directFilePath = join(testDir, "direct-dracula.json")
    await writeFile(directFilePath, JSON.stringify(fileDracula), "utf8")

    // 1. Direct file path wins when provided
    const resFile = await resolvePreset(directFilePath, {
      env: { LOCALAPPDATA: userAppData },
      repoDir: customRepoDir,
    })
    expect(resFile.name).toBe("File Dracula")
    expect(resFile.source).toBe("file")

    // 2. User preset wins over repo and builtin
    const resUser = await resolvePreset("dracula", {
      env: { LOCALAPPDATA: userAppData },
      repoDir: customRepoDir,
    })
    expect(resUser.name).toBe("User Dracula")
    expect(resUser.source).toBe("user")

    // 3. Remove user preset -> repo preset wins over builtin
    await rm(join(userDir, "dracula.json"))
    const resRepo = await resolvePreset("dracula", {
      env: { LOCALAPPDATA: userAppData },
      repoDir: customRepoDir,
    })
    expect(resRepo.name).toBe("Repo Dracula")
    expect(resRepo.source).toBe("repo")

    // 4. Remove repo preset -> builtin wins
    await rm(join(repoPresetsDir, "dracula.json"))
    const resBuiltin = await resolvePreset("dracula", {
      env: { LOCALAPPDATA: userAppData },
      repoDir: customRepoDir,
    })
    expect(resBuiltin.name).toBe("Dracula Vampire")
    expect(resBuiltin.source).toBe("builtin")
  })

  test("throws PresetError when preset name is empty", async () => {
    await expect(resolvePreset("", { env: { LOCALAPPDATA: userAppData } })).rejects.toThrow(
      "preset name or path cannot be empty",
    )
    await expect(resolvePreset("   ", { env: { LOCALAPPDATA: userAppData } })).rejects.toThrow(
      "preset name or path cannot be empty",
    )
  })

  test("throws PresetError with available presets list when preset is not found", async () => {
    try {
      await resolvePreset("non-existent-preset-12345", {
        env: { LOCALAPPDATA: userAppData },
        repoDir: customRepoDir,
      })
      expect(true).toBe(false) // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(PresetError)
      const msg = (err as Error).message
      expect(msg).toContain('Preset "non-existent-preset-12345" not found.')
      expect(msg).toContain("Available presets:")
      expect(msg).toContain("nord")
      expect(msg).toContain("tokyo-night")
      expect(msg).toContain("You can also pass a direct path to a theme JSON file.")
    }
  })

  test("reports unreadable preset files in PresetError when preset is not found", async () => {
    const userDir = presetsDir({ LOCALAPPDATA: userAppData })
    await mkdir(userDir, { recursive: true })
    await writeFile(join(userDir, "bad-syntax.json"), "{ invalid json", "utf8")

    await expect(
      resolvePreset("nonexistent-theme", { env: { LOCALAPPDATA: userAppData } }),
    ).rejects.toThrow(/Failed to load the following preset files:\n  - .*bad-syntax\.json/)
  })
})

/* ------------------------------------------------------------------ *
 * savePreset
 * ------------------------------------------------------------------ */

describe("savePreset", () => {
  let testDir: string
  let userAppData: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `tto-save-presets-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    userAppData = join(testDir, "appdata")
    await mkdir(userAppData, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  test("saves DesktopTheme object to user presets directory", async () => {
    const theme = createDummyTheme("oceanic-next", "Oceanic Next")
    const result = await savePreset(theme, "oceanic-next", {
      env: { LOCALAPPDATA: userAppData },
    })

    const expectedUserDir = presetsDir({ LOCALAPPDATA: userAppData })
    expect(result.path).toBe(join(expectedUserDir, "oceanic-next.json"))
    expect(result.preset.id).toBe("oceanic-next")
    expect(result.preset.name).toBe("Oceanic Next")
    expect(result.preset.source).toBe("user")
    expect(existsSync(result.path)).toBe(true)

    const savedContent = JSON.parse(await readFile(result.path, "utf8")) as DesktopTheme
    expect(savedContent.id).toBe("oceanic-next")
    expect(savedContent.name).toBe("Oceanic Next")
  })

  test("saves from theme file path to user presets directory with new name", async () => {
    const sourceTheme = createDummyTheme("base-theme", "Base Theme")
    const sourcePath = join(testDir, "source.json")
    await writeFile(sourcePath, JSON.stringify(sourceTheme, null, 2), "utf8")

    const result = await savePreset(sourcePath, "My Custom Theme", {
      env: { LOCALAPPDATA: userAppData },
    })

    expect(result.preset.id).toBe("my-custom-theme")
    expect(result.preset.name).toBe("My Custom Theme")
    expect(existsSync(result.path)).toBe(true)

    const savedContent = JSON.parse(await readFile(result.path, "utf8")) as DesktopTheme
    expect(savedContent.id).toBe("my-custom-theme")
    expect(savedContent.name).toBe("My Custom Theme")
  })

  test("creates user presets directory recursively if it does not exist", async () => {
    const nestedAppData = join(testDir, "nested", "deep", "appdata")
    const theme = createDummyTheme("deep-theme", "Deep Theme")

    const result = await savePreset(theme, undefined, {
      env: { LOCALAPPDATA: nestedAppData },
    })

    expect(existsSync(result.path)).toBe(true)
  })
})

/* ------------------------------------------------------------------ *
 * importPreset
 * ------------------------------------------------------------------ */

describe("importPreset", () => {
  let testDir: string
  let userAppData: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `tto-import-presets-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    userAppData = join(testDir, "appdata")
    await mkdir(userAppData, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  test("imports a theme file and saves it in user presets directory", async () => {
    const externalTheme = createDummyTheme("imported-solarized", "Solarized Dark Imported")
    const externalPath = join(testDir, "solarized.json")
    await writeFile(externalPath, JSON.stringify(externalTheme, null, 2), "utf8")

    const result = await importPreset(externalPath, {
      env: { LOCALAPPDATA: userAppData },
    })

    expect(result.preset.id).toBe("imported-solarized")
    expect(result.preset.name).toBe("Solarized Dark Imported")
    expect(result.preset.source).toBe("user")
    expect(existsSync(result.path)).toBe(true)
  })

  test("throws PresetError when source file does not exist", async () => {
    const missing = join(testDir, "not-found.json")
    await expect(importPreset(missing, { env: { LOCALAPPDATA: userAppData } })).rejects.toThrow(
      /source theme file not found/,
    )
  })
})

/* ------------------------------------------------------------------ *
 * exportPreset
 * ------------------------------------------------------------------ */

describe("exportPreset", () => {
  let testDir: string
  let userAppData: string
  let customRepoDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `tto-export-presets-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    userAppData = join(testDir, "appdata")
    customRepoDir = join(testDir, "repo")
    await mkdir(userAppData, { recursive: true })
    await mkdir(customRepoDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  test("exports builtin preset to self-contained JSON string", async () => {
    const result = await exportPreset("nord", undefined, {
      env: { LOCALAPPDATA: userAppData },
      repoDir: customRepoDir,
    })

    expect(result.outPath).toBeUndefined()
    expect(result.preset.id).toBe("nord")
    expect(result.preset.name).toBe("Nord Frost")
    expect(result.preset.source).toBe("builtin")

    const parsed = JSON.parse(result.exportedJson) as DesktopTheme
    expect(parsed.id).toBe("nord")
    expect(desktopThemeSchema.safeParse(parsed).success).toBe(true)
  })

  test("exports preset directly to output file", async () => {
    const outFilePath = join(testDir, "exported", "nord-exported.json")
    const result = await exportPreset("nord", outFilePath, {
      env: { LOCALAPPDATA: userAppData },
    })

    expect(result.outPath).toBe(resolve(outFilePath))
    expect(existsSync(outFilePath)).toBe(true)

    const fileContent = JSON.parse(await readFile(outFilePath, "utf8")) as DesktopTheme
    expect(fileContent.id).toBe("nord")
  })

  test("exports Theme object and embeds local background images as Base64 Data URIs", async () => {
    const bgFile = join(testDir, "bg.png").replace(/\\/g, "/")
    await writeFile(bgFile, SAMPLE_1PX_PNG)

    const base = createDummyTheme("bg-export-theme", "Bg Export Theme")
    const themeWithBg: DesktopTheme = {
      ...base,
      light: {
        ...base.light,
        backgrounds: {
          chat: bgFile,
        },
      },
    }

    const result = await exportPreset(themeWithBg)
    const parsed = JSON.parse(result.exportedJson) as DesktopTheme
    const chatBg = parsed.light.backgrounds?.chat
    expect(chatBg).toBeDefined()
    if (typeof chatBg === "object") {
      expect(chatBg.image).toStartWith("data:image/png;base64,")
    }
  })
})

/* ------------------------------------------------------------------ *
 * setActivePreset
 * ------------------------------------------------------------------ */

describe("setActivePreset", () => {
  let testDir: string
  let userAppData: string
  let customRepoDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `tto-set-active-preset-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    userAppData = join(testDir, "appdata")
    customRepoDir = join(testDir, "repo")
    await mkdir(userAppData, { recursive: true })
    await mkdir(customRepoDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  test("updates preset field in existing config.json while preserving other fields", async () => {
    const configPath = appConfigFilePath({ LOCALAPPDATA: userAppData })
    await mkdir(join(userAppData, "TelemostThemeOverride"), { recursive: true })

    const initialConfig: UserConfig = {
      telemostExe: "C:\\Program Files\\Yandex\\YandexTelemost\\YandexTelemost.exe",
      debugPort: 9444,
      watch: true,
      launchTimeoutSeconds: 30,
      hideConsole: "never",
      preset: "tokyo-night",
    }
    await writeFile(configPath, JSON.stringify(initialConfig, null, 2), "utf8")

    const result = await setActivePreset("dracula", {
      env: { LOCALAPPDATA: userAppData },
      repoDir: customRepoDir,
    })

    expect(result.configPath).toBe(configPath)
    expect(result.preset).toBe("dracula")
    expect(result.theme.name).toBe("Dracula Vampire")

    const updatedConfig = userConfigSchema.parse(JSON.parse(await readFile(configPath, "utf8")))
    expect(updatedConfig.preset).toBe("dracula")
    expect(updatedConfig.debugPort).toBe(9444)
    expect(updatedConfig.hideConsole).toBe("never")
  })

  test("throws PresetError if config.json does not exist", async () => {
    await expect(setActivePreset("nord", { env: { LOCALAPPDATA: userAppData } })).rejects.toThrow(
      /config file not found.*Run telemost-start first to initialize/,
    )
  })

  test("throws PresetError if requested preset does not exist", async () => {
    const configPath = appConfigFilePath({ LOCALAPPDATA: userAppData })
    await mkdir(join(userAppData, "TelemostThemeOverride"), { recursive: true })
    await writeFile(configPath, JSON.stringify({ telemostExe: "dummy.exe" }), "utf8")

    await expect(
      setActivePreset("invalid-ghost-preset", { env: { LOCALAPPDATA: userAppData } }),
    ).rejects.toThrow(PresetError)
  })

  test("clears preset when passing 'custom' or empty string", async () => {
    const configPath = appConfigFilePath({ LOCALAPPDATA: userAppData })
    await mkdir(join(userAppData, "TelemostThemeOverride"), { recursive: true })
    await writeFile(configPath, JSON.stringify({ telemostExe: "dummy.exe", preset: "nord" }), "utf8")

    const result = await setActivePreset("custom", { env: { LOCALAPPDATA: userAppData } })
    expect(result.preset).toBe("custom")
    expect(result.theme).toBeDefined()

    const raw = await readFile(configPath, "utf8")
    const parsed = JSON.parse(raw) as Record<string, unknown>
    expect(parsed.preset).toBeUndefined()
  })
})

/* ------------------------------------------------------------------ *
 * Built-in Presets Integrity & CSS Generation
 * ------------------------------------------------------------------ */

describe("Built-in Presets CSS Generation & Integrity", () => {
  const expectedPresetIds = [
    "anime-pink",
    "catppuccin",
    "cobalt",
    "dracula",
    "emerald",
    "monokai",
    "nord",
    "pastel-blossom",
    "tokyo-night",
  ]

  test("all expected 9 built-in presets exist in BUILTIN_PRESETS", () => {
    for (const id of expectedPresetIds) {
      expect(BUILTIN_PRESETS[id]).toBeDefined()
      expect(BUILTIN_PRESETS[id]?.id).toBe(id)
      expect(BUILTIN_PRESETS[id]?.name).toBeString()
    }
  })

  const presetTokenExpectations: Record<string, string[]> = {
    nord: ["--orb-text-primary: #2e3440;", "--orb-text-primary: #eceff4;"],
    dracula: ["--orb-text-primary: #282a36;", "--orb-text-primary: #f8f8f2;"],
    "tokyo-night": ["--orb-text-primary: #343b58;", "--orb-text-primary: #c0caf5;"],
    catppuccin: ["--orb-text-primary: #4c4f69;", "--orb-text-primary: #cdd6f4;"],
    monokai: ["--orb-text-primary: #2d2a2e;", "--orb-text-primary: #fcfcfa;"],
    cobalt: ["--orb-text-primary: #1f2328;", "--orb-text-primary: #f0f6fc;"],
    emerald: ["--orb-text-primary: #10231d;", "--orb-text-primary: #e5fff4;"],
    "pastel-blossom": ["--orb-text-primary: #3f1b2b;", "--orb-text-primary: #fff2f7;"],
    "anime-pink": ["--common-bg: #fff5f8;", "--common-bg: #20121a;"],
  }

  test.each(expectedPresetIds)("built-in preset '%s' passes schema and generates valid CSS with semantic tokens", (presetId) => {
    const theme = BUILTIN_PRESETS[presetId]!
    const parseResult = desktopThemeSchema.safeParse(theme)
    expect(parseResult.success, `preset ${presetId} failed schema validation`).toBe(true)
    if (!parseResult.success) return

    const mapping = mappingConfigSchema.parse(DEFAULT_MAPPING)
    const css = buildCss({
      theme: parseResult.data,
      mapping,
    })

    expect(css).toBeString()
    expect(css.length).toBeGreaterThan(500)
    // Check key structural sections
    expect(css).toContain(`telemost-theme-override — ${theme.name}`)
    expect(css).toContain(":root {")
    expect(css).toContain(":root.theme_dark")
    expect(css).toContain("@media (prefers-color-scheme: dark)")
    expect(css).toContain("--orb-color-ya-telemost-100")
    expect(css).toContain("--orb-surface-brand")

    // Check specific concrete tokens for this preset
    const expectedTokens = presetTokenExpectations[presetId] ?? []
    for (const token of expectedTokens) {
      expect(css).toContain(token)
    }
  })

  test("all presets in presets/*.json match schema and generate valid CSS", () => {
    const repoPresetsDir = resolve(process.cwd(), "presets")
    if (!existsSync(repoPresetsDir)) return

    const files = readdirSync(repoPresetsDir).filter((f) => f.endsWith(".json"))
    expect(files.length).toBeGreaterThanOrEqual(9)

    const mapping = mappingConfigSchema.parse(DEFAULT_MAPPING)
    for (const file of files) {
      const fullPath = join(repoPresetsDir, file)
      const raw = readFileSync(fullPath, "utf8")
      const json = JSON.parse(raw) as unknown

      const parseResult = desktopThemeSchema.safeParse(json)
      expect(parseResult.success, `presets/${file} failed schema validation`).toBe(true)

      const css = buildCss({
        theme: parseResult.data as DesktopTheme,
        mapping,
      })
      expect(css).toBeString()
      expect(css.length).toBeGreaterThan(500)
    }
  })

  test("buildAppConfig correctly resolves CLI overrides and defaults", () => {
    const config = buildAppConfig(process.cwd(), {
      port: 9444,
      watch: false,
    })
    expect(config.debugPort).toBe(9444)
    expect(config.watch).toBe(false)
    expect(config.debugHost).toBe("127.0.0.1")
    expect(config.themeFile).toContain("theme.json")
    expect(config.mappingFile).toContain("mapping.json")
  })
})
