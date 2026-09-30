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

type LineSummary = { count: string; wait: string | null; age: string }

function summarize(line: Line, state: LineState | undefined, down: number): LineSummary {
  if (!state?.count || !state.reportedAt) {
    const age = state?.reportedAt ? `Last report <t:${unix(state.reportedAt)}:R>` : 'No reports yet'
    return { count: '?', wait: null, age }
  }
  const seats = playableSeats(line, down)
  const { text } = rotation(state.count.players, state.count.queue, seats, false)
  return {
    count: formatCount(state.count),
    wait: text,
    age: `Updated <t:${unix(state.reportedAt)}:R>`,
  }
}

function lineText(line: Line, state: LineState | undefined, down: number): string {
  const { count, wait, age } = summarize(line, state, down)
  return [`### ${lineName(line)}`, `**${count}**`, wait, age].filter(Boolean).join('\n')
}

export function queueText(
  arcade: Arcade,
  states: readonly LineState[],
  buttonStates: readonly ButtonState[]
): string {
  const byLine = new Map(states.map(state => [state.lineId, state]))
  return arcade.lines
    .map(line => {
      const { count, wait, age } = summarize(
        line,
        byLine.get(line.id),
        downSides(buttonStates, line.id)
      )
      const detail = wait ? `${wait}, ${age.charAt(0).toLowerCase()}${age.slice(1)}` : age
      return `**${lineName(line)}** ${count}\n-# ${detail}`
    })
    .join('\n')
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
