import { Routes, type RequestClient } from '@buape/carbon'
import type { BotDeps } from '@maiq/bot/deps'
import { discordStatus } from '@maiq/bot/discord-status'

const CHECK_MARK = encodeURIComponent('✅')

export async function addCheckMark(
  rest: RequestClient,
  channelId: string,
  messageId: string
): Promise<void> {
  await rest.put(Routes.channelMessageOwnReaction(channelId, messageId, CHECK_MARK))
}

export function logChatFailure(
  deps: BotDeps,
  error: unknown,
  target: { channelId: string; messageId: string }
): void {
  if (discordStatus(error) === 403) {
    deps.logger.warn(
      { err: error, ...target },
      `Discord refused access in channel ${target.channelId}. Check the bot's permissions there.`
    )
    return
  }
  deps.logger.error({ err: error, ...target }, 'Chat report failed')
}
