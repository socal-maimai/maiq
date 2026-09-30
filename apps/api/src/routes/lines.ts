import { GetLines, toLineStateJson } from '@maiq/types'
import { declareRoute } from '@maiq/api/lib/router'

export const linesRoute = declareRoute(GetLines, async ({ res, deps }) => {
  const states = await deps.queue.lineStates()
  return res.goodLines({ lines: states.map(toLineStateJson) })
})
