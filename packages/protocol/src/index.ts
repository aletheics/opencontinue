import { z } from "zod"

export const SessionId = z.string().uuid()
export type SessionId = z.infer<typeof SessionId>

export const EventSeq = z.number().int().nonnegative()
export type EventSeq = z.infer<typeof EventSeq>

/** Execution permission policy: plan (read-only), confirm, or auto. */
export const PermissionMode = z.enum(["plan", "confirm", "auto"])
export type PermissionMode = z.infer<typeof PermissionMode>

/** Provider reasoning effort. `auto` sends no provider parameter. */
export const ReasoningEffort = z.enum(["auto", "low", "medium", "high", "max"])
export type ReasoningEffort = z.infer<typeof ReasoningEffort>

/** Effective tool-name rules for the active permission broker. */
export const PermissionPolicy = z.object({
  allow: z.array(z.string()),
  ask: z.array(z.string()),
  deny: z.array(z.string()),
})
export type PermissionPolicy = z.infer<typeof PermissionPolicy>

const eventBase = {
  sessionId: SessionId,
  seq: EventSeq,
  at: z.string(),
}

export const SessionEvent = z.discriminatedUnion("type", [
  z.object({
    ...eventBase,
    type: z.literal("session.created"),
    title: z.string(),
  }),
  z.object({
    ...eventBase,
    type: z.literal("message.user"),
    text: z.string(),
  }),
  z.object({
    ...eventBase,
    type: z.literal("run.started"),
    runId: z.string(),
  }),
  z.object({
    ...eventBase,
    type: z.literal("message.assistant.delta"),
    runId: z.string(),
    text: z.string(),
  }),
  z.object({
    ...eventBase,
    type: z.literal("run.completed"),
    runId: z.string(),
  }),
  z.object({
    ...eventBase,
    type: z.literal("run.failed"),
    runId: z.string(),
    error: z.string(),
  }),
  z.object({
    ...eventBase,
    type: z.literal("usage"),
    runId: z.string(),
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    totalTokens: z.number().int().nonnegative().optional(),
  }),
  z.object({
    ...eventBase,
    type: z.literal("tool.started"),
    runId: z.string(),
    callId: z.string(),
    name: z.string(),
    input: z.unknown(),
  }),
  z.object({
    ...eventBase,
    type: z.literal("tool.completed"),
    runId: z.string(),
    callId: z.string(),
    output: z.string(),
    diff: z.string().optional(),
  }),
  z.object({
    ...eventBase,
    type: z.literal("tool.failed"),
    runId: z.string(),
    callId: z.string(),
    error: z.string(),
  }),
  z.object({
    ...eventBase,
    type: z.literal("permission.requested"),
    requestId: z.string(),
    tool: z.string(),
    capability: z.enum(["read", "write", "execute"]),
    input: z.unknown(),
    detail: z.string().optional(),
    diff: z.string().optional(),
  }),
  z.object({
    ...eventBase,
    type: z.literal("permission.resolved"),
    requestId: z.string(),
    approved: z.boolean(),
  }),
])
export type SessionEvent = z.infer<typeof SessionEvent>

export const CreateSessionRequest = z.object({
  title: z.string().min(1).optional(),
})
export type CreateSessionRequest = z.infer<typeof CreateSessionRequest>

export const SendMessageRequest = z.object({
  text: z.string().min(1),
})
export type SendMessageRequest = z.infer<typeof SendMessageRequest>

export const ForkSessionRequest = z.object({
  atSeq: z.number().int().nonnegative().optional(),
  title: z.string().optional(),
})
export type ForkSessionRequest = z.infer<typeof ForkSessionRequest>

export const PermissionDecisionRequest = z.object({
  approved: z.boolean(),
})
export type PermissionDecisionRequest = z.infer<typeof PermissionDecisionRequest>

export const SessionSummary = z.object({
  id: SessionId,
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastSeq: EventSeq,
})
export type SessionSummary = z.infer<typeof SessionSummary>

export const SessionMessage = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string(),
})
export type SessionMessage = z.infer<typeof SessionMessage>

export const SessionSnapshot = z.object({
  id: SessionId,
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastSeq: EventSeq,
  messages: z.array(SessionMessage),
})
export type SessionSnapshot = z.infer<typeof SessionSnapshot>
