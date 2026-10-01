import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  index,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

const moderationColumns = () => ({
  hiddenAt: timestamp('hidden_at', { withTimezone: true }),
  hiddenBy: text('hidden_by'),
  test: boolean('test').notNull().default(false),
})

export const queueReports = pgTable(
  'queue_reports',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    lineId: text('line_id').notNull(),
    players: smallint('players').notNull(),
    queue: smallint('queue').notNull(),
    kind: text('kind', { enum: ['report', 'confirm'] }).notNull(),
    source: text('source', { enum: ['web', 'discord'] }).notNull(),
    reporter: text('reporter').notNull(),
    reporterName: text('reporter_name'),
    inGeofence: boolean('in_geofence'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    ...moderationColumns(),
  },
  table => [
    index('queue_reports_line_created_idx').on(table.lineId, table.createdAt.desc()),
    index('queue_reports_reporter_line_created_idx').on(
      table.reporter,
      table.lineId,
      table.createdAt.desc()
    ),
    check('queue_reports_players_range', sql`${table.players} between 0 and 8`),
    check('queue_reports_queue_range', sql`${table.queue} between 0 and 40`),
    check('queue_reports_kind', sql`${table.kind} in ('report', 'confirm')`),
    check('queue_reports_source', sql`${table.source} in ('web', 'discord')`),
    index('queue_reports_created_idx').on(table.createdAt.desc()),
  ]
)

export const buttonReports = pgTable(
  'button_reports',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    lineId: text('line_id').notNull(),
    cab: smallint('cab').notNull(),
    side: smallint('side').$type<1 | 2>().notNull(),
    button: smallint('button').notNull(),
    kind: text('kind', { enum: ['works', 'unreliable', 'broken'] }).notNull(),
    description: text('description').notNull().default(''),
    reporter: text('reporter').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    ...moderationColumns(),
  },
  table => [
    index('button_reports_button_created_idx').on(
      table.lineId,
      table.cab,
      table.side,
      table.button,
      table.createdAt.desc()
    ),
    index('button_reports_reporter_created_idx').on(table.reporter, table.createdAt.desc()),
    check('button_reports_cab_range', sql`${table.cab} between 1 and 20`),
    check('button_reports_side', sql`${table.side} in (1, 2)`),
    check('button_reports_button_range', sql`${table.button} between 0 and 8`),
    check('button_reports_kind', sql`${table.kind} in ('works', 'unreliable', 'broken')`),
    index('button_reports_created_idx').on(table.createdAt.desc()),
    check(
      'button_reports_description',
      sql.join([
        sql`char_length(${table.description}) <= 280 and `,
        sql`(${table.kind} = 'works' or char_length(btrim(${table.description})) > 0)`,
      ])
    ),
  ]
)

export const discordStatusMessages = pgTable(
  'discord_status_messages',
  {
    lineId: text('line_id').notNull(),
    guildId: text('guild_id').notNull(),
    channelId: text('channel_id').notNull(),
    messageId: text('message_id').notNull(),
  },
  table => [
    primaryKey({ columns: [table.channelId, table.lineId] }),
    index('discord_status_messages_channel_idx').on(table.channelId),
    index('discord_status_messages_line_idx').on(table.lineId),
  ]
)

export const mutedReporters = pgTable('muted_reporters', {
  reporter: text('reporter').primaryKey(),
  mutedBy: text('muted_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
