import { useStdout } from "ink"
import { useEffect, useState } from "react"

export type TerminalSize = {
  columns: number
  rows: number
}

/**
 * One row/column of margin keeps rules and prompts from wrapping.
 */
export function useTerminalSize(): TerminalSize {
  const stdout = useStdout().stdout as unknown as {
    columns?: number
    rows?: number
  }
  const read = (): TerminalSize => ({
    columns: Math.max(40, (stdout.columns ?? 80) - 1),
    rows: Math.max(12, (stdout.rows ?? 24) - 1),
  })
  const [size, setSize] = useState(read)

  useEffect(() => {
    const onResize = () => setSize(read())
    process.stdout.on("resize", onResize)
    return () => {
      process.stdout.off("resize", onResize)
    }
  }, [])

  return size
}
