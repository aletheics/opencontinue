import { readFileSync } from "node:fs"
import path from "node:path"

export type WorkspaceInfo = {
  name: string
  branch: string | null
}

/**
 * Reads `.git/HEAD` directly and walks up from the workspace.
 * Detached HEAD is shown as a short hash.
 */
export function workspaceInfo(workspace: string): WorkspaceInfo {
  const root = path.resolve(workspace)
  let branch: string | null = null
  let directory = root

  for (let depth = 0; depth < 8; depth++) {
    try {
      const head = readFileSync(path.join(directory, ".git", "HEAD"), "utf8").trim()
      if (head.startsWith("ref: refs/heads/")) {
        branch = head.slice("ref: refs/heads/".length)
      } else if (head) {
        branch = head.slice(0, 7)
      }
      break
    } catch {
      const parent = path.dirname(directory)
      if (parent === directory) break
      directory = parent
    }
  }

  return { name: path.basename(root), branch }
}
