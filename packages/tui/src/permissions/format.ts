import type { PermissionMode, PermissionPolicy } from "@opencontinue/protocol"

import { glyphs } from "../glyphs.js"
import { modeName } from "./types.js"

const EMPTY: PermissionPolicy = { allow: [], ask: [], deny: [] }

function list(values: readonly string[]): string {
  return values.length > 0 ? values.join(", ") : "(none)"
}

export function formatPermissions(mode: PermissionMode, policy: PermissionPolicy = EMPTY): string {
  return [
    `${glyphs.brand} Permissions`,
    `Mode    ${modeName(mode)}`,
    `Allow   ${list(policy.allow)}`,
    `Ask     ${list(policy.ask)}`,
    `Deny    ${list(policy.deny)}`,
  ].join("\n")
}
