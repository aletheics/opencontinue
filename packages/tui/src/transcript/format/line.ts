export type Span = {
  text: string
  color?: string
  dim?: boolean
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  backgroundColor?: string
}

export type Line = {
  text: string
  color?: string
  dim?: boolean
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  backgroundColor?: string
  spans?: Span[]
}
