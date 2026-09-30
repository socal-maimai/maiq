import type { Logger } from '@maiq/api/lib/logger'

type ShutdownParts = {
  server: { stop(closeActiveConnections: boolean): Promise<void> }
  bot: { disconnect(): void; publisher: { flush(): Promise<void> } } | null
  database: { end(): Promise<void> }
  logger: Logger
  flushDeadlineMs: number
}

async function finishesWithin(work: Promise<void>, deadlineMs: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<false>(resolve => {
    timer = setTimeout(() => resolve(false), deadlineMs)
  })
  try {
    return await Promise.race([work.then(() => true), deadline])
  } finally {
    clearTimeout(timer)
  }
}

export async function shutdown(parts: ShutdownParts): Promise<void> {
  await parts.server.stop(true)
  if (parts.bot) {
    parts.bot.disconnect()
    const flushed = await finishesWithin(parts.bot.publisher.flush(), parts.flushDeadlineMs)
    if (!flushed) {
      parts.logger.warn(
        { deadlineMs: parts.flushDeadlineMs },
        'Pending Discord status edits did not finish before the shutdown deadline'
      )
    }
  }
  await parts.database.end()
}
