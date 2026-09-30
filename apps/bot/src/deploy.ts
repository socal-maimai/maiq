import path from 'node:path'
import { loadConfig } from '@maiq/config'
import { createDiscordClient } from '@maiq/bot/client'
import type { BotDeps } from '@maiq/bot/deps'

const unavailable = () =>
  Promise.reject(new Error('The deploy script does not handle interactions'))

const deployOnlyDeps: BotDeps = {
  queue: { submitReport: unavailable, confirm: unavailable, lineStates: unavailable },
  buttons: { buttonStates: unavailable, submit: unavailable },
  statusMessages: {
    forChannel: unavailable,
    forLine: unavailable,
    replaceForChannel: unavailable,
    removeMessage: unavailable,
  },
  logger: {
    error: (details, message) => console.error(message, details),
    warn: (details, message) => console.warn(message, details),
    info: (details, message) => console.info(message, details),
  },
}

const config = loadConfig({
  dir: process.env['MAIQ_CONFIG_DIR'] ?? path.join(import.meta.dir, '..', '..', '..', 'maiq.d'),
  env: process.env,
})
if (!config.discord) {
  throw new Error(
    'Set MAIQ_DISCORD_APPLICATION_ID, MAIQ_DISCORD_PUBLIC_KEY, and MAIQ_DISCORD_TOKEN ' +
      'to deploy commands.'
  )
}

const client = createDiscordClient(
  { ...config.discord, publicUrl: config.publicUrl },
  deployOnlyDeps
)
const result = await client.deployCommands()
console.info(`Registered ${client.commands.length} commands`, result)
