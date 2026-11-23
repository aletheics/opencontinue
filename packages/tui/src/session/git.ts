import { execFile } from "node:child_process"
import { promisify } from "node:util"

const exec = promisify(execFile)

export type WorkspaceDiff = {
  status: string
  stat: string
}

async function git(workspace: string, args: string[]): Promise<string> {
  const { stdout } = await exec("git", args, {
    cwd: workspace,
    timeout: 5_000,
    maxBuffer: 1_000_000,
    windowsHide: true,
  })
  return stdout.trimEnd()
}

/**
 * Read-only view of the working tree. Uses git plumbing directly so the TUI
 * never shells through the agent permission gate for a display command.
 */
export async function workspaceDiff(workspace: string): Promise<WorkspaceDiff> {
  const status = await git(workspace, [
    "-c",
    "color.ui=false",
    "status",
    "--short",
  ])
  const stat = await git(workspace, [
    "-c",
    "color.ui=false",
    "diff",
    "--stat",
  ])
  return { status, stat }
}

export function formatWorkspaceDiff(diff: WorkspaceDiff): string {
  const lines = [diff.status, diff.stat].filter((part) => part.length > 0)
  return lines.length > 0 ? lines.join("\n") : "No working tree changes."
}
