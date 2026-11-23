import { describe, expect, it } from "vitest"

import {
  fullscreenViewportHeight,
  scrollViewport,
  viewportWindow,
} from "./layout.js"

describe("fullscreen layout", () => {
  it("follows the transcript tail at scroll zero", () => {
    expect(viewportWindow(100, 10, 0)).toMatchObject({
      start: 90,
      end: 100,
      hiddenAbove: 90,
      hiddenBelow: 0,
      atBottom: true,
      maxScroll: 90,
    })
  })

  it("windows lines when scrolled up and clamps the offset", () => {
    expect(viewportWindow(100, 10, 5)).toMatchObject({
      start: 85,
      end: 95,
      hiddenAbove: 85,
      hiddenBelow: 5,
      atBottom: false,
    })
    expect(viewportWindow(100, 10, 500)).toMatchObject({
      start: 0,
      end: 10,
      hiddenAbove: 0,
      hiddenBelow: 90,
    })
    expect(viewportWindow(4, 10, 0)).toMatchObject({
      start: 0,
      end: 4,
      atBottom: true,
    })
  })

  it("reserves space for fixed regions", () => {
    expect(
      fullscreenViewportHeight({
        rows: 30,
        header: 2,
        activity: 2,
        todos: 4,
        queued: 0,
        composer: 4,
        menus: 0,
        footer: 1,
      }),
    ).toBe(16)
    expect(
      fullscreenViewportHeight({
        rows: 10,
        header: 2,
        activity: 2,
        todos: 5,
        queued: 1,
        composer: 4,
        menus: 6,
        footer: 1,
      }),
    ).toBe(3)
  })

  it("scrolls within bounds", () => {
    expect(scrollViewport(0, 100, 10, 5)).toBe(5)
    expect(scrollViewport(88, 100, 10, 5)).toBe(90)
    expect(scrollViewport(2, 100, 10, -5)).toBe(0)
  })
})
