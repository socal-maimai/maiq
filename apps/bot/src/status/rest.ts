import { Routes, serializePayload, type APIMessage, type Client } from '@buape/carbon'
import type { Arcade } from '@maiq/core/arcades'
import type { BotDeps } from '@maiq/bot/deps'
import { statusComponents } from '@maiq/bot/status/render'
import { discordStatus } from '@maiq/bot/discord-status'

async function statusBody(deps: BotDeps, arcade: Arcade) {
  const lineIds = arcade.lines.map(line => line.id)
  const [states, buttonStates] = await Promise.all([
    deps.queue.lineStates(lineIds),
    deps.buttons.buttonStates(lineIds),
  ])
  return serializePayload({ components: statusComponents(deps, arcade, states, buttonStates) })
}

export async function postPinnedStatus(
  client: Client,
  deps: BotDeps,
  channelId: string,
  arcade: Arcade
): Promise<string> {
  const message = (await client.rest.post(Routes.channelMessages(channelId), {
    body: await statusBody(deps, arcade),
  })) as APIMessage
  try {
    await client.rest.put(Routes.channelMessagesPin(channelId, message.id))
  } catch (error) {
    await deleteMessageIfPresent(client, channelId, message.id)
    throw error
  }
  return message.id
}

export async function editStatus(
  client: Client,
  deps: BotDeps,
  target: { channelId: string; messageId: string },
  arcade: Arcade
): Promise<void> {
  await client.rest.patch(Routes.channelMessage(target.channelId, target.messageId), {
    body: await statusBody(deps, arcade),
  })
}

export async function deleteMessageIfPresent(
  client: Client,
  channelId: string,
  messageId: string
): Promise<void> {
  try {
    await client.rest.delete(Routes.channelMessage(channelId, messageId))
  } catch (error) {
    if (discordStatus(error) === 404) return
    throw error
  }
}
