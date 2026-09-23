import { readFile } from "node:fs/promises"
import { extname, isAbsolute, resolve } from "node:path"
import {
  isValidGradientValue,
  type BackgroundItem,
  type BackgroundProperties,
  type BackgroundsConfig,
  type CustomBackgroundRule,
  type DesktopTheme,
} from "../schema"

/**
 * Surface selectors for Telemost UI containers where background images can be applied.
 */
export const BACKGROUND_SURFACE_SELECTORS: Readonly<
  Record<string, { readonly light: readonly string[]; readonly dark: readonly string[]; readonly auto: readonly string[] }>
> = {
  page: {
    light: [":root body", ":root.browser.desktop", ":root #root", ":root .yamb-root"],
    dark: [
      ".theme_dark:root body",
      ".theme_dark:root",
      ":root.theme_dark body",
      ":root.theme_dark .yamb-root",
      ".theme_dark:root .yamb-root",
    ],
    auto: [":root.theme_auto body", ":root.theme_auto .yamb-root"],
  },
  chat: {
    light: [":root .yamb-conversation", ":root .yamb-conversation_transparent"],
    dark: [
      ".theme_dark:root .yamb-conversation",
      ":root.theme_dark .yamb-conversation",
      ".theme_dark:root .yamb-conversation_transparent",
      ":root.theme_dark .yamb-conversation_transparent",
    ],
    auto: [":root.theme_auto .yamb-conversation", ":root.theme_auto .yamb-conversation_transparent"],
  },
  sidebar: {
    light: [
      ":root .yamb-sidebar",
      ":root .yamb-threads-list",
      ":root .yamb-threads-list__container",
      ":root .Orb-Elevation_base_sidebar",
    ],
    dark: [
      ".theme_dark:root .yamb-sidebar",
      ":root.theme_dark .yamb-sidebar",
      ".theme_dark:root .yamb-threads-list",
      ":root.theme_dark .yamb-threads-list",
    ],
    auto: [":root.theme_auto .yamb-sidebar", ":root.theme_auto .yamb-threads-list"],
  },
  home: {
    light: [":root .yamb-home-hub-page", ":root .yamb-home-hub-page__main", ":root .yamb-home-page"],
    dark: [
      ".theme_dark:root .yamb-home-hub-page",
      ":root.theme_dark .yamb-home-hub-page",
      ".theme_dark:root .yamb-home-hub-page__main",
      ":root.theme_dark .yamb-home-hub-page__main",
    ],
    auto: [":root.theme_auto .yamb-home-hub-page", ":root.theme_auto .yamb-home-hub-page__main"],
  },
  login: {
    light: [":root .yamb-telemost-login-page", ":root .yamb-telemost-login-touch-page"],
    dark: [".theme_dark:root .yamb-telemost-login-page", ":root.theme_dark .yamb-telemost-login-page"],
    auto: [":root.theme_auto .yamb-telemost-login-page"],
  },
  call: {
    light: [":root .yamb-video-viewer", ":root .yamb-windowed-meeting"],
    dark: [
      ".theme_dark:root .yamb-video-viewer",
      ":root.theme_dark .yamb-video-viewer",
      ".theme_dark:root .yamb-windowed-meeting",
      ":root.theme_dark .yamb-windowed-meeting",
    ],
    auto: [":root.theme_auto .yamb-video-viewer", ":root.theme_auto .yamb-windowed-meeting"],
  },
  modal: {
    light: [":root .ui-card", ":root .ui-popup", ":root .yamb-modal", ":root .yamb-lightbox"],
    dark: [
      ".theme_dark:root .ui-card",
      ":root.theme_dark .ui-card",
      ".theme_dark:root .ui-popup",
      ":root.theme_dark .ui-popup",
      ".theme_dark:root .yamb-modal",
      ":root.theme_dark .yamb-modal",
    ],
    auto: [":root.theme_auto .ui-card", ":root.theme_auto .ui-popup", ":root.theme_auto .yamb-modal"],
  },
  settings: {
    light: [":root .yamb-settings"],
    dark: [".theme_dark:root .yamb-settings", ":root.theme_dark .yamb-settings"],
    auto: [":root.theme_auto .yamb-settings"],
  },
}

/** Canonical surface keys and their aliases. */
export const SURFACE_ALIASES: Readonly<Record<string, string>> = {
  conversation: "chat",
  app: "page",
  hub: "home",
  threads: "sidebar",
  meeting: "call",
  card: "modal",
  popup: "modal",
}

export function normalizeSurfaceKey(key: string): string {
  return SURFACE_ALIASES[key] ?? key
}

export function normalizeBackgroundItem(item: BackgroundItem): BackgroundProperties {
  if (typeof item === "string") {
    return { image: item }
  }
  return item
}

export const MIME_MAP: Readonly<Record<string, string>> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
}

/**
 * Detects image MIME type by reading magic header bytes.
 */
export function detectImageMimeType(buffer: Buffer): string | undefined {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg"
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png"
  }
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return "image/gif"
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp"
  }
  if (
    buffer.length >= 12 &&
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    const brand = buffer.subarray(8, 12).toString("ascii")
    if (brand === "avif" || brand === "avis") return "image/avif"
  }
  const textHead = buffer.subarray(0, 256).toString("utf8").trimStart()
  if (textHead.startsWith("<?xml") || textHead.startsWith("<svg")) {
    return "image/svg+xml"
  }
  return undefined
}

const DATA_URI_IMAGE_REGEX = /^data:image\/(?:png|jpeg|jpg|webp|gif|avif|svg\+xml);base64,[A-Za-z0-9+/=]+$/

function formatUrl(image: string): string {
  const trimmed = image.trim()
  if (isValidGradientValue(trimmed)) {
    return trimmed
  }
  if (DATA_URI_IMAGE_REGEX.test(trimmed)) {
    const escaped = trimmed.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
    return `url("${escaped}")`
  }
  throw new Error(
    `assertion failed: background image must be resolved to a base64 Data URI or a valid CSS gradient before CSS generation, got "${trimmed}"`,
  )
}

export function renderBackgroundDeclarations(props: BackgroundProperties): Array<readonly [string, string]> {
  if (!props.image) return []
  const decls: Array<readonly [string, string]> = []

  let imageVal: string
  const trimmedImage = props.image.trim()
  if (props.overlay) {
    const overlayGradient = `linear-gradient(${props.overlay}, ${props.overlay})`
    if (isValidGradientValue(trimmedImage)) {
      imageVal = `${overlayGradient}, ${trimmedImage}`
    } else {
      imageVal = `${overlayGradient}, ${formatUrl(props.image)}`
    }
  } else {
    imageVal = formatUrl(props.image)
  }

  decls.push(["background-image", imageVal])
  decls.push(["background-size", props.size ?? "cover"])
  decls.push(["background-position", props.position ?? "center"])
  decls.push(["background-repeat", props.repeat ?? "no-repeat"])

  if (props.attachment) {
    decls.push(["background-attachment", props.attachment])
  }
  if (props.blendMode) {
    decls.push(["background-blend-mode", props.blendMode])
  }
  if (props.opacity !== undefined) {
    decls.push(["opacity", String(props.opacity)])
  }

  return decls
}

/**
 * Resolves an image path or URL. If it points to a local file on disk,
 * reads the file and encodes it as a base64 Data URI.
 */
export async function resolveBackgroundImage(image: string, baseDir: string): Promise<string> {
  const trimmed = image.trim()

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    throw new Error(`remote image URLs are forbidden for security and privacy: ${trimmed}`)
  }

  // Skip existing Data URIs and CSS gradients
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("linear-gradient(") ||
    trimmed.startsWith("radial-gradient(") ||
    trimmed.startsWith("conic-gradient(")
  ) {
    return trimmed
  }

  let cleanPath = trimmed
  if (cleanPath.startsWith("url(") && cleanPath.endsWith(")")) {
    cleanPath = cleanPath.slice(4, -1).trim().replace(/^["']|["']$/g, "")
    if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
      throw new Error(`remote image URLs are forbidden for security and privacy: ${cleanPath}`)
    }
    if (cleanPath.startsWith("data:")) {
      return cleanPath
    }
  }

  const filePath = isAbsolute(cleanPath) ? cleanPath : resolve(baseDir, cleanPath)

  try {
    const buffer = await readFile(filePath)
    const detected = detectImageMimeType(buffer)
    const ext = extname(filePath).toLowerCase()
    const mime = detected ?? MIME_MAP[ext]
    if (!mime) {
      throw new Error(`unrecognized image format for file "${filePath}"`)
    }
    return `data:${mime};base64,${buffer.toString("base64")}`
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`cannot resolve background image "${cleanPath}" from "${baseDir}": ${reason}`)
  }
}

/**
 * Resolves all background image file paths in a theme against the directory of the theme file.
 */
export async function resolveThemeBackgrounds(theme: DesktopTheme, baseDir: string): Promise<DesktopTheme> {
  const resolveConfig = async (config?: BackgroundsConfig): Promise<BackgroundsConfig | undefined> => {
    if (!config) return undefined

    const resolved: Record<string, unknown> = {}

    for (const [key, val] of Object.entries(config)) {
      if (!val) continue
      if (key === "custom" && Array.isArray(val)) {
        const customRules: CustomBackgroundRule[] = []
        for (const rule of val as CustomBackgroundRule[]) {
          const resolvedImg = await resolveBackgroundImage(rule.image, baseDir)
          customRules.push({ ...rule, image: resolvedImg })
        }
        resolved[key] = customRules
      } else {
        const item = normalizeBackgroundItem(val as BackgroundItem)
        if (item.image) {
          const resolvedImg = await resolveBackgroundImage(item.image, baseDir)
          resolved[key] = { ...item, image: resolvedImg }
        } else {
          resolved[key] = { ...item }
        }
      }
    }

    return resolved as BackgroundsConfig
  }

  const lightBackgrounds = await resolveConfig(theme.light.backgrounds)
  const darkBackgrounds = await resolveConfig(theme.dark.backgrounds)
  const rootBackgrounds = await resolveConfig(theme.backgrounds)

  return {
    ...theme,
    backgrounds: rootBackgrounds,
    light: {
      ...theme.light,
      backgrounds: lightBackgrounds,
    },
    dark: {
      ...theme.dark,
      backgrounds: darkBackgrounds,
    },
  }
}

function renderBlock(selector: string, declarations: ReadonlyArray<readonly [string, string]>): string {
  if (declarations.length === 0) return ""
  const body = declarations.map(([name, value]) => `  ${name}: ${value};`).join("\n")
  return `${selector} {\n${body}\n}`
}

export interface BackgroundSections {
  readonly topLevel: string[]
  readonly autoDark: string[]
}

/**
 * Builds the CSS blocks for background images across all configured surfaces.
 */
export function buildBackgroundSections(theme: DesktopTheme): BackgroundSections {
  const topLevel: string[] = []
  const autoDark: string[] = []

  // Combine root and variant backgrounds, with variant overriding root
  const getSurfaceConfig = (
    mode: "light" | "dark",
    surfaceKey: string,
  ): BackgroundProperties | undefined => {
    const norm = normalizeSurfaceKey(surfaceKey)
    const variantConfig = theme[mode].backgrounds as Record<string, unknown> | undefined
    const rootConfig = theme.backgrounds as Record<string, unknown> | undefined

    const findItem = (cfg?: Record<string, unknown>): BackgroundProperties | undefined => {
      if (!cfg) return undefined
      for (const [k, v] of Object.entries(cfg)) {
        if (k === "custom") continue
        if (normalizeSurfaceKey(k) === norm && v) {
          return normalizeBackgroundItem(v as BackgroundItem)
        }
      }
      return undefined
    }

    const rootItem = findItem(rootConfig)
    const variantItem = findItem(variantConfig)
    if (!rootItem && !variantItem) return undefined

    const merged: BackgroundProperties = {
      ...rootItem,
      ...variantItem,
    }
    if (!merged.image) return undefined
    return merged
  }

  // Canonical surface order
  const canonicalSurfaces = ["page", "chat", "sidebar", "home", "login", "call", "modal", "settings"]

  for (const surface of canonicalSurfaces) {
    const selectors = BACKGROUND_SURFACE_SELECTORS[surface]
    if (!selectors) continue

    const lightProps = getSurfaceConfig("light", surface)
    if (lightProps) {
      const decls = renderBackgroundDeclarations(lightProps)
      const block = renderBlock(selectors.light.join(", "), decls)
      if (block) {
        topLevel.push(`/* tto: background.${surface}.light */\n${block}`)
      }
    }

    const darkProps = getSurfaceConfig("dark", surface)
    if (darkProps) {
      const decls = renderBackgroundDeclarations(darkProps)
      const block = renderBlock(selectors.dark.join(", "), decls)
      if (block) {
        topLevel.push(`/* tto: background.${surface}.dark */\n${block}`)
      }
      const autoBlock = renderBlock(selectors.auto.join(", "), decls)
      if (autoBlock) {
        autoDark.push(autoBlock)
      }
    }
  }

  // Custom background rules
  const emitCustomRules = (
    customList: CustomBackgroundRule[] | undefined,
    modeLabel: string,
  ) => {
    if (!customList) return
    for (const rule of customList) {
      const decls = renderBackgroundDeclarations(rule)
      const block = renderBlock(rule.selector, decls)
      if (block) {
        topLevel.push(`/* tto: background.custom.${modeLabel} */\n${block}`)
      }
    }
  }

  emitCustomRules(theme.light.backgrounds?.custom, "light")
  emitCustomRules(theme.dark.backgrounds?.custom, "dark")
  emitCustomRules(theme.backgrounds?.custom, "root")

  return { topLevel, autoDark }
}
