import { eq } from 'drizzle-orm'
import type { StatusMessageStore } from '@maiq/bot/deps'
import { discordStatusMessages, type Database } from '@maiq/db'

const table = discordStatusMessages

export function createStatusMessageStore(db: Database): StatusMessageStore {
  return {
    forChannel: channelId => db.select().from(table).where(eq(table.channelId, channelId)),
    forLine: lineId => db.select().from(table).where(eq(table.lineId, lineId)),
    replaceForChannel: ({ guildId, channelId, messageId, lineIds }) =>
      db.transaction(async tx => {
        const affected = eq(table.channelId, channelId)
        const replaced = await tx.select().from(table).where(affected)
        await tx.delete(table).where(affected)
        if (lineIds.length > 0) {
          await tx
            .insert(table)
            .values(lineIds.map(lineId => ({ lineId, guildId, channelId, messageId })))
        }
        return replaced
      }),
    async removeMessage(messageId) {
      await db.delete(table).where(eq(table.messageId, messageId))
    },
  }
}
