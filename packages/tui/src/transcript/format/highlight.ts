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
  if (value === "json") return "json"
  return value
}

function keywordsFor(language: string): Set<string> {
  return KEYWORDS[normalizeLanguage(language)] ?? new Set()
}

function lineComment(language: string): string | null {
  const value = language.toLowerCase()
  if (value === "py" || value === "python" || value === "sh" || value === "bash" || value === "zsh" || value === "shell" || value === "rb" || value === "ruby") return "#"
  if (value === "yaml" || value === "yml" || value === "toml") return "#"
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

function keywordColor(word: string): string {
  if (SHARED_LITERALS.has(word)) return theme.syntaxLiteral
  return theme.syntaxKeyword
}

/**
 * Highlight a whole fenced block. Kept separate so callers can pre-split
 * lines without resetting block-comment state.
 */
export function highlightCode(
  code: string,
  language: string,
): Span[][] {
  const state: HighlightState = { inBlockComment: false }
  return code.replace(/\r\n/g, "\n").split("\n").map((line) => {
    const result = highlightCodeLine(line, language, state)
    state.inBlockComment = result.state.inBlockComment
    return result.spans
  })
}
