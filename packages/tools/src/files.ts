import { promises as fs } from "node:fs"
import path from "node:path"

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  ".cache",
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
])

export type ListFilesOptions = {
  limit?: number
}

/**
 * Lists regular files under a workspace for prompt completion. Hidden files
 * are included, heavy generated directories are skipped, and symlinks are not
 * followed. Paths use forward slashes on every platform.
 */
export async function listWorkspaceFiles(
  workspace: string,
  options: ListFilesOptions = {},
): Promise<string[]> {
  const limit = Math.max(1, options.limit ?? 2000)
  const root = path.resolve(workspace)
  const files: string[] = []

  const walk = async (directory: string, relative: string): Promise<void> => {
    if (files.length >= limit) return

    let entries
    try {
      entries = await fs.readdir(directory, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (files.length >= limit) return
      if (entry.isSymbolicLink()) continue

      const nextRelative = relative ? `${relative}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) continue
        await walk(path.join(directory, entry.name), nextRelative)
      } else if (entry.isFile()) {
        files.push(nextRelative)
      }
    }
  }

  await walk(root, "")
  return files.sort((left, right) => left.localeCompare(right))
}
