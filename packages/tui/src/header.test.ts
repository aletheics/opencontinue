import { describe, expect, it } from "vitest"

import { headerMeta, truncateToWidth, workspaceName } from "./header.js"

describe("header helpers", () => {
  it("shows the workspace basename and branch when they fit", () => {
    expect(
      headerMeta(
        "deepseek-flash",
        "DeepSeek",
        "D:\\soft\\vscodefiles\\opencontinue",
        "main",
        120,
      ),
    ).toBe("deepseek-flash · DeepSeek · opencontinue · main")
  })

  it("drops branch, then workspace, before truncating", () => {
    expect(
      headerMeta("deepseek-flash", "DeepSeek", "/work/opencontinue", "main", 40),
    ).toBe("deepseek-flash · DeepSeek · opencontinue")
    expect(
      headerMeta("deepseek-flash", "DeepSeek", "/work/opencontinue", "main", 30),
    ).toBe("deepseek-flash · DeepSeek")
    expect(
      headerMeta("deepseek-flash", "DeepSeek", "/work/opencontinue", "main", 12),
    ).toBe("deepseek-fl…")
  })

  it("measures CJK cells", () => {
    expect(workspaceName("D:\\项目\\opencontinue")).toBe("opencontinue")
    expect(truncateToWidth("你好世界", 5)).toBe("你好…")
  })
})
