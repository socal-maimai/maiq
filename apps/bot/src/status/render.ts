import { Row, TextDisplay } from '@buape/carbon'
import { lineName, type Arcade, type Line } from '@maiq/core/arcades'
import { formatCount } from '@maiq/core/count'
import { downSides } from '@maiq/core/buttons'
import type { ButtonState } from '@maiq/core/button-service'
import { playableSeats, rotation } from '@maiq/core/rotation'
import type { LineState } from '@maiq/core/state'
import { ConfirmButton } from '@maiq/bot/components/confirm-button'
import { UpdateButton } from '@maiq/bot/components/update-button'
import type { BotDeps } from '@maiq/bot/deps'

const unix = (date: Date): number => Math.floor(date.getTime() / 1000)

function lineText(line: Line, state: LineState | undefined, down: number): string {
  const heading = `### ${lineName(line)}`
  if (!state?.count || !state.reportedAt) {
    const last = state?.reportedAt
      ? `Last report <t:${unix(state.reportedAt)}:R>`
      : 'No reports yet'
    return [heading, '**?**', last].join('\n')
  }
  const { text } = rotation(
    state.count.players,
    state.count.queue,
    playableSeats(line, down),
    false
  )
  return [
    heading,
    `**${formatCount(state.count)}**`,
    text,
    `Updated <t:${unix(state.reportedAt)}:R>`,
  ].join('\n')
}

export function statusComponents(
  deps: BotDeps,
  arcade: Arcade,
  states: readonly LineState[],
  buttonStates: readonly ButtonState[]
): (TextDisplay | Row<ConfirmButton | UpdateButton>)[] {
  const byLine = new Map(states.map(state => [state.lineId, state]))
  return arcade.lines.flatMap(line => {
    const state = byLine.get(line.id)
    return [
      new TextDisplay(lineText(line, state, downSides(buttonStates, line.id))),
      new Row([new ConfirmButton(deps, line, state?.count ?? null), new UpdateButton(deps, line)]),
    ]
  })
}
