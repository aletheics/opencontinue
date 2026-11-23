import { constants, existsSync } from "node:fs"
import { access, readFile, stat } from "node:fs/promises"
import path from "node:path"

import { HttpSessionClient } from "@opencontinue/client"
import { authPath, configHome, configPath, resolveProviderSettings } from "@opencontinue/config"
import { createProvider, listModels } from "@opencontinue/providers"

export type DoctorStatus = "ok" | "warn" | "fail"

export type DoctorCheck = {
  name: string
  status: DoctorStatus
  detail: string
}

export type DoctorOptions = {
  workspace: string
  url?: string
  network?: boolean
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function gitBranch(workspace: string): Promise<string | null> {
  let gitDirectory = path.join(workspace, ".git")

  try {
    const marker = await readFile(gitDirectory, "utf8")
    const match = marker.match(/^gitdir:\s*(.+)$/m)
    if (match?.[1]) gitDirectory = path.resolve(workspace, match[1].trim())
  } catch {
    // A normal .git directory is not a file. Continue.
  }

  try {
    const head = (await readFile(path.join(gitDirectory, "HEAD"), "utf8")).trim()
    if (head.startsWith("ref: refs/heads/")) return head.slice("ref: refs/heads/".length)
    return head.slice(0, 7)
  } catch {
    return null
  }
}

export async function runDoctor(options: DoctorOptions): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = []
  const workspace = path.resolve(options.workspace)

  const major = Number(process.versions.node.split(".")[0] ?? 0)
  checks.push({
    name: "node",
    status: major >= 22 ? "ok" : "fail",
    detail: `v${process.versions.node}${major >= 22 ? "" : " · Node 22+ is required"}`,
  })

  try {
    const info = await stat(workspace)
    if (!info.isDirectory()) throw new Error("not a directory")
    await access(workspace, constants.W_OK)
    checks.push({ name: "workspace", status: "ok", detail: workspace })
  } catch (error) {
    checks.push({ name: "workspace", status: "fail", detail: `${workspace} · ${errorText(error)}` })
  }

  const branch = await gitBranch(workspace)
  checks.push({
    name: "git",
    status: branch ? "ok" : "warn",
    detail: branch
      ? `${branch} · ${path.join(workspace, ".git")}`
      : "not a git repository · checks and worktrees need git",
  })

  const home = configHome()
  const hasConfig = existsSync(configPath())
  const hasAuth = existsSync(authPath())
  checks.push({
    name: "config",
    status: hasConfig ? "ok" : "warn",
    detail: hasConfig
      ? configPath()
      : `${home} · run opencontinue setup to choose a provider`,
  })
  checks.push({
    name: "auth",
    status: hasAuth ? "ok" : "warn",
    detail: hasAuth ? authPath() : `${home} · no auth.json yet`,
  })

  const settings = resolveProviderSettings()
  const selection = createProvider(settings)
  const configured = !selection.fallback || settings.provider === "echo"
  checks.push({
    name: "provider",
    status: configured ? "ok" : "warn",
    detail: configured
      ? `${selection.provider.id} · ${selection.provider.model}${selection.warning ? ` · ${selection.warning}` : ""}`
      : "no provider configured · run opencontinue setup or opencontinue import",
  })

  const database =
    process.env.OPENCONTINUE_DB ??
    path.join(workspace, ".opencontinue", "sessions", "sessions.db")
  const databaseExists = existsSync(database)
  let probe = path.dirname(database)
  while (!existsSync(probe)) {
    const parent = path.dirname(probe)
    if (parent === probe) break
    probe = parent
  }
  try {
    await access(probe, constants.W_OK)
    checks.push({
      name: "sessions",
      status: "ok",
      detail: `${database}${databaseExists ? "" : " · will be created on first run"}`,
    })
  } catch (error) {
    checks.push({
      name: "sessions",
      status: "fail",
      detail: `${database} · ${errorText(error)}`,
    })
  }

  if (options.url) {
    const client = new HttpSessionClient({ baseUrl: options.url })
    try {
      const health = await client.health()
      const sessions = await client.listSessions()
      checks.push({
        name: "server",
        status: health.ok ? "ok" : "fail",
        detail: `${options.url} · ${sessions.length} session(s)`,
      })
    } catch (error) {
      checks.push({ name: "server", status: "fail", detail: `${options.url} · ${errorText(error)}` })
    } finally {
      client.close()
    }
  }

  if (options.network) {
    try {
      const models = await listModels(settings)
      checks.push({
        name: "network",
        status: models.length > 0 ? "ok" : "warn",
        detail:
          models.length > 0
            ? `${models.length} model(s) · ${models.slice(0, 3).join(", ")}`
            : "provider returned no models",
      })
    } catch (error) {
      checks.push({ name: "network", status: "fail", detail: errorText(error) })
    }
  }

  return checks
}

export function formatDoctor(checks: DoctorCheck[]): string {
  const lines = checks.map((check) => {
    const marker = check.status === "ok" ? "✓" : check.status === "warn" ? "!" : "✗"
    return `${marker} ${check.name.padEnd(10)} ${check.detail}`
  })
  const failures = checks.filter((check) => check.status === "fail").length
  const warnings = checks.filter((check) => check.status === "warn").length
  lines.push("")
  lines.push(
    failures > 0
      ? `${failures} failure(s), ${warnings} warning(s)`
      : warnings > 0
        ? `ok with ${warnings} warning(s)`
        : "all checks passed",
  )
  return lines.join("\n")
}

export function doctorExitCode(checks: DoctorCheck[]): number {
  return checks.some((check) => check.status === "fail") ? 1 : 0
}

export function defaultWorkspace(): string {
  return process.env.INIT_CWD ?? process.cwd()
}
