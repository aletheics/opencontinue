import type {
  PermissionMode,
  PermissionPolicy,
} from "@opencontinue/protocol"

import { glyphs } from "../glyphs.js"

const EMPTY: PermissionPolicy = { allow: [], ask: [], deny: [] }

function list(values: readonly string[]): string {
  return values.length > 0 ? values.join(", ") : "(none)"
}

export function formatPermissions(
  mode: PermissionMode,
  policy: PermissionPolicy = EMPTY,
): string {
  const label = `${mode.charAt(0).toUpperCase()}${mode.slice(1)}`
  return [
    `${glyphs.brand} Permissions`,
    `Mode    ${label}`,
    `Allow   ${list(policy.allow)}`,
    `Ask     ${list(policy.ask)}`,
    `Deny    ${list(policy.deny)}`,
  ].join("\n")
}
