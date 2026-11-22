import { z } from "zod"

export const SessionId = z.string().uuid()
export type SessionId = z.infer<typeof SessionId>

export const EventSeq = z.number().int().nonnegative()
export type EventSeq = z.infer<typeof EventSeq>

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
