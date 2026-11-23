import { theme } from "../../theme.js"
import type { Span } from "./line.js"

export type HighlightState = { inBlockComment: boolean }

const C_LIKE = new Set([
  "ts",
  "tsx",
  "typescript",
  "js",
  "jsx",
  "javascript",
  "json",
  "java",
  "c",
  "cpp",
  "cs",
  "csharp",
  "go",
  "rust",
  "rs",
  "swift",
  "kotlin",
  "kt",
  "php",
  "scss",
  "css",
  "less",
])

const KEYWORDS: Record<string, Set<string>> = {
  js: new Set(
    "as async await break case catch class const continue debugger default delete do else enum export extends false finally for from function get if implements import in instanceof interface let new null of private protected public readonly return set static super switch this throw true try type typeof undefined var void while yield".split(
      " ",
    ),
  ),
  py: new Set(
    "and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield".split(
      " ",
    ),
  ),
  go: new Set(
    "break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var true false nil".split(
      " ",
    ),
  ),
  rust: new Set(
    "as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while".split(
      " ",
    ),
  ),
  sh: new Set(
    "if then else elif fi for while until do done case esac function in export local return set unset echo cd source alias".split(
      " ",
    ),
  ),
  json: new Set(["true", "false", "null"]),
  powershell: new Set(
    "begin break catch class continue data define do dynamicparam else elseif end enum exit filter finally for foreach from function if in param process return static switch throw trap try until using var while".split(
      " ",
    ),
  ),
  yaml: new Set(["true", "false", "null", "yes", "no", "on", "off", "~"]),
}

const SHARED_LITERALS = new Set([
  "true",
  "false",
  "null",
  "undefined",
  "None",
  "True",
  "False",
  "nil",
])

function normalizeLanguage(language: string): string {
  const value = language.toLowerCase()
  if (["js", "jsx", "javascript", "ts", "tsx", "typescript"].includes(value)) return "js"
  if (["py", "python"].includes(value)) return "py"
  if (["sh", "bash", "zsh", "shell"].includes(value)) return "sh"
  if (["rs", "rust"].includes(value)) return "rust"
  if (["go", "golang"].includes(value)) return "go"
  if (["powershell", "pwsh", "ps1"].includes(value)) return "powershell"
  if (["yaml", "yml"].includes(value)) return "yaml"
  if (["md", "markdown"].includes(value)) return "markdown"
  if (["diff", "patch"].includes(value)) return "diff"
  if (value === "json") return "json"
  return value
}

const LANGUAGE_LABELS: Record<string, string> = {
  ts: "ts",
  tsx: "tsx",
  typescript: "ts",
  js: "js",
  jsx: "jsx",
  javascript: "js",
  json: "json",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  shell: "bash",
  powershell: "powershell",
  pwsh: "powershell",
  ps1: "powershell",
  py: "python",
  python: "python",
  yaml: "yaml",
  yml: "yaml",
  md: "markdown",
  markdown: "markdown",
  diff: "diff",
  patch: "diff",
}

/** Canonical, short label shown above a fenced code block. */
export function codeLanguageLabel(language: string): string | undefined {
  const value = language.trim().toLowerCase()
  if (!value) return undefined
  return LANGUAGE_LABELS[value] ?? value
}

function keywordsFor(language: string): Set<string> {
  return KEYWORDS[normalizeLanguage(language)] ?? new Set()
}

function lineComment(language: string): string | null {
  const value = language.toLowerCase()
  if (
    value === "py" ||
    value === "python" ||
    value === "sh" ||
    value === "bash" ||
    value === "zsh" ||
    value === "shell" ||
    value === "rb" ||
    value === "ruby"
  )
    return "#"
  if (
    value === "yaml" ||
    value === "yml" ||
    value === "toml" ||
    value === "powershell" ||
    value === "pwsh" ||
    value === "ps1"
  )
    return "#"
  if (C_LIKE.has(value)) return "//"
  return null
}

function supportsBlockComment(language: string): boolean {
  return C_LIKE.has(language.toLowerCase())
}

function push(spans: Span[], text: string, color?: string, dim?: boolean): void {
  if (!text) return
  const last = spans.at(-1)
  if (last && last.color === color && Boolean(last.dim) === Boolean(dim)) {
    last.text += text
    return
  }
  spans.push({ text, color, dim })
}

function findComment(line: string): number {
  let quote: string | null = null

  for (let index = 0; index < line.length; index++) {
    const char = line[index] ?? ""
    if (quote) {
      if (char === "\\" || char === "`") {
        index++
        continue
      }
      if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === "#" && (index === 0 || /\s/.test(line[index - 1] ?? ""))) {
      return index
    }
  }

  return -1
}

const YAML_SCALAR =
  /("(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\b(?:true|false|null|yes|no|on|off)\b|~|-?\b\d+(?:\.\d+)?\b|&[A-Za-z0-9_-]+|\*[A-Za-z0-9_-]+|![A-Za-z0-9_!-]+)/gi
const YAML_LITERALS = new Set(["true", "false", "null", "yes", "no", "on", "off", "~"])

function highlightYamlValue(value: string): Span[] {
  const spans: Span[] = []
  let last = 0

  for (const match of value.matchAll(YAML_SCALAR)) {
    const index = match.index ?? 0
    if (index > last) push(spans, value.slice(last, index))

    const token = match[0]
    const lower = token.toLowerCase()
    const color =
      token.startsWith('"') || token.startsWith("'")
        ? theme.syntaxString
        : token.startsWith("&") || token.startsWith("*") || token.startsWith("!")
          ? theme.syntaxKeyword
          : YAML_LITERALS.has(lower)
            ? theme.syntaxLiteral
            : theme.syntaxNumber
    push(spans, token, color)
    last = index + token.length
  }

  if (last < value.length) push(spans, value.slice(last))
  return spans
}

function highlightYamlLine(line: string): Span[] {
  const comment = findComment(line)
  const code = comment >= 0 ? line.slice(0, comment) : line
  const note = comment >= 0 ? line.slice(comment) : ""
  const spans: Span[] = []
  const key = code.match(/^(\s*(?:-\s+)?)([^:#]+?)(:)(?=\s|$)(\s*)(.*)$/)

  if (key) {
    push(spans, key[1] ?? "")
    push(spans, key[2] ?? "", theme.syntaxFunction)
    push(spans, key[3] ?? "")
    push(spans, key[4] ?? "")
    spans.push(...highlightYamlValue(key[5] ?? ""))
  } else {
    spans.push(...highlightYamlValue(code))
  }

  if (note) push(spans, note, theme.syntaxComment)
  return spans
}

function highlightMarkdownInline(line: string): Span[] {
  const spans: Span[] = []
  let last = 0

  for (const match of line.matchAll(/(`[^`]*`|\[[^\]]*\]\([^)]*\))/g)) {
    const index = match.index ?? 0
    if (index > last) push(spans, line.slice(last, index))
    const token = match[0]
    push(spans, token, token.startsWith("`") ? theme.syntaxString : theme.link)
    last = index + token.length
  }

  if (last < line.length) push(spans, line.slice(last))
  return spans
}

function highlightMarkdownLine(line: string): Span[] {
  const spans: Span[] = []
  const heading = line.match(/^(\s{0,3}#{1,6})(\s+)(.*)$/)
  if (heading) {
    push(spans, heading[1] ?? "", theme.syntaxKeyword)
    push(spans, heading[2] ?? "")
    spans.push(...highlightMarkdownInline(heading[3] ?? ""))
    return spans
  }

  const fence = line.match(/^(\s*)(```+|~~~+)(.*)$/)
  if (fence) {
    push(spans, fence[1] ?? "")
    push(spans, fence[2] ?? "", theme.syntaxKeyword)
    push(spans, fence[3] ?? "", theme.syntaxString)
    return spans
  }

  const quote = line.match(/^(\s*>+\s?)(.*)$/)
  if (quote) {
    push(spans, quote[1] ?? "", theme.muted, true)
    spans.push(...highlightMarkdownInline(quote[2] ?? ""))
    return spans
  }

  const list = line.match(/^(\s*)([-*+]|\d+[.)])(\s+)(.*)$/)
  if (list) {
    push(spans, list[1] ?? "")
    push(spans, list[2] ?? "", theme.syntaxKeyword)
    push(spans, list[3] ?? "")
    spans.push(...highlightMarkdownInline(list[4] ?? ""))
    return spans
  }

  return highlightMarkdownInline(line)
}

function highlightDiffLine(line: string): Span[] {
  if (/^(diff --git|index |--- |\+\+\+ )/.test(line)) {
    return [{ text: line, color: theme.syntaxComment, dim: true }]
  }
  if (line.startsWith("@@")) return [{ text: line, color: theme.diffHunk }]
  if (line.startsWith("+")) return [{ text: line, color: theme.diffAdd }]
  if (line.startsWith("-")) return [{ text: line, color: theme.diffRemove }]
  return [{ text: line, dim: true }]
}

function highlightPowerShellLine(line: string): Span[] {
  const spans: Span[] = []
  let index = 0

  while (index < line.length) {
    const rest = line.slice(index)

    const comment = rest.match(/^#.*/)
    if (comment) {
      push(spans, comment[0], theme.syntaxComment)
      break
    }

    const single = rest.match(/^'(?:''|[^'])*'/)
    if (single) {
      push(spans, single[0], theme.syntaxString)
      index += single[0].length
      continue
    }

    const double = rest.match(/^"(?:`[\s\S]|[^"])*"/)
    if (double) {
      push(spans, double[0], theme.syntaxString)
      index += double[0].length
      continue
    }

    const variable = rest.match(/^\$(?:\{[^}]+\}|[A-Za-z0-9_]+)/)
    if (variable) {
      push(spans, variable[0], theme.syntaxFunction)
      index += variable[0].length
      continue
    }

    const parameter = rest.match(/^-[A-Za-z][A-Za-z0-9_]*/)
    if (parameter) {
      push(spans, parameter[0], theme.syntaxKeyword)
      index += parameter[0].length
      continue
    }

    const cmdlet = rest.match(/^[A-Za-z]+-[A-Za-z][A-Za-z0-9]*/)
    if (cmdlet) {
      push(spans, cmdlet[0], theme.syntaxFunction)
      index += cmdlet[0].length
      continue
    }

    const number = rest.match(/^\b\d+(?:\.\d+)?\b/)
    if (number) {
      push(spans, number[0], theme.syntaxNumber)
      index += number[0].length
      continue
    }

    const word = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/)
    if (word) {
      const keyword = KEYWORDS.powershell?.has(word[0].toLowerCase())
      push(spans, word[0], keyword ? theme.syntaxKeyword : undefined)
      index += word[0].length
      continue
    }

    push(spans, rest.charAt(0))
    index++
  }

  return spans
}

/**
 * A small highlight.js-style tokenizer. It covers the common cases Claude
 * Code shows in transcripts: comments, strings, numbers, keywords, literals,
 * and identifiers followed by a call parenthesis.
 */
export function highlightCodeLine(
  line: string,
  language: string,
  state: HighlightState = { inBlockComment: false },
): { spans: Span[]; state: HighlightState } {
  const spans: Span[] = []
  const keywords = keywordsFor(language)
  const marker = lineComment(language)
  const nextState = { ...state }
  let index = 0

  if (!line) return { spans, state: nextState }

  const normalized = normalizeLanguage(language)
  if (normalized === "diff") {
    return { spans: highlightDiffLine(line), state: nextState }
  }
  if (normalized === "markdown") {
    return { spans: highlightMarkdownLine(line), state: nextState }
  }
  if (normalized === "yaml") {
    return { spans: highlightYamlLine(line), state: nextState }
  }
  if (normalized === "powershell") {
    return { spans: highlightPowerShellLine(line), state: nextState }
  }

  while (index < line.length) {
    const rest = line.slice(index)

    if (nextState.inBlockComment) {
      const end = rest.indexOf("*/")
      if (end === -1) {
        push(spans, rest, theme.syntaxComment)
        index = line.length
        continue
      }
      push(spans, rest.slice(0, end + 2), theme.syntaxComment)
      index += end + 2
      nextState.inBlockComment = false
      continue
    }

    if (supportsBlockComment(language) && rest.startsWith("/*")) {
      const end = rest.indexOf("*/", 2)
      if (end === -1) {
        push(spans, rest, theme.syntaxComment)
        nextState.inBlockComment = true
        index = line.length
        continue
      }
      push(spans, rest.slice(0, end + 2), theme.syntaxComment)
      index += end + 2
      continue
    }

    if (marker && rest.startsWith(marker)) {
      push(spans, rest, theme.syntaxComment)
      break
    }

    const stringMatch = rest.match(/^([`'"])(?:\\[\s\S]|(?!\1)[^\\])*\1?/)
    if (stringMatch) {
      push(spans, stringMatch[0], theme.syntaxString)
      index += stringMatch[0].length
      continue
    }

    const numberMatch = rest.match(/^\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b/i)
    if (numberMatch) {
      push(spans, numberMatch[0], theme.syntaxNumber)
      index += numberMatch[0].length
      continue
    }

    const wordMatch = rest.match(/^[A-Za-z_$][\w$]*/)
    if (wordMatch) {
      const word = wordMatch[0]
      const after = rest.slice(word.length)
      if (SHARED_LITERALS.has(word) || keywords.has(word)) {
        push(spans, word, keywordColor(word))
      } else if (/^\s*\(/.test(after)) {
        push(spans, word, theme.syntaxFunction)
      } else {
        push(spans, word)
      }
      index += word.length
      continue
    }

    const char = rest.charAt(0)
    push(spans, char)
    index++
  }

  return { spans, state: nextState }
}

function keywordColor(word: string): string | undefined {
  if (SHARED_LITERALS.has(word)) return theme.syntaxLiteral
  return theme.syntaxKeyword
}

/**
 * Highlight a whole fenced block. Kept separate so callers can pre-split
 * lines without resetting block-comment state.
 */
export function highlightCode(code: string, language: string): Span[][] {
  const state: HighlightState = { inBlockComment: false }
  return code
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      const result = highlightCodeLine(line, language, state)
      Object.assign(state, result.state)
      return result.spans
    })
}
