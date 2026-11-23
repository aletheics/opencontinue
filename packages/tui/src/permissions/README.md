# permissions

**Why:** the approval dialog is a feature, not part of the session screen.

**Files:**

- `types.ts` — mode and prompt state.
- `decision.ts` — remember/auto/readonly/ask decision.
- `use-permission-prompt.ts` — event-driven prompt state and client decisions.

**Rule:** the hook never starts runs or owns sessions; it reads the active client/session and resolves one request.

**Tests:** `decision.test.ts`; the full dialog path is covered in `../index.test.tsx`.
