import { Box } from "ink"

import { Input } from "../composer/editor/Input.js"

export type PromptProps = {
  columns: number
  input: string
  cursor: number
  prefix?: string
  menuOpen: boolean
  onInput: (value: string, cursor: number) => void
  onSubmit: (value: string) => void
}

export function Prompt({
  columns,
  input,
  cursor,
  prefix = "› ",
  menuOpen,
  onInput,
  onSubmit,
}: PromptProps) {
  const rows = Math.min(6, Math.max(1, input.split("\n").length))

  return (
    <Box>
      <Input
        value={input}
        cursor={cursor}
        width={Math.max(8, columns - 2)}
        rows={rows}
        placeholder="Type a message…"
        prefix={prefix}
        menuOpen={menuOpen}
        onChange={onInput}
        onSubmit={onSubmit}
      />
    </Box>
  )
}
