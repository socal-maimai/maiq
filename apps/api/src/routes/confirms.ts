import { findLine } from '@maiq/core/arcades'
import { PostConfirm, toLineStateJson } from '@maiq/types'
import { declareRoute } from '@maiq/api/lib/router'
import { webWriter } from '@maiq/api/lib/web-writer'

export const confirmRoute = declareRoute(PostConfirm, async ({ body, res, deps }) => {
  const line = findLine(body.lineId)
  if (!line) return res.badUnknownLine()
  const result = await deps.queue.confirm(webWriter(body, line))
  if (result.ok) return res.goodConfirm({ line: toLineStateJson(result.state) })
  switch (result.error) {
    case 'unknownLine':
      return res.badUnknownLine()
    case 'rateLimited':
      return res.badRateLimit({ retryAfterMs: result.retryAfterMs })
    case 'nothingToConfirm':
      return res.badNothingToConfirm()
    case 'playersOverCap':
    case 'queueOverCap':
      throw new Error(`confirm() returned ${result.error}, which only submitReport() can return`)
  }
})
