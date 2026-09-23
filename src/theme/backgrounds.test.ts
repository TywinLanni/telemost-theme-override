import { describe, expect, test } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { loadTheme } from "../config"
import { desktopThemeSchema, isValidGradientValue, mappingConfigSchema } from "../schema"
import { buildCss } from "./generate"
import {
  assertLocalFilePath,
  BACKGROUND_SURFACE_SELECTORS,
  normalizeSurfaceKey,
  renderBackgroundDeclarations,
  resolveBackgroundImage,
} from "./backgrounds"

const SEEDS = {
  neutral: "#0a0a0a",
  primary: "#101010",
  success: "#1a1a1a",
  warning: "#242424",
  error: "#2e2e2e",
  info: "#383838",
  interactive: "#424242",
} as const

const DUMMY_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="

const MAPPING_FIXTURE = {
  description: "test mapping",
  ramps: [{ family: "ya-telemost", seed: "interactive", alphaSource: 700, emitLightTrio: true }],
  darkOverrides: {},
  lightOverrides: {},
  canaryTokens: ["--orb-surface-brand"],
  semanticBindings: [],
  semanticCanaries: [],
}

function baseTheme(): Record<string, unknown> {
  return {
    name: "Bg Test Theme",
    id: "bg-test-theme",
    light: { seeds: SEEDS },
    dark: { seeds: SEEDS },
  }
}

describe("Background Schema & Validation", () => {
  test("accepts string shorthand for backgrounds in theme variant and root", () => {
    const theme = {
      ...baseTheme(),
      backgrounds: {
        chat: "assets/shared-chat.png",
      },
      light: {
        seeds: SEEDS,
        backgrounds: {
          page: "assets/light-page.jpg",
          sidebar: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        },
      },
      dark: {
        seeds: SEEDS,
        backgrounds: {
          page: "assets/dark-page.jpg",
        },
      },
    }

    const parsed = desktopThemeSchema.safeParse(theme)
    expect(parsed.success).toBe(true)
  })

  test("accepts full background properties object with options", () => {
    const theme = {
      ...baseTheme(),
      light: {
        seeds: SEEDS,
        backgrounds: {
          chat: {
            image: "assets/chat.png",
            size: "contain",
            position: "center top",
            repeat: "repeat-x",
            attachment: "fixed",
            overlay: "rgba(255, 255, 255, 0.8)",
            blendMode: "multiply",
            opacity: 0.95,
          },
        },
      },
    }

    const parsed = desktopThemeSchema.safeParse(theme)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.light.backgrounds?.chat).toEqual({
        image: "assets/chat.png",
        size: "contain",
        position: "center top",
        repeat: "repeat-x",
        attachment: "fixed",
        overlay: "rgba(255, 255, 255, 0.8)",
        blendMode: "multiply",
        opacity: 0.95,
      })
    }
  })

  test("accepts custom background rules with selectors", () => {
    const theme = {
      ...baseTheme(),
      light: {
        seeds: SEEDS,
        backgrounds: {
          custom: [
            {
              selector: ".yamb-special-banner",
              image: "assets/banner.png",
              size: "cover",
              position: "top center",
              repeat: "no-repeat",
            },
          ],
        },
      },
    }

    const parsed = desktopThemeSchema.safeParse(theme)
    expect(parsed.success).toBe(true)
  })

  test("rejects breakout attempts with braces or linebreaks in image or selector", () => {
    const invalidImage = {
      ...baseTheme(),
      light: {
        seeds: SEEDS,
        backgrounds: {
          chat: "url(x)} body { background: red }",
        },
      },
    }
    expect(desktopThemeSchema.safeParse(invalidImage).success).toBe(false)

    const invalidSelector = {
      ...baseTheme(),
      light: {
        seeds: SEEDS,
        backgrounds: {
          custom: [
            {
              selector: "body { background: red }",
              image: "https://example.com/ok.png",
            },
          ],
        },
      },
    }
    expect(desktopThemeSchema.safeParse(invalidSelector).success).toBe(false)
  })

  test("rejects unknown keys in backgrounds object (strictKeyed)", () => {
    const theme = {
      ...baseTheme(),
      light: {
        seeds: SEEDS,
        backgrounds: {
          unknownContainer: "https://example.com/pic.png",
        },
      },
    }
    expect(desktopThemeSchema.safeParse(theme).success).toBe(false)
  })
})

describe("Surface Aliases & Helpers", () => {
  test("normalizes surface aliases correctly", () => {
    expect(normalizeSurfaceKey("conversation")).toBe("chat")
    expect(normalizeSurfaceKey("app")).toBe("page")
    expect(normalizeSurfaceKey("hub")).toBe("home")
    expect(normalizeSurfaceKey("threads")).toBe("sidebar")
    expect(normalizeSurfaceKey("meeting")).toBe("call")
    expect(normalizeSurfaceKey("card")).toBe("modal")
    expect(normalizeSurfaceKey("popup")).toBe("modal")
    expect(normalizeSurfaceKey("chat")).toBe("chat")
    expect(normalizeSurfaceKey("page")).toBe("page")
  })

  test("renders background declarations with defaults", () => {
    const decls = renderBackgroundDeclarations({
      image: DUMMY_DATA_URI,
    })
    const map = Object.fromEntries(decls)
    expect(map["background-image"]).toBe(`url("${DUMMY_DATA_URI}")`)
    expect(map["background-size"]).toBe("cover")
    expect(map["background-position"]).toBe("center")
    expect(map["background-repeat"]).toBe("no-repeat")
    expect(map["background-attachment"]).toBeUndefined()
  })

  test("renders background declarations with overlay scrim", () => {
    const decls = renderBackgroundDeclarations({
      image: DUMMY_DATA_URI,
      overlay: "rgba(32, 18, 26, 0.75)",
      size: "contain",
      position: "top right",
      repeat: "repeat-y",
      attachment: "fixed",
      blendMode: "overlay",
      opacity: 0.9,
    })
    const map = Object.fromEntries(decls)
    expect(map["background-image"]).toBe(
      `linear-gradient(rgba(32, 18, 26, 0.75), rgba(32, 18, 26, 0.75)), url("${DUMMY_DATA_URI}")`,
    )
    expect(map["background-size"]).toBe("contain")
    expect(map["background-position"]).toBe("top right")
    expect(map["background-repeat"]).toBe("repeat-y")
    expect(map["background-attachment"]).toBe("fixed")
    expect(map["background-blend-mode"]).toBe("overlay")
    expect(map["opacity"]).toBe("0.9")
  })

  test("asserts that unresolved paths or invalid URLs cannot reach CSS generation", () => {
    expect(() => renderBackgroundDeclarations({ image: "unresolved-path.png" })).toThrow(/assertion failed/)
    expect(() => renderBackgroundDeclarations({ image: "https://evil.com/bg.png" })).toThrow(/assertion failed/)
  })
})

describe("Local Image File Resolution & Base64 Encoding", () => {
  test("resolves local image files to base64 Data URIs", async () => {
    const testDir = join(tmpdir(), `tto-bg-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })

    const samplePng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
    ])
    await writeFile(join(testDir, "sample.png"), samplePng)

    const dataUri = await resolveBackgroundImage("sample.png", testDir)
    expect(dataUri).toStartWith("data:image/png;base64,")

    // Remote web URLs are rejected for security
    await expect(resolveBackgroundImage("https://site.com/image.jpg", testDir)).rejects.toThrow("remote image URLs are forbidden")
    // Passes through Data URIs unchanged
    expect(await resolveBackgroundImage("data:image/webp;base64,AAAA", testDir)).toBe("data:image/webp;base64,AAAA")

    await rm(testDir, { recursive: true, force: true })
  })

  test("throws descriptive error when local image file does not exist", async () => {
    const testDir = join(tmpdir(), `tto-bg-missing-${Date.now()}`)
    await mkdir(testDir, { recursive: true })

    await expect(resolveBackgroundImage("non-existent-pic.jpg", testDir)).rejects.toThrow(
      /cannot resolve background image "non-existent-pic\.jpg"/,
    )

    await rm(testDir, { recursive: true, force: true })
  })

  test("loadTheme automatically resolves local image paths relative to theme.json", async () => {
    const testDir = join(tmpdir(), `tto-load-theme-bg-${Date.now()}`)
    await mkdir(testDir, { recursive: true })

    const sampleJpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
    await writeFile(join(testDir, "wallpaper.jpg"), sampleJpg)

    const themeContent = {
      ...baseTheme(),
      light: {
        seeds: SEEDS,
        backgrounds: {
          chat: "./wallpaper.jpg",
        },
      },
    }
    const themePath = join(testDir, "theme.json")
    await writeFile(themePath, JSON.stringify(themeContent))

    const loaded = await loadTheme(themePath)
    const chatBg = loaded.light.backgrounds?.chat
    expect(chatBg).toBeDefined()
    if (typeof chatBg === "object") {
      expect(chatBg.image).toStartWith("data:image/jpeg;base64,")
    }

    await rm(testDir, { recursive: true, force: true })
  })
})

describe("Gradient Passthrough in resolveBackgroundImage", () => {
  // Regression guard: resolveBackgroundImage used to recognise gradients by a
  // hardcoded prefix list (linear-/radial-/conic-gradient) that omitted the
  // `repeating-*` family. Those values pass `backgroundImageValueSchema`, so a
  // theme.json could hold one, but resolution treated it as a relative file
  // name and readFile blew up with ENOENT. It now delegates to the very same
  // `isValidGradientValue` the schema uses, so "accepted by schema" and
  // "resolvable" can no longer drift apart.
  const repeatingGradients = [
    ["repeating-linear-gradient(red, blue 10px)"],
    ["repeating-radial-gradient(circle, red, blue 10px)"],
    ["repeating-conic-gradient(red 0deg, blue 10deg)"],
  ] as const

  test.each(repeatingGradients)("passes %s through unchanged instead of reading it as a file", async (gradient) => {
    const testDir = join(tmpdir(), `tto-bg-gradient-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(testDir, { recursive: true })
    try {
      // The schema and the resolver must agree: anything the schema admits as a
      // gradient must survive resolution untouched.
      expect(isValidGradientValue(gradient)).toBe(true)
      expect(await resolveBackgroundImage(gradient, testDir)).toBe(gradient)
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  test("non-repeating gradients keep passing through (no regression in the original behaviour)", async () => {
    const testDir = join(tmpdir(), `tto-bg-gradient-plain-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(testDir, { recursive: true })
    try {
      const gradient = "linear-gradient(rgba(255, 255, 255, 0.8), rgba(0, 0, 0, 0.2))"
      expect(await resolveBackgroundImage(gradient, testDir)).toBe(gradient)
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  test("a value that merely looks gradient-ish is still resolved as a file path", async () => {
    // Guards against the passthrough being widened into a prefix sniff: an
    // unbalanced/!-bearing value fails isValidGradientValue, so it must fall
    // through to file resolution (and fail there) rather than reach CSS raw.
    const testDir = join(tmpdir(), `tto-bg-gradient-fake-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(testDir, { recursive: true })
    try {
      const notAGradient = "repeating-linear-gradient(red, blue"
      expect(isValidGradientValue(notAGradient)).toBe(false)
      await expect(resolveBackgroundImage(notAGradient, testDir)).rejects.toThrow(
        /cannot resolve background image/,
      )
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })
})

describe("assertLocalFilePath network & device path rejection", () => {
  // Defense in depth behind the schema. These strings are never opened: the
  // assertion is a pure string check that runs before any readFile, which is
  // exactly why it is safe to assert on them here — no SMB/device I/O occurs.
  const rejected = [
    ["UNC share (backslashes)", "\\\\host\\share\\x.png"],
    ["UNC share (forward slashes)", "//host/share/x.png"],
    ["Win32 extended-length UNC", "\\\\?\\UNC\\h\\s\\x.png"],
    ["Win32 device namespace (named pipe)", "\\\\.\\pipe\\x"],
    ["NT object-manager UNC", "\\??\\UNC\\h\\s\\x.png"],
    // path.resolve("C:\\base", "\\??\\UNC\\h\\s\\x.png") === "C:\\??\\UNC\\h\\s\\x.png":
    // the NT prefix survives resolution buried mid-path, so a startsWith check
    // alone would miss it. It must be rejected wherever it appears.
    ["NT prefix after path.resolve buried mid-path", "C:\\??\\UNC\\h\\s\\x.png"],
  ] as const

  test.each(rejected)("rejects %s", (_label, filePath) => {
    expect(() => assertLocalFilePath(filePath)).toThrow(
      /background image must be a local file, not a network or device path/,
    )
  })

  const accepted = [
    ["plain Windows path", "C:\\Users\\me\\wall.jpg"],
    ["Windows path with forward slashes, spaces and parens", "C:/Users/me/my wall (1).jpg"],
    ["POSIX-style absolute path", "/tmp/x.png"],
  ] as const

  test.each(accepted)("accepts %s", (_label, filePath) => {
    expect(() => assertLocalFilePath(filePath)).not.toThrow()
  })

  test("error message names the offending path so the user can fix their theme.json", () => {
    expect(() => assertLocalFilePath("\\\\host\\share\\x.png")).toThrow(
      "background image must be a local file, not a network or device path: \\\\host\\share\\x.png",
    )
  })

  test("resolveBackgroundImage rejects an NT-namespace path before touching the filesystem", async () => {
    const testDir = join(tmpdir(), `tto-bg-nt-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(testDir, { recursive: true })
    try {
      // Host is the reserved-by-RFC-2606 `invalid.invalid` so that even a total
      // failure of the guard could not resolve to a reachable SMB server.
      const ntPath = "\\??\\UNC\\invalid.invalid\\share\\x.png"
      await expect(resolveBackgroundImage(ntPath, testDir)).rejects.toThrow(
        /background image must be a local file, not a network or device path/,
      )
      // The guard fires before readFile, so the failure is NOT reported through
      // the generic "cannot resolve background image ... : ENOENT" wrapper that
      // surrounds the I/O. That distinction is the whole point of the check.
      await expect(resolveBackgroundImage(ntPath, testDir)).rejects.not.toThrow(
        /cannot resolve background image/,
      )
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })
})

describe("CSS Generation with Background Images", () => {
  test("generates background CSS rules for configured surfaces", () => {
    const theme = desktopThemeSchema.parse({
      ...baseTheme(),
      light: {
        seeds: SEEDS,
        backgrounds: {
          chat: {
            image: DUMMY_DATA_URI,
            overlay: "rgba(255, 255, 255, 0.85)",
          },
          sidebar: DUMMY_DATA_URI,
        },
      },
      dark: {
        seeds: SEEDS,
        backgrounds: {
          chat: {
            image: DUMMY_DATA_URI,
            overlay: "rgba(32, 18, 26, 0.75)",
          },
        },
      },
    })

    const css = buildCss({
      theme,
      mapping: mappingConfigSchema.parse(MAPPING_FIXTURE),
    })

    // Check light chat background
    expect(css).toContain("/* tto: background.chat.light */")
    expect(css).toContain(BACKGROUND_SURFACE_SELECTORS.chat.light.join(", "))
    expect(css).toContain(`linear-gradient(rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.85)), url("${DUMMY_DATA_URI}")`)

    // Check light sidebar background
    expect(css).toContain("/* tto: background.sidebar.light */")
    expect(css).toContain(BACKGROUND_SURFACE_SELECTORS.sidebar.light.join(", "))
    expect(css).toContain(`url("${DUMMY_DATA_URI}")`)

    // Check dark chat background
    expect(css).toContain("/* tto: background.chat.dark */")
    expect(css).toContain(BACKGROUND_SURFACE_SELECTORS.chat.dark.join(", "))
    expect(css).toContain(`linear-gradient(rgba(32, 18, 26, 0.75), rgba(32, 18, 26, 0.75)), url("${DUMMY_DATA_URI}")`)

    // Check theme_auto media block for dark background
    expect(css).toContain("@media (prefers-color-scheme: dark)")
    expect(css).toContain(BACKGROUND_SURFACE_SELECTORS.chat.auto.join(", "))
  })

  test("inherits root-level backgrounds when not specified in variant", () => {
    const theme = desktopThemeSchema.parse({
      ...baseTheme(),
      backgrounds: {
        page: DUMMY_DATA_URI,
      },
    })

    const css = buildCss({
      theme,
      mapping: mappingConfigSchema.parse(MAPPING_FIXTURE),
    })

    expect(css).toContain("/* tto: background.page.light */")
    expect(css).toContain("/* tto: background.page.dark */")
    expect(css).toContain(BACKGROUND_SURFACE_SELECTORS.page.light.join(", "))
    expect(css).toContain(BACKGROUND_SURFACE_SELECTORS.page.dark.join(", "))
    expect(css).toContain(`url("${DUMMY_DATA_URI}")`)
  })

  test("generates custom background rules verbatim", () => {
    const theme = desktopThemeSchema.parse({
      ...baseTheme(),
      light: {
        seeds: SEEDS,
        backgrounds: {
          custom: [
            {
              selector: ".my-custom-header",
              image: DUMMY_DATA_URI,
              size: "100% 80px",
              position: "top left",
              repeat: "repeat-x",
            },
          ],
        },
      },
    })

    const css = buildCss({
      theme,
      mapping: mappingConfigSchema.parse(MAPPING_FIXTURE),
    })

    expect(css).toContain("/* tto: background.custom.light */")
    expect(css).toContain(".my-custom-header {")
    expect(css).toContain(`background-image: url("${DUMMY_DATA_URI}");`)
    expect(css).toContain("background-size: 100% 80px;")
  })
})
