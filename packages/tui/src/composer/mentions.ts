export type MentionCompletion = {
  value: string
  cursor: number
}

/**
 * The token before the cursor, only when `@` starts a word.
 * `name@host` is not a mention; `see @src/app` is.
 */
export function mentionQueryAt(input: string, cursor: number): string | null {
  const before = input.slice(0, cursor)
  const match = before.match(/(?:^|\s)@([^\s@]*)$/)
  return match?.[1] ?? null
}

function score(file: string, query: string): number {
  const lower = file.toLowerCase()
  const base = lower.split("/").at(-1) ?? ""
  if (base.startsWith(query)) return 0
  if (lower.startsWith(query)) return 1
  if (base.includes(query)) return 2
  return 3
}

export function filterWorkspaceFiles(
  files: readonly string[],
  query: string,
  limit = 20,
): string[] {
  const needle = query.toLowerCase()
  return files
    .filter((file) => file.toLowerCase().includes(needle))
    .sort(
      (left, right) =>
        score(left, needle) - score(right, needle) ||
        left.length - right.length ||
        left.localeCompare(right),
    )
    .slice(0, Math.max(1, limit))
}

/**
 * Replace the active `@token` with `@file ` and place the cursor after it.
 */
export function completeMention(
  input: string,
  cursor: number,
  file: string,
): MentionCompletion | null {
  const before = input.slice(0, cursor)
  const match = before.match(/(^|\s)@([^\s@]*)$/)
  if (!match) return null

  const start = before.length - (match[0]?.length ?? 0) + (match[1]?.length ?? 0)
  return {
    value: `${input.slice(0, start)}@${file} ${input.slice(cursor)}`,
    cursor: start + file.length + 2,
  }
}
