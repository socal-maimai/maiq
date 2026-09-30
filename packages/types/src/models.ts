import type { ButtonState } from '@maiq/core/button-service'
import { BUTTON_STATUSES, CONFIRMED_STATUSES, REPORT_KINDS } from '@maiq/core/buttons'
import type { LineState } from '@maiq/core/state'
import { z } from 'zod/mini'

const CountSchema = z.object({ players: z.int(), queue: z.int() })

export const LineStateJsonSchema = z.object({
  lineId: z.string(),
  count: z.nullable(CountSchema),
  reportedAt: z.nullable(z.int()),
  freshness: z.enum(['fresh', 'stale', 'unknown']),
  verified: z.boolean(),
})

export type LineStateJson = z.output<typeof LineStateJsonSchema>

export const toLineStateJson = (state: LineState): LineStateJson => ({
  lineId: state.lineId,
  count: state.count,
  reportedAt: state.reportedAt?.getTime() ?? null,
  freshness: state.freshness,
  verified: state.verified,
})

export const fromLineStateJson = (json: LineStateJson): LineState => ({
  lineId: json.lineId,
  count: json.count,
  reportedAt: json.reportedAt === null ? null : new Date(json.reportedAt),
  freshness: json.freshness,
  verified: json.verified,
})

export const ButtonStateJsonSchema = z.object({
  lineId: z.string(),
  cab: z.int(),
  side: z.union([z.literal(1), z.literal(2)]),
  button: z.int(),
  status: z.enum(BUTTON_STATUSES),
  confirmed: z.enum(CONFIRMED_STATUSES),
  pending: z.nullable(z.enum(REPORT_KINDS)),
  pendingVotes: z.int(),
  recent: z.array(z.object({ kind: z.enum(REPORT_KINDS), description: z.string(), at: z.int() })),
})

export type ButtonStateJson = z.output<typeof ButtonStateJsonSchema>

export const toButtonStateJson = (state: ButtonState): ButtonStateJson => ({
  lineId: state.lineId,
  cab: state.cab,
  side: state.side,
  button: state.button,
  status: state.status,
  confirmed: state.confirmed,
  pending: state.pending,
  pendingVotes: state.pendingVotes,
  recent: state.recent.map(report => ({
    kind: report.kind,
    description: report.description,
    at: report.at.getTime(),
  })),
})
