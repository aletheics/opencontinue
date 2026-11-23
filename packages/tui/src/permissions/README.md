# permissions

**Why:** the approval dialog is a feature, not part of the session screen.

**Files:**

- `types.ts` — canonical mode and prompt state.
- `use-permission-prompt.ts` — event-driven prompt state and client decisions.

**Rule:** the runtime `PermissionBroker` owns authorization. This folder only presents a request the broker already decided to ask about; it never re-implements Plan/Confirm/Auto policy. The hook never starts runs or owns sessions; it reads the active client/session and resolves one request. "Always allow" asks the client to remember the tool for the session.

**Tests:** the full dialog path is covered in `../index.test.tsx`; runtime policy is covered in `packages/runtime/src/permissions.test.ts`.
