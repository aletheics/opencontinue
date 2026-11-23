import { isUtf8 } from "node:buffer"
import { existsSync } from "node:fs"
import path from "node:path"

export type ShellFamily = "bash" | "powershell" | "cmd" | "sh"

export type ShellSpec = {
  file: string
  name: ShellFamily
  args: string[]
}

function executableName(file: string): string {
  return path.win32.basename(path.win32.normalize(file)).toLowerCase()
}

export function shellFamily(file: string): ShellFamily {
  const name = executableName(file)
  if (name === "cmd" || name === "cmd.exe") return "cmd"
  if (
    name === "pwsh" ||
    name === "pwsh.exe" ||
    name.startsWith("powershell")
  ) {
    return "powershell"
  }
  if (name === "bash" || name === "bash.exe" || name === "zsh" || name === "sh") {
    return "bash"
  }
  return "sh"
}

/** Platform-specific arguments. Windows commands run with UTF-8 output. */
export function shellArgs(file: string, command: string): string[] {
  switch (shellFamily(file)) {
    case "cmd":
      return ["/d", "/s", "/c", `chcp 65001>nul & ${command}`]
    case "powershell":
      return [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); $OutputEncoding=[System.Text.UTF8Encoding]::new(); $global:LASTEXITCODE=0; ${command}\nexit $LASTEXITCODE`,
      ]
    case "bash":
      return ["-c", command]
    default:
      return ["-c", command]
  }
}

function executableExtensions(
  platform: NodeJS.Platform,
  env: Record<string, string | undefined>,
): string[] {
  if (platform !== "win32") return [""]
  return (env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM")
    .split(";")
    .filter(Boolean)
}

function findExecutable(
  name: string,
  platform: NodeJS.Platform,
  env: Record<string, string | undefined>,
): string | undefined {
  if (path.isAbsolute(name) || /^[A-Za-z]:[\\/]/.test(name)) {
    return existsSync(name) ? name : undefined
  }

  const pathValue = env.PATH ?? env.Path ?? ""
  const directories = pathValue.split(platform === "win32" ? ";" : ":")
  const extensions = executableExtensions(platform, env)
  const hasExtension = path.extname(name).length > 0

  for (const directory of directories) {
    if (!directory) continue
    if (hasExtension) {
      const candidate = path.join(directory, name)
      if (existsSync(candidate)) return candidate
      continue
    }
    for (const extension of extensions) {
      const candidate = path.join(directory, `${name}${extension}`)
      if (existsSync(candidate)) return candidate
    }
  }

  return undefined
}

function gitBash(
  platform: NodeJS.Platform,
  env: Record<string, string | undefined>,
): string | undefined {
  if (platform !== "win32") return undefined
  const git = findExecutable("git", platform, env)
  if (!git) return undefined

  const root = path.dirname(git)
  const candidates = [
    path.join(root, "bash.exe"),
    path.join(root, "..", "bin", "bash.exe"),
    path.join(root, "..", "..", "bin", "bash.exe"),
  ]
  return candidates.find((candidate) => existsSync(candidate))
}

/** Choose a real shell executable instead of Node's opaque `shell: true`. */
export function resolveShell(
  command: string,
  platform: NodeJS.Platform = process.platform,
  env: Record<string, string | undefined> = process.env,
): ShellSpec {
  const configured = env.OPENCONTINUE_SHELL?.trim()
  if (configured) {
    const file =
      findExecutable(configured, platform, env) ??
      (existsSync(configured) ? configured : undefined)
    if (file) return { file, name: shellFamily(file), args: shellArgs(file, command) }
  }

  if (platform === "win32") {
    const file =
      findExecutable("pwsh", platform, env) ??
      gitBash(platform, env) ??
      findExecutable("powershell", platform, env) ??
      findExecutable(env.COMSPEC ?? "cmd.exe", platform, env) ??
      env.COMSPEC ??
      "cmd.exe"
    return { file, name: shellFamily(file), args: shellArgs(file, command) }
  }

  const file =
    findExecutable(env.SHELL ?? "bash", platform, env) ??
    (existsSync("/bin/bash") ? "/bin/bash" : "/bin/sh")
  return { file, name: shellFamily(file), args: shellArgs(file, command) }
}

/**
 * Decode process output without assuming a Windows console codepage. UTF-8 is
 * preferred; a legacy Chinese Windows console falls back to GBK.
 */
export function decodeOutput(
  bytes: Buffer,
  platform: NodeJS.Platform = process.platform,
): string {
  if (bytes.length === 0) return ""

  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes)
  }

  if (isUtf8(bytes)) {
    return new TextDecoder("utf-8", { ignoreBOM: false }).decode(bytes)
  }

  if (platform === "win32") {
    for (const encoding of ["gbk", "gb18030"]) {
      try {
        return new TextDecoder(encoding).decode(bytes)
      } catch {
        // Fall through to the next decoder.
      }
    }
  }

  return bytes.toString("latin1")
}
