import { Box, Text } from "ink"

import { PRODUCT_NAME } from "../brand.js"
import { headerMeta } from "../header.js"
import { glyphs } from "../glyphs.js"
import { theme } from "../theme.js"

export type WelcomeProps = {
  version: string
  model: string
  provider: string
  workspace: string
  branch?: string
  columns: number
}

/**
 * Two-line OpenContinue header: identity/version, then compact metadata.
 * The full workspace path lives in /status.
 */
export function Welcome({
  version,
  model,
  provider,
  workspace,
  branch,
  columns,
}: WelcomeProps) {
  const meta = headerMeta(model, provider, workspace, branch, Math.max(10, columns))

  return (
    <Box flexDirection="column">
      <Text wrap="truncate">
        <Text color={theme.brand}>{glyphs.brand}</Text>
        <Text bold> {PRODUCT_NAME}</Text>
        <Text color={theme.textMuted}>{"  "}v{version}</Text>
      </Text>
      <Text color={theme.textSecondary} wrap="truncate">
        {meta}
      </Text>
    </Box>
  )
}
