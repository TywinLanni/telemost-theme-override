import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

/**
 * Where user-editable configuration lives.
 *
 * `%LOCALAPPDATA%` itself is a shared root — writing bare `theme.json` and
 * `config.json` into it would collide with other software. We use a named
 * subdirectory, which is the documented convention for per-user, per-app,
 * machine-local state.
 *
 * Local (not Roaming) is deliberate: the config pins an absolute path to a
 * locally installed executable, which is meaningless on another machine.
 */
export function configDir(env: NodeJS.ProcessEnv = process.env): string {
  const localAppData = env.LOCALAPPDATA
  if (localAppData && localAppData.length > 0) return join(localAppData, "TelemostThemeOverride")
  return join(homedir(), "AppData", "Local", "TelemostThemeOverride")
}

export function themeFilePath(env: NodeJS.ProcessEnv = process.env): string {
  return join(configDir(env), "theme.json")
}

export function appConfigFilePath(env: NodeJS.ProcessEnv = process.env): string {
  return join(configDir(env), "config.json")
}

export function presetsDir(env: NodeJS.ProcessEnv = process.env): string {
  return join(configDir(env), "presets")
}

/**
 * Candidate install locations for Telemost, most specific first.
 *
 * Telemost is distributed as an MSI that does not reliably register an
 * `InstallLocation` under the usual Uninstall keys (verified: the registry
 * query returns nothing on a working install), so probing known paths is more
 * dependable than reading the registry.
 */
export function telemostCandidates(env: NodeJS.ProcessEnv = process.env): string[] {
  const programFiles = env.ProgramFiles ?? "C:\\Program Files"
  const programFilesX86 = env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)"
  const localAppData = env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local")

  return [
    join(programFiles, "Yandex", "YandexTelemost", "YandexTelemost.exe"),
    join(programFilesX86, "Yandex", "YandexTelemost", "YandexTelemost.exe"),
    join(localAppData, "Yandex", "YandexTelemost", "YandexTelemost.exe"),
    join(localAppData, "Programs", "Yandex", "YandexTelemost", "YandexTelemost.exe"),
  ]
}

export function findTelemost(env: NodeJS.ProcessEnv = process.env): string | null {
  for (const candidate of telemostCandidates(env)) {
    if (existsSync(candidate)) return candidate
  }
  return null
}
