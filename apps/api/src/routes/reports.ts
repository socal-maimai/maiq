import { findLine } from '@maiq/core/arcades'
import { PostReport, toLineStateJson } from '@maiq/types'
import { declareRoute } from '@maiq/api/lib/router'
import { webWriter } from '@maiq/api/lib/web-writer'

export const reportRoute = declareRoute(PostReport, async ({ body, res, deps }) => {
  const line = findLine(body.lineId)
  if (!line) return res.badUnknownLine()
  const result = await deps.queue.submitReport({
    ...webWriter(body, line),
    count: { players: body.players, queue: body.queue },
  })
  if (result.ok) return res.goodReport({ line: toLineStateJson(result.state) })
  switch (result.error) {
    case 'unknownLine':
      return res.badUnknownLine()
    case 'playersOverCap':
      return res.badPlayersOverCap({ maxPlayers: result.maxPlayers })
    case 'queueOverCap':
      return res.badValidation({ reason: `body.queue: at most ${result.maxQueue}` })
    case 'rateLimited':
      return res.badRateLimit({ retryAfterMs: result.retryAfterMs })
    case 'nothingToConfirm':
      throw new Error('submitReport returned nothingToConfirm, which only confirm() can return')
  }
})
