import { Box, Text } from "ink"

import { glyphs } from "../glyphs.js"
import { todoProgress, type Todo } from "../session/todos.js"
import { theme } from "../theme.js"

export function TodoPanel({
  todos,
  maxItems,
}: {
  todos: Todo[]
  maxItems?: number
}) {
  if (todos.length === 0) return null
  const { done, total } = todoProgress(todos)
  const visible =
    maxItems && todos.length > maxItems ? todos.slice(0, maxItems) : todos
  const hidden = todos.length - visible.length

  return (
    <Box flexDirection="column" paddingX={2} marginTop={1}>
      <Text dimColor wrap="truncate">
        {glyphs.brand} Tasks · {done}/{total}
      </Text>
      {visible.map((todo, index) => {
        const marker =
          todo.status === "completed"
            ? glyphs.done
            : todo.status === "in_progress"
              ? glyphs.active
              : glyphs.pending
        const label =
          todo.status === "in_progress"
            ? (todo.activeForm ?? todo.content)
            : todo.content

        return (
          <Text
            key={index}
            wrap="truncate"
            color={
              todo.status === "completed"
                ? theme.success
                : todo.status === "in_progress"
                  ? theme.working
                  : undefined
            }
            dimColor={todo.status === "pending"}
          >
            {marker} {label}
          </Text>
        )
      })}
      {hidden > 0 ? (
        <Text dimColor wrap="truncate">
          {"  "}… +{hidden} more
        </Text>
      ) : null}
    </Box>
  )
}
