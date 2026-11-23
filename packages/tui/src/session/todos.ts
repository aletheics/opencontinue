import type { TimelineItem } from "../timeline.js"

export type TodoStatus = "pending" | "in_progress" | "completed"

export type Todo = {
  content: string
  status: TodoStatus
  activeForm?: string
}

function parseTodos(input: unknown): Todo[] | null {
  const value =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : {}
  if (!Array.isArray(value.todos)) return null

  const todos: Todo[] = []
  for (const entry of value.todos) {
    if (typeof entry !== "object" || entry === null) continue
    const record = entry as Record<string, unknown>
    const content = typeof record.content === "string" ? record.content : ""
    const status = record.status
    if (
      content.length === 0 ||
      (status !== "pending" && status !== "in_progress" && status !== "completed")
    ) {
      continue
    }
    todos.push({
      content,
      status,
      ...(typeof record.activeForm === "string"
        ? { activeForm: record.activeForm }
        : {}),
    })
  }

  return todos.length > 0 ? todos : null
}

/**
 * The newest valid todo list in the session. Todo tool calls replace the
 * whole list, so the last one is the current state.
 */
export function latestTodos(items: TimelineItem[]): Todo[] {
  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index]
    if (item?.kind !== "tool" || item.name !== "todo") continue
    const todos = parseTodos(item.input)
    if (todos) return todos
  }
  return []
}

export function todoProgress(todos: Todo[]): { done: number; total: number } {
  return {
    done: todos.filter((todo) => todo.status === "completed").length,
    total: todos.length,
  }
}

export function activeTodo(todos: Todo[]): Todo | undefined {
  return todos.find((todo) => todo.status === "in_progress")
}
