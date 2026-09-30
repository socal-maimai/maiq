import {
  Routes,
  Row,
  serializePayload,
  type MessagePayloadObject,
  type RequestClient,
} from '@buape/carbon'
import { pickLine, soleLine, type Arcade, type Line } from '@maiq/core/arcades'
import { findCount, type Count } from '@maiq/core/count'
import { PickLineButton } from '@maiq/bot/components/pick-line-button'
import { addCheckMark, logChatFailure } from '@maiq/bot/chat/rest'
import type { BotDeps } from '@maiq/bot/deps'
import { channelArcade, describeWrite, discordReport } from '@maiq/bot/replies'
import { queueText } from '@maiq/bot/status/render'

export type ChatMessage = {
  id: string
  channelId: string
  guildId: string | null
  content: string
  authorId: string
  authorIsBot: boolean
  webhookId: string | null
}

async function replyTo(
  rest: RequestClient,
  message: ChatMessage,
  payload: MessagePayloadObject
): Promise<void> {
  await rest.post(Routes.channelMessages(message.channelId), {
    body: {
      ...serializePayload({ ...payload, allowedMentions: { replied_user: false } }),
      message_reference: { message_id: message.id, fail_if_not_exists: false },
    },
  })
}

function chooseLine(arcade: Arcade, content: string): Line | null {
  return soleLine(arcade) ?? pickLine(arcade.lines, content)
}

async function askForLine(
  message: ChatMessage,
  arcade: Arcade,
  count: Count,
  deps: BotDeps,
  rest: RequestClient
): Promise<void> {
  const buttons = arcade.lines.map(line => new PickLineButton(deps, line, count, message.authorId))
  await replyTo(rest, message, {
    content: `Which line at ${arcade.name}?`,
    components: [new Row(buttons)],
  })
}

const QUEUE_QUESTION = /^(q|queue)\?+$/i

async function answerQueue(message: ChatMessage, deps: BotDeps, rest: RequestClient) {
  const arcade = await channelArcade(deps.statusMessages, message.channelId)
  if (!arcade) return
  const lineIds = arcade.lines.map(line => line.id)
  const [states, buttonStates] = await Promise.all([
    deps.queue.lineStates(lineIds),
    deps.buttons.buttonStates(lineIds),
  ])
  await replyTo(rest, message, { content: queueText(arcade, states, buttonStates) })
}

async function record(message: ChatMessage, deps: BotDeps, rest: RequestClient): Promise<void> {
  const count = findCount(message.content)
  if (!count) return
  const arcade = await channelArcade(deps.statusMessages, message.channelId)
  if (!arcade) return
  const line = chooseLine(arcade, message.content)
  if (!line) {
    await askForLine(message, arcade, count, deps, rest)
    return
  }
  const result = await deps.queue.submitReport(discordReport(line, count, message.authorId))
  if (result.ok) {
    await addCheckMark(rest, message.channelId, message.id)
    return
  }
  await replyTo(rest, message, { content: describeWrite(line, result, 'Updated') })
}

export async function handleChatMessage(
  message: ChatMessage,
  deps: BotDeps,
  rest: RequestClient
): Promise<void> {
  if (message.authorIsBot || message.webhookId || !message.guildId) return
  try {
    if (QUEUE_QUESTION.test(message.content.trim())) await answerQueue(message, deps, rest)
    else await record(message, deps, rest)
  } catch (error) {
    logChatFailure(deps, error, { channelId: message.channelId, messageId: message.id })
  }
}
