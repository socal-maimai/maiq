import type { Count } from '@maiq/core/count'
import type { LineState, ReportSource } from '@maiq/core/state'

export type Writer = {
  lineId: string
  source: ReportSource
  reporter: string
  inGeofence: boolean | null
}

export type ReportInput = Writer & { count: Count }

export type ConfirmInput = Writer

export type WriteError =
  | { error: 'unknownLine' }
  | { error: 'playersOverCap'; maxPlayers: number }
  | { error: 'queueOverCap'; maxQueue: number }
  | { error: 'rateLimited'; retryAfterMs: number }
  | { error: 'nothingToConfirm' }

export type WriteResult = { ok: true; state: LineState } | ({ ok: false } & WriteError)

export type QueueService = {
  submitReport(input: ReportInput): Promise<WriteResult>
  confirm(input: ConfirmInput): Promise<WriteResult>
  lineStates(lineIds?: readonly string[]): Promise<LineState[]>
}
