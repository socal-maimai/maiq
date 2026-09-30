import { findArcade, LINE_IDS } from '@maiq/core/arcades'
import { GetButtons, toButtonStateJson } from '@maiq/types'
import { declareRoute } from '@maiq/api/lib/router'

export const buttonsRoute = declareRoute(GetButtons, async ({ query, res, deps }) => {
  let lineIds = LINE_IDS
  if (query.arcadeId !== undefined) {
    const arcade = findArcade(query.arcadeId)
    if (!arcade) return res.badUnknownArcade()
    lineIds = arcade.lines.map(line => line.id)
  }
  const states = await deps.buttons.buttonStates(lineIds)
  return res.goodButtons({ buttons: states.map(toButtonStateJson) })
})
