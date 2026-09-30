export type Count = { players: number; queue: number }

export type ParseCountResult = { ok: true; count: Count } | { ok: false; reason: string }

export const COUNT_HINT = 'Write the count like 4p2q: 4 playing, 2 queueing.'

const COUNT_PATTERN = /^(\d{1,2})\s*p\s*(\d{1,2})\s*q$/i

export function parseCount(input: string): ParseCountResult {
  const match = COUNT_PATTERN.exec(input.trim())
  if (!match) return { ok: false, reason: COUNT_HINT }
  const [, players = '', queue = ''] = match
  return { ok: true, count: { players: Number(players), queue: Number(queue) } }
}

export const formatCount = ({ players, queue }: Count): string => `${players}p${queue}q`

const COUNT_TOKEN = /(?<![\p{L}\p{N}])(\d{1,2})\s*p\s*(\d{1,2})\s*q(?![\p{L}\p{N}])/giu

export function findCount(text: string): Count | null {
  const matches = [...text.matchAll(COUNT_TOKEN)]
  const [only, ...rest] = matches
  if (!only || rest.length > 0) return null
  const [, players = '', queue = ''] = only
  return { players: Number(players), queue: Number(queue) }
}
