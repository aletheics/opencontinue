import { Text } from "ink"

import { theme } from "../theme.js"

export type PickerItem = {
  key: string
  label: string
  note?: string
}

export type PickerProps = {
  header: string
  items: PickerItem[]
  selectedIndex: number
  windowSize: number
  emptyText: string
}

export function Picker({
  header,
  items,
  selectedIndex,
  windowSize,
  emptyText,
}: PickerProps) {
  if (items.length === 0) {
    return (
      <>
        <Text dimColor wrap="truncate">
          {emptyText}
        </Text>
        <Text dimColor wrap="truncate">
          Backspace to edit · Esc to clear
        </Text>
      </>
    )
  }

  const size = Math.max(1, windowSize)
  const selected = Math.min(selectedIndex, items.length - 1)
  const start = Math.max(
    0,
    Math.min(selected - Math.floor(size / 2), Math.max(0, items.length - size)),
  )
  const visible = items.slice(start, start + size)

  return (
    <>
      <Text dimColor wrap="truncate">
        {header}
      </Text>
      {visible.map((item, offset) => {
        const index = start + offset
        const active = index === selected
        return (
          <Text
            key={item.key}
            color={active ? theme.brand : undefined}
            wrap="truncate"
          >
            {active ? "› " : "  "}
            {item.label}
            {item.note ? ` — ${item.note}` : ""}
          </Text>
        )
      })}
    </>
  )
}
