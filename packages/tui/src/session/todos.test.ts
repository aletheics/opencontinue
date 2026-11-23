import { describe, expect, it } from "vitest"

import type { TimelineItem } from "../timeline.js"
import { activeTodo, latestTodos, todoProgress } from "./todos.js"

function todoItem(
  id: string,
  todos: Array<{ content: string; status: string; activeForm?: string }>,
): TimelineItem {
  return {
    kind: "tool",
    id,
    runId: "r1",
    name: "todo",
    input: { todos },
    status: "done",
    output: "1/2 complete",
  }
}

describe("todo projection", () => {
  it("uses the newest valid todo list", () => {
    const items: TimelineItem[] = [
      todoItem("t1", [{ content: "Inspect", status: "completed" }]),
      todoItem("t2", [
        { content: "Inspect", status: "completed" },
        { content: "Fix", status: "in_progress", activeForm: "Fixing" },
      ]),
    ]

    const todos = latestTodos(items)
    expect(todos).toHaveLength(2)
    expect(todoProgress(todos)).toEqual({ done: 1, total: 2 })
    expect(activeTodo(todos)?.activeForm).toBe("Fixing")
  })

  it("ignores malformed todo calls", () => {
    const items: TimelineItem[] = [
      todoItem("t1", [{ content: "Keep me", status: "pending" }]),
      { kind: "tool", id: "t2", runId: "r1", name: "todo", input: {}, status: "failed" },
    ]

    expect(latestTodos(items).map((todo) => todo.content)).toEqual(["Keep me"])
  })

  it("returns no todos for an empty session", () => {
    expect(latestTodos([])).toEqual([])
  })
})
