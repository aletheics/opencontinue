# OpenContinue TUI Refinement — Implementation Spec

> Version: 0.2  
> Status: Proposed implementation plan  
> Design direction: Refined Terminal — calm, warm, expressive, keyboard-first

This document translates the TUI review into an implementation plan. It draws on Anthropic's public Claude Code documentation for interaction patterns and theme/status-line concepts, but does not depend on leaked source code or copy Claude Code's private implementation.

## 1. Product objective

OpenContinue should not attempt to reproduce every Claude Code feature. It should deliver a more coherent experience for its own strengths:

- Durable, resumable sessions.
- Provider-neutral workflows.
- Clear capability permissions.
- Verifiable, source-controlled checks.
- A TUI that can evolve into other clients without owning agent state.

The visual principle is:

**Calm when idle. Alive while working. Explicit when asking. Trustworthy when complete.**

## 2. Repository boundaries

The current repository guidance identifies these boundaries:

| Package | Owns |
|---|---|
| `packages/protocol` | Public event and wire contract |
| `packages/core` | Event-sourced sessions and projections |
| `packages/tools` | Tools and permission gate |
| `packages/runtime` | Agent loop, history projection, permissions, project context |
| `packages/tui` | Ink TUI, independent from the CLI |
| `apps/cli` | Entrypoint and headless paths |

Implementation rules:

1. `packages/tui` renders state; it must not make authorization decisions.
2. The runtime/tools permission gate remains the source of truth.
3. The UI consumes the public event stream and derived session state.
4. Add new protocol events only when necessary. The repository contract is append-only; do not rename or reuse existing event types.
5. Inspect actual event names and existing components before coding. The event names below are conceptual examples, not claims about current exported types.
6. Keep the TUI independent from the CLI entrypoint.

## 3. Design system

### 3.1 Brand and status marks

| Purpose | Glyph | Fallback |
|---|---|---|
| Brand identity | `◈` | `O` |
| Active work | `◈` with a subtle pulse | `*` |
| Tool activity | `↳` | `>` |
| Completed | `✓` | `+` |
| Approval required | `?` | `!` |
| Warning / delayed | `!` | `!` |
| Failed | `×` | `x` |
| Checkpoint | `◆` | `*` |
| Inactive step | `○` | `o` |

Keep `◈` stable as the brand mark. Do not use the brand mark as a success/error icon.

### 3.2 Copper theme tokens

| Token | Value | Semantic use |
|---|---|---|
| `background` | `#151515` | Main background |
| `surface` | `#242424` | Composer and focused surface |
| `surfaceSubtle` | `#1C1C1C` | Secondary surface |
| `textPrimary` | `#E5E5E5` | Main text |
| `textSecondary` | `#A3A3A3` | Metadata |
| `textMuted` | `#737373` | Hints |
| `borderSubtle` | `#454545` | Dividers |
| `brand` | `#D99A75` | Brand / active agent |
| `brandShimmer` | `#F0B18F` | Highlight frame |
| `success` | `#7EBB91` | Completed / passed |
| `warning` | `#D9AE62` | Approval / caution |
| `error` | `#D9767C` | Failure / stalled warning |
| `info` | `#86AFC4` | Informational |

Rules:

- Neutral text should occupy most of the screen.
- Brand copper is not a general-purpose highlight color.
- Green means verified success, not merely “the model stopped”.
- Yellow means attention or approval.
- Red means an error or a clearly delayed/stalled condition.
- Never rely on color alone; always pair color with text or a glyph.
- Respect `NO_COLOR` and provide an ASCII fallback.

### 3.3 Spacing and message hierarchy

- Avoid a border around every message.
- User messages may use a subtle background such as `#252525`; avoid a large, high-contrast gray block.
- Assistant responses should remain mostly unboxed.
- Tool activity should be indented and summarized.
- Approval prompts may use a stronger border because they block progress.
- Keep the composer visually distinct from transcript messages.
- Verify whether a gray block in a screenshot is a selected terminal region before treating it as the default message style.

## 4. Layout specification

### 4.1 Header

Preferred compact header:

```text
◈ OpenContinue  v0.x
deepseek-flash[1M] · High · DeepSeek
D:\soft\vscodefiles\opencontinue
────────────────────────────────────────────────────────
```

Rules:

- Keep the brand name warm copper and the version a low-brightness gray.
- Put model (including any context-window suffix), non-default effort, and provider on one neutral metadata line.
- Do not repeat the model or provider in the status bar.
- Give the workspace its own line and shorten long paths from the middle.
- Drop effort, then provider, before clipping the model on narrow terminals.
- The branch belongs in the status bar, not the header.
- The marketing tagline belongs on the first-run welcome screen, not above every conversation.
- Do not expose credentials or secret values.

### 4.2 Transcript

```text
› Analyze the authentication module and fix the login bug.

◈ Analyzing authentication                         12s

  ✓ Inspecting project structure
  ✓ Finding authentication files
  ◈ Tracing login flow
  ○ Preparing fix

The login flow appears to have a token validation issue.
I’m checking the affected path before editing.
```

Rules:

- Use meaningful task labels such as `Reading files`, `Tracing call chain`, `Editing`, `Running tests`, `Waiting for approval`, and `Saving checkpoint`.
- Do not rotate whimsical verbs independently of actual work. A label should describe a real phase or active tool.
- Keep internal reasoning private. Show milestones, tool actions, evidence, and concise summaries.
- Collapse repetitive tool output; allow `Ctrl+O` (or the repository's current equivalent) to expand detailed execution history.

### 4.3 Composer and footer

Composer:

```text
────────────────────────────────────────────────────────
› Type a message...
────────────────────────────────────────────────────────
```

Idle status bar (mode left; branch and help right):

```text
⟳ Auto                                  main · ? help
```

Rules:

- Only mode, git branch, and help belong in the status bar.
- `Auto` is warm gold, `Plan` soft blue, and `Manual` neutral gray.
- Drop help, then branch, before clipping the mode on narrow terminals.

Working footer / activity line:

```text
◈ Tracing authentication · 12s · 1.8k tokens · High
```

Approval:

```text
? APPROVAL REQUIRED · npm run test
```

Completed:

```text
✓ COMPLETED · 3 files changed · 12 tests passed
◆ Checkpoint saved
```

Do not put all fields into one permanently visible footer. Render fields conditionally by state.

## 5. Dynamic status model

The UI should derive visual state from actual runtime/protocol events. The following are conceptual names; map them to the repository's existing event types first.

Useful state inputs:

- Turn started.
- Assistant stream chunk received.
- Tool started / tool output / tool completed.
- Permission requested / resolved.
- Checkpoint saved.
- Turn completed / failed / interrupted.
- Provider/network error.

Suggested view state:

```ts
type VisualPhase =
  | "idle"
  | "queued"
  | "thinking"
  | "streaming"
  | "tool-running"
  | "awaiting-approval"
  | "delayed"
  | "completed"
  | "failed"
  | "interrupted";

interface ActivityViewState {
  phase: VisualPhase;
  startedAt?: number;
  lastProgressAt?: number;
  activeTool?: string;
  elapsedMs?: number;
  tokenCount?: number;
  effortLabel?: string;
  message?: string;
}
```

Do not add this as a duplicate persisted state model if the runtime already has an equivalent projection. Prefer a small view-model selector over a second source of truth.

### Event-to-view mapping

| Runtime fact | UI phase | Presentation |
|---|---|---|
| Turn begins | `thinking` | Copper pulse + task label |
| First model chunk / further chunks | `streaming` | Copper pulse; update progress clock |
| Tool begins | `tool-running` | `↳ Running <tool>` |
| Tool emits output | `tool-running` | Update activity; reset no-progress timer |
| Tool completes | `thinking` or `streaming` | Return to agent phase |
| Permission request | `awaiting-approval` | Yellow `?`; stop spinner |
| Permission resolved | Actual next phase | Resume pulse or show denial |
| Turn completed | `completed` | Green check; static |
| Turn failed | `failed` | Red cross; error summary |
| User interrupts | `interrupted` | Neutral paused state |
| Checkpoint saved | Current phase + notice | `◆ Checkpoint saved` |

## 6. Spinner: yellow → amber → red

Use a stable OpenContinue glyph (`◈`) with a restrained color pulse. Do not copy Claude's sparkle glyph.

Suggested color progression:

| Condition | Color | Label |
|---|---|---|
| Recent progress | `#D9AE62` | `Thinking` / current phase |
| Some time without progress | `#D99A75` | `Still working` |
| Long no-progress interval | `#D9767C` | `Still waiting — no recent activity` |
| Actual error | `#D9767C` | `Failed` |
| Completed | `#7EBB91` | `Completed` |

Important safety/UX rules:

1. Red must not mean “the model is taking a long time” by itself.
2. Advance the no-progress timer only while a turn is active.
3. Reset `lastProgressAt` when a model chunk arrives or a meaningful tool lifecycle/output event occurs.
4. If a tool is still running, show `Running <tool> · 39s`; do not imply the whole agent is frozen just because the model is not streaming.
5. If a provider is waiting for its first token, label it `Waiting for model`; red means “no observable progress”, not a confirmed provider failure.
6. Treat `awaiting-approval` as a separate yellow state, never as stalled.
7. Make thresholds configurable and tune them from real provider latency data. Suggested starting thresholds for testing: normal under 10s, delayed after 10s, stalled warning after 30s without observable progress. Do not hard-code these as universal truths.
8. For high-effort requests or slow providers, increase the thresholds or use provider-specific defaults.
9. On actual provider/tool error, transition immediately to `failed`; do not wait for a timer.
10. Provide `reducedMotion`; in that mode use a static glyph and state text.

Implementation: `packages/tui/src/status/activity.ts` derives the label from
the running tool, the model-authored todo, or the first-token state.
Thresholds default to 10s/30s and honor `OPENCONTINUE_DELAYED_MS` /
`OPENCONTINUE_STALLED_MS`. A running tool uses its own `tool.started`
timestamp and is never treated as a stalled model. `Esc` produces
`■ Interrupted`; only `run.failed` produces `× Failed`. Set
`OPENCONTINUE_REDUCED_MOTION=1` to disable the pulse and
`OPENCONTINUE_ASCII=1` for ASCII glyphs.

## 7. Status bar compaction and width handling

Priority order when the terminal is narrow:

1. Active permission mode / approval status.
2. Current task phase or blocking operation.
3. Git branch (if it fits).
4. Reasoning effort (only if supported and non-default).
5. Model/provider only if not already shown in the header.
6. Elapsed time and token count only while working.
7. Shortcut hints only in help/interaction context.

Examples:

```text
80 cols:  ◈ AUTO · main                         ? help
120 cols: ◈ AUTO · main · High                  ? help
Working:  ◈ Tracing auth · 12s · 1.8k tokens
```

Implementation:

- Use the terminal width supplied by the TUI/layout engine; do not measure raw string length.
- Use display-cell width, not JavaScript `.length`, for Unicode and CJK.
- Reserve left/right padding and clamp before rendering.
- Hide low-priority fields before truncating critical state.
- Never let the status line wrap into the input row.
- Cache expensive git/provider lookups; do not run shell commands on every animation frame.
- Update time labels at a low rate (e.g. 1 Hz), not every animation frame.

## 8. Official Claude Code documentation: what to learn

Public Anthropic documentation describes these supported concepts:

- **Themes:** `/theme` and `/config` can select themes; custom theme JSON overrides semantic tokens. The documented spinner tokens include `claude` and `claudeShimmer`; status colors include `success`, `error`, and `warning`.
- **Spinner content:** `spinnerVerbs` can append or replace rotating verbs. `spinnerTipsEnabled` and `spinnerTipsOverride` configure tips shown while the model works.
- **Custom status line:** `/statusline` configures a script that receives JSON session data on stdin and prints text to the terminal. It supports multiple lines and ANSI colors. The documented status line is updated from events, debounced, and receives `COLUMNS` / `LINES` for width-aware output.
- **Transcript:** `Ctrl+O` opens the transcript viewer with detailed tool usage and execution.
- **Tasks:** `Ctrl+T` toggles the task checklist.
- **Input and control:** `Ctrl+R` searches history, `Esc` interrupts/closes dialogs, and `Shift+Tab` cycles permission modes.
- **Rendering:** `/tui default` and `/tui fullscreen` select classic scrollback or fullscreen rendering.

References:
- https://code.claude.com/docs/en/terminal-config
- https://code.claude.com/docs/en/statusline
- https://code.claude.com/docs/en/settings-reference
- https://code.claude.com/docs/en/interactive-mode
- https://code.claude.com/docs/zh-CN/commands

The public docs do **not** specify a stable public algorithm for turning the spinner red after a particular idle duration. OpenContinue should implement its own event-driven behavior and not depend on private or leaked internals.

## 9. OpenContinue capabilities worth prioritizing

OpenContinue should aim to be better for its own product thesis, not claim universal parity.

| Area | Differentiating opportunity |
|---|---|
| Continuity | Durable session recovery, checkpoints, replay, safe resume |
| Provider neutrality | One TUI and session model across remote and local providers |
| Verification | Reproducible worktree-isolated checks, same result locally and in CI |
| Trust | Clear capability permissions, audit trail, visible tool actions |
| Multi-client | Continue the same session across terminal, web, and later desktop/IDE clients |
| Customization | User themes, compact/fullscreen rendering, reduced motion, configurable status fields |

Do not implement every feature at once. Ship one vertical slice at a time.

## 10. Implementation order

### P0 — Fix current UI clarity

- [x] Remove duplicate model text from the footer.
- [x] Remove always-visible `Shift+Tab` hint; surface it in help or mode picker.
- [x] Hide elapsed time and tokens while idle.
- [x] Keep the permission mode visible.
- [x] Fix footer clipping/concatenation at narrow widths.
- [x] Hide internal event IDs in normal mode.
- [x] Check whether the gray prompt area is normal styling or terminal selection. The user bar is now the subtler `#252525` surface.

### P1 — Establish the visual system

- [x] Implement centralized Copper theme tokens.
- [x] Apply semantic colors consistently.
- [x] Refine header to two compact lines.
- [x] Keep user message highlight subtle and assistant response unboxed.
- [x] Ensure composer, approval prompt, and transcript have distinct visual roles.

### P2 — Event-driven activity and spinner

- [x] Map real protocol events to the view state.
- [x] Add one low-frequency spinner animation loop. The app clock runs at
    500ms; the glyph pulse changes every 800ms.
- [x] Add meaningful phase labels.
- [x] Add yellow → amber → red no-progress warning with configurable thresholds.
- [x] Keep approval, actual failure, interruption, and long-running tools distinct.
- [x] Add reduced-motion and ASCII fallback.

### P3 — Interaction depth

- [x] Expandable transcript / tool event details.
- [x] Task checklist and compact progress summary. `Ctrl+T` toggles the
    list; the hidden state keeps a `Tasks done/total` line.
- [x] Clear permission approval UI.
- [x] Completion summary based only on real file/test results.
- [x] Optional fullscreen renderer after inline mode is reliable.
    `--fullscreen` / `/tui fullscreen` uses the alternate screen, a fixed
    header, a tail-following transcript viewport (`PgUp`/`PgDn`), and a
    pinned composer/footer; `/tui default` returns to inline scrollback.

## 11. Verification matrix

Test the implementation at terminal widths 80, 100, 120, and 160 columns.

Test environments:

- Windows Terminal + PowerShell.
- VS Code integrated terminal.
- macOS Terminal / iTerm2.
- Common Linux terminals.
- Unicode enabled and ASCII fallback.
- `NO_COLOR` / monochrome mode.
- CJK input, long paths, emoji, and wrapped multiline prompts.

Test states:

- Idle.
- Waiting for first token.
- Streaming tokens.
- Running a short tool.
- Running a long tool.
- Tool output arriving.
- Waiting for permission.
- Permission denied.
- Provider error.
- User interrupt.
- Completed with tests passed.
- Completed with tests not run.
- Checkpoint saved and session resumed.

Acceptance criteria:

- No footer overlap, clipping, or accidental wrap.
- The user can identify the active permission mode immediately.
- Color is never the sole signal.
- Long-running model or tool operations are not falsely presented as failures.
- Spinner and timers do not cause excessive redraws or expensive runtime work.
- All displayed counts and completion claims are backed by actual runtime results.
- Existing tests and CLI behavior remain intact.
