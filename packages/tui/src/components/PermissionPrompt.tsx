import { Box, Text } from "ink"

import { glyphs } from "../glyphs.js"
import {
  formatDiffLines,
  toolDisplayName,
} from "../transcript/format/index.js"
import { theme } from "../theme.js"

export type PermissionPromptProps = {
  columns: number
  permission: { tool: string; detail: string; cwd?: string; diff?: string }
}

/**
 * Inline approval card. The runtime has already decided this operation needs
 * consent; show the exact operation, target, and working directory.
 */
export function PermissionPrompt({ columns, permission }: PermissionPromptProps) {
  const action = permission.tool === "bash" ? "execute" : "use"

  return (
    <Box marginTop={1} paddingX={2} flexDirection="column">
      <Text color={theme.warning} wrap="truncate">
        {glyphs.approval} Permission required
      </Text>
      <Text wrap="truncate">
        OpenContinue wants to {action}{" "}
        <Text bold>{toolDisplayName(permission.tool)}</Text>:
      </Text>
      <Text bold wrap="truncate">
        {"  "}
        {permission.detail || "(no details)"}
      </Text>
      {permission.cwd ? (
        <Text dimColor wrap="truncate">
          Working directory: {permission.cwd}
        </Text>
      ) : null}
      {permission.diff
        ? formatDiffLines(permission.diff, Math.max(20, columns - 6), false)
            .slice(0, 6)
            .map((line, index) => (
              <Text
                key={index}
                color={line.color}
                dimColor={line.dim}
                wrap="truncate"
              >
                {"  "}
                {line.text}
              </Text>
            ))
        : null}
      <Text dimColor wrap="truncate">
        [y] Allow once · [a] Always allow this tool for this session · [n] Deny
      </Text>
    </Box>
  )
}
