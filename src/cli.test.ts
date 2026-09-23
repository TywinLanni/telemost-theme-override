import { describe, expect, test } from "bun:test"
import { parseMainArgs, readOverrides } from "./main"
import { parseStartArgs } from "./start"
import { ConfigError } from "./config"

describe("main.ts CLI argument parsing (parseMainArgs & readOverrides)", () => {
  test("parses command positionals and general options", () => {
    const { values, positionals } = parseMainArgs([
      "build-css",
      "--theme",
      "custom/theme.json",
      "--preset",
      "nord",
      "--mapping",
      "custom/mapping.json",
      "--port",
      "9444",
      "--exe",
      "C:\\Telemost.exe",
      "--out",
      "out.css",
      "--once",
    ])

    expect(positionals).toEqual(["build-css"])
    expect(values.theme).toBe("custom/theme.json")
    expect(values.preset).toBe("nord")
    expect(values.mapping).toBe("custom/mapping.json")
    expect(values.port).toBe("9444")
    expect(values.exe).toBe("C:\\Telemost.exe")
    expect(values.out).toBe("out.css")
    expect(values.once).toBe(true)
  })

  test("parses preset management flags", () => {
    expect(parseMainArgs(["--list-presets"]).values["list-presets"]).toBe(true)
    expect(parseMainArgs(["--presets"]).values.presets).toBe(true)
    expect(parseMainArgs(["presets"]).positionals[0]).toBe("presets")

    const saveArgs = parseMainArgs(["--save-preset", "My Theme"])
    expect(saveArgs.values["save-preset"]).toBe("My Theme")

    const importArgs = parseMainArgs(["--import-preset", "shared/preset.json"])
    expect(importArgs.values["import-preset"]).toBe("shared/preset.json")

    const exportArgs = parseMainArgs(["--export-preset", "nord", "--out", "nord-export.json"])
    expect(exportArgs.values["export-preset"]).toBe("nord")
    expect(exportArgs.values.out).toBe("nord-export.json")
  })

  test("readOverrides correctly converts parsed CLI values", () => {
    const { values } = parseMainArgs(["--port", "9555", "--once", "--preset", "dracula"])
    const overrides = readOverrides(values)

    expect(overrides.port).toBe(9555)
    expect(overrides.watch).toBe(false)
    expect(overrides.preset).toBe("dracula")
    expect(overrides.theme).toBeUndefined()
  })

  test("readOverrides throws ConfigError for non-numeric port", () => {
    expect(() => readOverrides({ port: "abc" })).toThrow(ConfigError)
    expect(() => readOverrides({ port: "abc" })).toThrow("--port must be a number")
  })
})

describe("start.ts CLI argument parsing (parseStartArgs)", () => {
  test("parses start.ts specific flags", () => {
    const { values } = parseStartArgs([
      "--set-preset",
      "custom",
      "--where",
      "--once",
    ])

    expect(values["set-preset"]).toBe("custom")
    expect(values.where).toBe(true)
    expect(values.once).toBe(true)
  })

  test("parses preset management flags in launcher", () => {
    expect(parseStartArgs(["--list-presets"]).values["list-presets"]).toBe(true)
    expect(parseStartArgs(["--preset", "tokyo-night"]).values.preset).toBe("tokyo-night")
    expect(parseStartArgs(["--set-preset", "emerald"]).values["set-preset"]).toBe("emerald")
    expect(parseStartArgs(["--save-preset", "New Theme"]).values["save-preset"]).toBe("New Theme")
    expect(parseStartArgs(["--import-preset", "path/theme.json"]).values["import-preset"]).toBe("path/theme.json")
    expect(parseStartArgs(["--export-preset", "emerald", "--out", "em.json"]).values["export-preset"]).toBe("emerald")
    expect(parseStartArgs(["--help"]).values.help).toBe(true)
  })
})
