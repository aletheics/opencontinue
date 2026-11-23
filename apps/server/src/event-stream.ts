import type { SessionStore } from "@opencontinue/core"
import type { SessionEvent } from "@opencontinue/protocol"

/**
 * Subscribe before reading history, so an event appended during replay is
 * buffered instead of lost. Events are delivered once, in seq order.
 */
export async function followSession(
  store: SessionStore,
  sessionId: string,
  after: number,
  send: (event: SessionEvent) => Promise<void> | void,
): Promise<() => void> {
  let lastSeq = after
  let replaying = true
  let buffered: SessionEvent[] = []
  let chain = Promise.resolve()

  const deliver = async (event: SessionEvent): Promise<void> => {
    if (event.seq <= lastSeq) return
    lastSeq = event.seq
    await send(event)
  }

  const enqueue = (event: SessionEvent): void => {
    chain = chain.then(() => deliver(event)).catch(() => {})
  }

  const unsubscribe = store.subscribe(sessionId, (event) => {
    if (replaying) buffered.push(event)
    else enqueue(event)
  })

  try {
    for (const event of store.events(sessionId, after)) {
      await deliver(event)
    }

    while (buffered.length > 0) {
      const batch = buffered
      buffered = []
      for (const event of batch) await deliver(event)
    }

    replaying = false
  } catch (error) {
    unsubscribe()
    throw error
  }

  return unsubscribe
}
