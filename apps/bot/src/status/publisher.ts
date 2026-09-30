import type { Client } from '@buape/carbon'
import { arcadeOfLine, findLine } from '@maiq/core/arcades'
import type { BotDeps, StatusMessage } from '@maiq/bot/deps'
import { editStatus } from '@maiq/bot/status/rest'
import { discordStatus } from '@maiq/bot/discord-status'

export type StatusPublisher = {
  schedule(lineId: string): void
  flush(): Promise<void>
}

type Pending = { row: StatusMessage; timer: ReturnType<typeof setTimeout> }

export function createStatusPublisher(options: {
  client: Client
  deps: BotDeps
  delayMs: number
}): StatusPublisher {
  const { client, deps, delayMs } = options
  const timers = new Map<string, Pending>()
  const inFlight = new Set<Promise<void>>()

  const track = (work: Promise<void>, failure: string) => {
    const tracked: Promise<void> = work
      .catch((error: unknown) => {
        deps.logger.error({ err: error }, failure)
      })
      .finally(() => {
        inFlight.delete(tracked)
      })
    inFlight.add(tracked)
  }

  async function refresh(row: StatusMessage): Promise<void> {
    const line = findLine(row.lineId)
    if (!line) {
      await deps.statusMessages.removeMessage(row.messageId)
      return
    }
    const arcade = arcadeOfLine(line)
    try {
      await editStatus(client, deps, row, arcade)
    } catch (error) {
      const status = discordStatus(error)
      if (status === 403) {
        deps.logger.warn(
          { err: error, channelId: row.channelId, messageId: row.messageId },
          `Discord refused the status edit in channel ${row.channelId}. ` +
            "Check the bot's permissions there."
        )
        return
      }
      if (status !== 404) throw error
      await deps.statusMessages.removeMessage(row.messageId)
      deps.logger.warn(
        { channelId: row.channelId, messageId: row.messageId },
        'Status message no longer exists; run /setup in that channel to recreate it'
      )
    }
  }

  const refreshNow = (row: StatusMessage) =>
    track(refresh(row), 'Could not update a Discord status message')

  function start(row: StatusMessage): void {
    if (timers.has(row.messageId)) return
    const timer = setTimeout(() => {
      timers.delete(row.messageId)
      refreshNow(row)
    }, delayMs)
    timers.set(row.messageId, { row, timer })
  }

  return {
    schedule(lineId) {
      track(
        deps.statusMessages.forLine(lineId).then(rows => {
          for (const row of rows) start(row)
        }),
        'Could not look up the Discord status message for a line'
      )
    },
    async flush() {
      await Promise.all(inFlight)
      for (const [messageId, { row, timer }] of timers) {
        clearTimeout(timer)
        timers.delete(messageId)
        refreshNow(row)
      }
      await Promise.all(inFlight)
    },
  }
}
