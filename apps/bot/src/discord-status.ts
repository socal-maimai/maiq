import { DiscordError } from '@buape/carbon'

export const discordStatus = (error: unknown): number | null =>
  error instanceof DiscordError ? error.status : null
