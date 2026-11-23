import { randomBytes, timingSafeEqual } from "node:crypto"

export type ServerSecurity = {
  token: string
  cors: readonly string[]
}

/** Configured token wins; otherwise each server process gets a fresh local token. */
export function resolveServerToken(
  configured: string | undefined,
  env: Record<string, string | undefined> = process.env,
): string {
  const value = configured?.trim() || env.OPENCONTINUE_SERVER_TOKEN?.trim()
  return value && value.length > 0 ? value : randomBytes(24).toString("base64url")
}

export function bearerAuthorized(
  header: string | undefined,
  token: string,
): boolean {
  const match = header?.match(/^Bearer\s+(.+)$/i)
  if (!match?.[1]) return false
  const actual = Buffer.from(match[1])
  const expected = Buffer.from(token)
  return (
    actual.length === expected.length && timingSafeEqual(actual, expected)
  )
}

/**
 * Same-host browser requests and explicit allow-list origins pass. CLI/TUI
 * requests have no Origin header. A wildcard is never accepted.
 */
export function originAllowed(
  origin: string | undefined,
  host: string | undefined,
  cors: readonly string[],
): boolean {
  if (!origin) return true
  if (origin === "*") return false

  if (host) {
    try {
      if (new URL(origin).host === host) return true
    } catch {
      // "null" and malformed origins are not allowed.
    }
  }

  return origin !== "*" && cors.includes(origin)
}
