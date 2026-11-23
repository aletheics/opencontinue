# OpenContinue TUI Design

> **Status:** Proposed design specification\
> **Version:** 0.1\
> **Audience:** OpenContinue maintainers and contributors\
> **Product principle:** Keep the terminal interface quiet, fast,
> keyboard-first, and trustworthy.

## 1. Product direction

OpenContinue is an open-source terminal coding agent with durable
sessions, streaming, tools, and source-controlled checks. Its interface
should express:

**Think. Build. Verify. Continue.**

The TUI can use familiar coding-agent conventions without copying
another product's exact UI, symbols, wording, or interaction model.

### Design principles

1.  Minimal by default: show only information that helps the current
    task.
2.  Keyboard first: frequent actions should be reachable without a
    mouse.
3.  Stable identity: brand marks do not change with task state.
4.  Visible control: users understand what the agent may do and when
    approval is required.
5.  Provider-aware: never display controls that the active provider
    cannot honor.
6.  Continuity: sessions and useful task context should survive
    interruptions.
7.  Verifiable work: surface changed files, checks, and outcomes---not
    verbose internal reasoning.

## 2. Visual identity

### Brand mark

Use **`◈`** as the compact terminal brand mark:

``` text
◈ OpenContinue
```

It is a terminal-friendly shorthand for the geometric interlocking-loop
logo. Use the full graphical logo in the README, website, documentation,
and app icons; do not try to recreate it with terminal glyphs.

### Status symbols

  Meaning                                           Preferred   ASCII fallback
  ------------------------------- --------------------------- ----------------
  OpenContinue identity                                   `◈`              `O`
  Idle / ready                                            `·`              `.`
  Agent working                     Braille spinner, e.g. `⠋`              `*`
  Tool activity / nested action                           `↳`              `>`
  Completed                                               `✓`              `+`
  Approval required                                       `?`              `!`
  Warning                                                 `!`              `!`
  Failed                                                  `×`              `x`
  Checkpoint saved                                        `◆`              `*`
  Plan / analysis stage                                   `◎`              `o`
  Automatic execution mode                                `⟳`              `A`

Implementation notes:

-   Keep the brand mark stable while task status changes.
-   Animate only while work is actively progressing; stop when waiting
    for user input or a tool result.
-   Never rely on color alone to convey meaning.
-   Provide Unicode/ASCII fallback where terminal compatibility requires
    it.
-   Test glyph width and rendering in Windows Terminal, PowerShell, VS
    Code Terminal, macOS Terminal, and common Linux terminals.
-   Avoid symbols whose display width varies across fonts or terminal
    emulators.

## 3. Color and typography

Default to a restrained dark theme. Color communicates hierarchy and
state, not decoration.

  Token              Suggested value   Use
  ------------------ ----------------- ----------------------------------------
  `background`       `#151515`         Main background
  `surface`          `#242424`         Input area, selected row, inline panel
  `surface-muted`    `#1C1C1C`         Secondary surface
  `text-primary`     `#E5E5E5`         Main content
  `text-secondary`   `#A3A3A3`         Metadata
  `text-muted`       `#737373`         Hints and inactive details
  `border`           `#555555`         Dividers
  `accent`           `#D4D4D4`         Neutral emphasis
  `success`          `#22C55E`         Completed / passed
  `warning`          `#EAB308`         Approval / caution
  `danger`           `#EF4444`         Failed / blocked
  `info`             `#60A5FA`         Informational state

Rules:

-   Keep most text neutral.
-   Use semantic colors sparingly.
-   Selected items must remain distinguishable in monochrome terminals.
-   Respect terminal color capability and `NO_COLOR` where applicable.
-   Use the terminal's monospace font; prefer alignment and concise
    labels over decorative banners.

## 4. Information architecture

The inline TUI has four persistent regions:

1.  **Header** --- product, version, model/provider, workspace.
2.  **Conversation and activity** --- user messages, assistant
    responses, concise progress, tool summaries.
3.  **Prompt** --- input and contextual completion hints.
4.  **Status line** --- permission mode, reasoning setting (when
    supported), session/branch context, help hint.

Do not add a permanent sidebar to the inline TUI. Use transient panels
or expanded transcript views for secondary information.

### Startup / ready state

``` text
◈ OpenContinue  v0.1.0
The open continuum for AI-assisted engineering.

Model       deepseek-flash
Provider    DeepSeek
Workspace   D:\soft\vscodefiles\opencontinue

· Ready. What are we building today?

› Type a message...

? shortcuts                                      main · ready
```

Header rules:

-   Show product name and version once.
-   Keep model and provider visible but secondary.
-   Shorten long workspace paths from the middle.
-   Never expose secrets or API keys.
-   If no provider/model is configured, show a clear setup prompt.

### Active conversation

``` text
◈ OpenContinue  v0.1.0
deepseek-flash · D:\soft\vscodefiles\opencontinue
────────────────────────────────────────────────────────────

› Analyze the authentication module and fix the login bug.

⠋ Analyzing project                                      2/4

  ✓ Inspecting project structure
  ✓ Searching authentication module
  ⠋ Analyzing login flow
  ○ Proposing fix

The login flow appears to have a token validation issue.
I’m tracing the affected path before proposing a change.

────────────────────────────────────────────────────────────
› Type a message...

◈ Confirm                              Reasoning: High
main · 2 files in context                                  ? help
```

Activity rules:

-   Show a short task label and a small number of meaningful steps.
-   Prefer user-relevant milestones over raw internal event logs.
-   Collapse repetitive tool calls into summaries.
-   Make detailed tool events available in an expanded transcript.
-   Do not display private chain-of-thought. Show concise status,
    actions, evidence, and results.
-   When waiting for a decision, replace the spinner with an explicit
    waiting/approval state.

### Completion summary

``` text
✓ Completed

Updated 3 files
Tests: 12 passed · 0 failed

Changed
  src/auth/session.ts
  src/auth/login.ts
  test/auth/login.test.ts

Use /diff to inspect the changes.
◆ Checkpoint saved
```

Only show counts and outcomes actually reported by tools. If tests were
not run, say so.

## 5. Execution modes and permissions

Keep **execution permission policy** separate from **task workflow**.

-   **Mode:** what the agent may do without asking.
-   **Workflow:** the sequence of work, such as Plan → Execute → Verify.

A task can be planned, implemented, and verified under different
permission policies.

### Proposed interactive modes

  -----------------------------------------------------------------------
  Mode                    Behavior                Typical use
  ----------------------- ----------------------- -----------------------
  Plan                    Read and analyze;       Exploration, review,
                          propose a plan; do not  architecture analysis
                          modify files or run     
                          mutating commands       

  Confirm                 Read freely; request    Default daily
                          approval for protected  development
                          write/command actions   

  Auto                    Execute actions covered Well-scoped
                          by the configured auto  implementation and test
                          policy without          loops
                          per-action prompts      
  -----------------------------------------------------------------------

**Confirm is the recommended default interactive mode.**

### Compatibility with existing CLI behavior

Status: implemented. The runtime defines one canonical policy in
`packages/runtime/src/permissions.ts`:

-   **Plan** denies every non-read tool without prompting.
-   **Confirm** allows reads and asks before protected write/command tools.
-   **Auto** allows protected tools unless the project's `ask` list opts in.

Old config values and flags keep working: `readonly` normalizes to
`plan`, `ask` normalizes to `confirm`, and `--readonly` is an alias for
`--plan`. Mode changes from the TUI call the client/runtime broker, so the
UI does not duplicate authorization logic. The selected mode is saved in
`~/.opencontinue/config.json`; startup resolves explicit flag → saved
preference → project config → Confirm, and the client `health()` endpoint
syncs the effective runtime mode.

Mapping:

  UI mode   Permission policy
  --------- ---------------------------------------------
  Plan      Read-only policy
  Confirm   Interactive approval policy
  Auto      Auto policy, subject to safety restrictions

### Permission confirmation panel

``` text
? Permission required

OpenContinue wants to execute:

  npm run test

Working directory: opencontinue

  [Y] Allow once
  [A] Always allow this command
  [N] Deny
```

Requirements:

-   Show the exact command or operation before approval.
-   Show the working directory and relevant target paths.
-   Make the safe/default choice visually clear.
-   `Allow once` applies only to the current request.
-   `Always allow` must be scoped and persisted transparently; never
    silently grant broad permissions.
-   `Deny` stops the requested operation and returns control to the
    agent.
-   Destructive or high-risk operations may require stronger
    confirmation even in Auto mode.
-   Never claim an action ran until the tool reports its result.

### Mode switching

Recommended shortcut: `Shift+Tab` cycles through available modes,
subject to conflict checks.

Always show the active mode explicitly:

``` text
◈ Confirm
```

If a mode is unavailable in the current execution context, explain why
instead of silently selecting another mode.

## 6. Reasoning effort

Reasoning effort is independent of execution permissions.

-   Permission mode controls tool authorization.
-   Reasoning effort controls model/provider reasoning configuration,
    where supported.

Recommended UI:

``` text
Reasoning  [Auto]  Low  Medium  High  Max
```

  Level    Intended use
  -------- ----------------------------------------------------------
  Auto     Let the provider/model adapter choose its default
  Low      Simple questions and small edits
  Medium   Routine development and debugging
  High     Complex debugging, design, and refactoring
  Max      Deep analysis where supported and worth the cost/latency

Recommended shortcut: `Shift+R`, if it does not conflict with terminal
or application shortcuts.

Provider compatibility requirements:

-   Do not assume all providers expose the same reasoning parameter.
-   Each provider adapter declares supported levels and maps them to
    provider-specific parameters.
-   If a provider does not support effort control, hide or disable the
    control with a concise explanation.
-   Do not imply that `Max` guarantees better results.
-   Distinguish requested effort from effective provider behavior when
    they differ.
-   Do not send unsupported parameters to providers.

Show the effective setting only when known. If unsupported, omit the
reasoning label rather than showing a misleading default.

Implementation: `reasoningEffortsFor(provider, model)` advertises levels
only for OpenAI-compatible models that document `reasoning_effort`
(o-series, GPT-5, GPT-6). `auto` sends no parameter. The TUI reads the
effective level and supported levels from `health()`, persists the user's
choice in `~/.opencontinue/config.json`, and hides the control when the
list is empty. Anthropic extended-thinking budgets remain future work.

## 7. Task workflow and progress

Use a lightweight timeline for meaningful multi-step work:

1.  **Plan** --- understand the request, inspect context, identify
    intended changes.
2.  **Execute** --- edit files or run approved tools.
3.  **Verify** --- run relevant tests, checks, or validation.
4.  **Complete** --- summarize outcomes and remaining risks.

Small questions should not produce an artificial four-step plan.

``` text
⠋ Implementing authentication fix                         2/4

  ✓ Plan
  ⠋ Execute
  ○ Verify
  ○ Complete
```

Rules:

-   Steps reflect actual work and tool events.
-   If the plan changes, make that visible.
-   Failed verification remains visible.
-   If verification was not run, say "Not run".
-   Allow users to interrupt or redirect the task.

## 8. Continuity and checkpoints

Continuity is a core product concept and should be visible without
dominating the interface.

Suggested status:

``` text
◆ Checkpoint saved
```

Suggested future commands:

-   `/resume` --- existing documented session-resume entry point.
-   `/checkpoints` --- implemented as a current-session run list with
    event seq, time, duration, and status. Selection/restore is future.
-   `/sessions` --- proposed session list, if not already covered by
    `/resume`.

Requirements:

-   Save at meaningful boundaries, not after every token.
-   Preserve enough context to resume safely: session identity, task
    status, relevant tool outcomes, and pending decisions.
-   Do not store secrets in checkpoint summaries.
-   Distinguish a saved checkpoint from successful task completion.
-   On resume, explain what was restored and whether an operation was
    interrupted.
-   Never automatically repeat a non-idempotent operation after
    interruption without a safety check.

## 9. Change awareness and verification

After implementation work, show a concise, evidence-based summary.

``` text
✓ Completed

3 files changed · 12 tests passed

  M src/auth/session.ts
  M src/auth/login.ts
  A test/auth/login.test.ts

/diff to inspect changes
```

Requirements:

-   File status comes from actual workspace/git state.
-   Test counts come from parsed command output or test-runner results.
-   Distinguish passed, failed, skipped, and not-run tests.
-   Do not claim a clean working tree unless verified.
-   Keep full diff viewing separate from the main conversation flow.

`/diff` is implemented as a read-only git status plus diff-stat view.
Completion summaries report only files and commands the tools actually
reported; test counts are never inferred from free text.

## 10. Prompt and command interaction

Keep the prompt simple:

``` text
› Type a message...
```

  Input   Purpose
  ------- ---------------------------
  `/`     Slash-command suggestions
  `@`     Workspace file completion
  `?`     Help / shortcuts

Existing documented interactions:

-   `/resume` --- switch/resume sessions.
-   `@` --- complete workspace files.
-   `Ctrl+R` --- search input history.
-   `Ctrl+O` --- open expanded transcript.

Proposed commands (not implemented until shipped):

  -----------------------------------------------------------------------
  Command                             Proposed purpose
  ----------------------------------- -----------------------------------
  `/plan`                             Inspect or create the current task
                                      plan

  `/diff`                             Inspect current changes

  `/permissions`                      View or edit permission rules

  `/checkpoints`                      Browse saved checkpoints

  `/model`                            Switch model/provider

  `/clear`                            Clear the visible conversation
                                      surface, with session semantics
                                      explained
  -----------------------------------------------------------------------

Requirements:

-   Provide autocomplete and short descriptions.
-   Unknown commands return helpful suggestions.
-   Avoid ambiguity between shell commands and slash commands.
-   Destructive commands require confirmation.
-   Make shortcuts discoverable through `?`.

## 11. Keyboard interaction

This is a proposed map. Preserve shipped behavior and avoid conflicts.

  -----------------------------------------------------------------------
  Shortcut                Action                  Status
  ----------------------- ----------------------- -----------------------
  `Shift+Tab`             Cycle execution modes   Proposed; verify
                                                  current behavior

  `Shift+R`               Cycle reasoning effort  Proposed

  `Ctrl+R`                Search input history    Existing, documented

  `Ctrl+O`                Toggle expanded         Existing, documented
                          transcript              

  `Enter`                 Submit prompt / confirm Existing convention
                          focused action          

  `Esc`                   Close transient panel / Proposed
                          cancel safely           

  `?`                     Show help               Proposed

  `Tab`                   Complete or move focus  Proposed;
                          in a panel              context-sensitive
  -----------------------------------------------------------------------

Rules:

-   Do not steal common terminal shortcuts without a clear reason.
-   Show context-sensitive shortcuts near controls.
-   Support keyboard-only approval flows.
-   Keep focus visible.
-   Escape must not accidentally discard a prompt or approve/deny an
    action.

## 12. Responsive terminal behavior

### Wide terminal

-   Header may show model, provider, and workspace on separate aligned
    rows.
-   Progress steps may include short descriptions.
-   Status line may show mode, effort, branch, and context metadata.

### Narrow terminal

-   Truncate long paths in the middle.
-   Hide low-priority metadata before wrapping core prompt content.
-   Collapse progress descriptions to short labels.
-   Wrap long commands and file paths safely.
-   Never let status metadata overwrite prompt text.
-   Provide a compact mode that preserves active permission mode and
    current task state.

Priority when width is constrained:

1.  Prompt and user-visible response.
2.  Approval / blocking state.
3.  Active execution mode.
4.  Current task status.
5.  Model and provider.
6.  Workspace and secondary metadata.

## 13. Accessibility and terminal compatibility

-   Support monochrome terminals.
-   Do not communicate state by color alone.
-   Provide ASCII fallbacks for special glyphs.
-   Handle terminal resize without corrupting input.
-   Avoid flicker and excessive full-screen redraws.
-   Respect reduced animation preferences where practical.
-   Ensure CJK text, emoji, and wide glyphs do not break cursor
    positioning.
-   Keep transcript text meaningful for assistive technologies where
    terminal libraries permit.
-   Do not emit control sequences into copied conversation text.

## 14. Suggested component boundaries

Keep rendering separate from agent policy and provider behavior.

  Component             Responsibility
  --------------------- ---------------------------------------------
  `AppHeader`           Product, version, model/provider, workspace
  `ConversationView`    User and assistant messages
  `ActivitySummary`     Concise task progress
  `ToolActivity`        Tool name, target, result summary
  `PromptInput`         Input, completion, history
  `StatusLine`          Mode, effort, session context
  `ModePicker`          Plan / Confirm / Auto selection
  `EffortPicker`        Provider-supported reasoning levels
  `PermissionPrompt`    Approve / deny protected action
  `CompletionSummary`   Changes, checks, outcome
  `CheckpointNotice`    Saved/restored checkpoint status
  `HelpPanel`           Commands and keyboard shortcuts

Architecture rules:

-   UI components render state; they do not decide authorization.
-   The runtime permission layer is the source of truth for tool access.
-   Provider adapters are the source of truth for supported model
    parameters.
-   UI state is not persisted session state.
-   Keep terminal rendering testable with deterministic state fixtures.

## 15. Implementation priorities

### P0 --- Establish consistent behavior

-   [x] Define the canonical permission policy in the runtime.
-   [x] Ensure interactive default behavior is clearly represented as
    Confirm.
-   [x] Map existing `--auto` and `--readonly` flags to the canonical
    policy without breaking CLI compatibility. `--plan` is the canonical
    flag; `--readonly` remains an alias.
-   [x] Make permission prompts show the exact operation and target.
-   [x] Standardize status symbols and ASCII fallbacks. Implemented in
    `packages/tui/src/glyphs.ts`; set `OPENCONTINUE_ASCII=1` to force the
    ASCII set.
-   [x] Make active mode always visible.

### P1 --- Improve daily usability

-   [x] Refine startup/header hierarchy.
-   [x] Add concise task progress for multi-step work. The model
    maintains a `todo` tool list; the TUI shows the newest list above the
    prompt with `✓`, `▸`, and `○` state markers.
-   [x] Add evidence-based completion summaries. File counts come from
    successful write/edit tool results; command counts and failures come
    from bash tool status. Tests are not inferred from output.
-   [ ] Make narrow-terminal behavior reliable.
-   [x] Document existing shortcuts and commands in `?` help.

### P2 --- Add provider-aware controls

-   [x] Define provider capability metadata for reasoning effort.
-   [x] Add Auto / Low / Medium / High / Max only where supported.
-   [x] Show unsupported capability states honestly.
-   [x] Add the reasoning shortcut if conflict-free. `Shift+R` cycles
    when the prompt is empty; `/reasoning` is the discoverable command.

### P3 --- Deepen OpenContinue's identity

-   [x] Add checkpoint notices, `/checkpoints` for the current session,
    and a restored-event summary on resume. Interrupted-operation detail
    still depends on the snapshot exposing raw events.
-   [ ] Add a checkpoint browser with selection/restore. `/checkpoints`
    lists run boundaries; restoring to one is not implemented.
-   [x] Add change awareness and `/diff`. `/diff` runs `git status
    --short` and `git diff --stat` directly, outside the agent gate.
-   [ ] Add permission-rule inspection and management.
-   [ ] Add richer task timeline only where it improves clarity.

## 16. Acceptance criteria

The TUI design is ready to ship when:

-   A first-time user can identify product, model, workspace, and prompt
    immediately.
-   The active permission mode is always visible and unambiguous.
-   Users can tell when the agent is working, waiting, asking approval,
    completed, or failed.
-   Protected operations show enough detail for an informed decision.
-   Reasoning controls never imply unsupported provider capabilities.
-   Multi-step progress reflects real task state, not invented
    milestones.
-   Completion summaries distinguish verified results from unverified
    claims.
-   The interface remains usable in narrow, monochrome, and common
    Windows/macOS/Linux terminals.
-   Existing documented CLI and TUI interactions remain compatible
    unless a migration is documented.

## 17. Decisions at a glance

  Area                Decision
  ------------------- -----------------------------------------------------
  Product identity    `◈ OpenContinue`
  Tagline             The open continuum for AI-assisted engineering
  Interaction style   Minimal, keyboard-first inline TUI
  Default theme       Dark, neutral, restrained
  Execution modes     Plan / Confirm / Auto
  Default mode        Confirm
  Reasoning           Auto / Low / Medium / High / Max, provider-aware
  Progress            Plan → Execute → Verify → Complete, when useful
  Continuity          Explicit checkpoint and resume feedback
  Trust               Clear permission prompts and evidence-based results

**Central rule:** OpenContinue should feel calm when idle, informative
while working, explicit when asking permission, and trustworthy when
reporting completion.
