import { LINES, type Line } from '@maiq/core/arcades'
import type { Count } from '@maiq/core/count'

export const MAX_QUEUE = 40

export const maxPlayers = (line: Line): number => 2 * line.cabs

export const MAX_PLAYERS_PER_LINE = Math.max(...LINES.map(maxPlayers))

export const cabsText = (line: Line): string => `${line.cabs} cab${line.cabs === 1 ? '' : 's'}`

export type CountProblem = 'playersOverCap' | 'queueOverCap'

export function checkCount(line: Line, count: Count): CountProblem | null {
  if (count.players > maxPlayers(line)) return 'playersOverCap'
  if (count.queue > MAX_QUEUE) return 'queueOverCap'
  return null
}
