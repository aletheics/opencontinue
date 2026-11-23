import { Box } from "ink"

import { headerLines } from "../header.js"
import { LineText } from "./LineText.js"

export type WelcomeProps = {
  version: string
  model: string
  effort?: string
  provider: string
  workspace: string
  columns: number
}

/**
 * Three-line OpenContinue header: identity/version, model metadata, then the
 * workspace path. The layout lives in `header.ts` so the fullscreen header,
 * inline banner, and expanded transcript cannot drift apart.
 */
export function Welcome({ version, model, effort, provider, workspace, columns }: WelcomeProps) {
  const lines = headerLines({
    version,
    model,
    effort,
    provider,
    workspace,
    columns,
  })

  return (
    <Box flexDirection="column">
      {lines.map((line, index) => (
        <LineText key={index} line={line} />
      ))}
    </Box>
  )
}
