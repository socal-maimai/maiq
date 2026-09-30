import type { Arcade } from '@maiq/core/arcades'
import type { ButtonState } from '@maiq/core/button-service'
import {
  type ButtonStatus,
  type Cabinet,
  cabinetsOf,
  type ConfirmedStatus,
  isStation,
  issueText,
  SIDES,
  type Side,
  STATUS_LABEL,
  stationStatusLabel,
  summarizeIssues,
} from '@maiq/core/buttons'

const ALL_WORKING = 'All buttons and sides working'

export const MAX_TEXT_LENGTH = 3800

export type ButtonsMessage = {
  heading: string
  summary: string
  cabinets: string | null
}

const BLOCK_SEPARATOR = '\n\n'

const EMOJI: Record<ConfirmedStatus, string> = { good: '🟢', unreliable: '🟡', broken: '🔴' }
const PENDING_EMOJI = '⚪'
const WHOLE_CAB_DOWN = `${EMOJI.broken} **Whole cab down**`
const GAP = '\u2003'

type Entry = { lines: string[]; covers: number }
type Block = { header: string; entries: Entry[] }

function item(state: ButtonState): string {
  const station = isStation(state)
  const labels: Record<ButtonStatus, string> = station ? stationStatusLabel : STATUS_LABEL
  const pendingOnGood = state.pending !== null && state.confirmed === 'good'
  const emoji = pendingOnGood ? PENDING_EMOJI : EMOJI[state.confirmed]
  const status = (pendingOnGood ? labels.pending : labels[state.confirmed]).toLowerCase()
  return station ? `${emoji} side ${status}` : `${emoji} **${state.button}** ${status}`
}

const isDown = (here: readonly ButtonState[], side: Side): boolean =>
  here.some(s => isStation(s) && s.side === side && s.confirmed === 'broken')

function sideEntry(side: Side, states: readonly ButtonState[]): Entry | null {
  const onSide = states.filter(s => s.side === side)
  if (onSide.length === 0) return null
  return { lines: [`\`${side}P\` ${onSide.map(item).join(GAP)}`], covers: onSide.length }
}

function cabinetBlock(cabinet: Cabinet, problems: readonly ButtonState[]): Block | null {
  const here = problems
    .filter(s => s.lineId === cabinet.line.id && s.cab === cabinet.cab)
    .toSorted((a, b) => a.side - b.side || a.button - b.button)
  if (here.length === 0) return null
  const wholeCabDown = SIDES.every(side => isDown(here, side))
  const shown = wholeCabDown ? here.filter(s => !isStation(s)) : here
  const entries = SIDES.map(side => sideEntry(side, shown)).filter(entry => entry !== null)
  if (wholeCabDown) entries.unshift({ lines: [WHOLE_CAB_DOWN], covers: SIDES.length })
  return { header: `**${cabinet.label}**`, entries }
}

function layoutBlocks(blocks: readonly Block[], budget: number) {
  const texts: string[] = []
  let used = 0
  let covered = 0
  for (const block of blocks) {
    const lines: string[] = []
    for (const entry of block.entries) {
      const first = lines.length === 0
      const next = first ? [block.header, ...entry.lines] : entry.lines
      let separator = 1
      if (first) separator = texts.length === 0 ? 0 : BLOCK_SEPARATOR.length
      const cost = next.join('\n').length + separator
      if (used + cost > budget) {
        if (lines.length > 0) texts.push(lines.join('\n'))
        return { texts, covered }
      }
      lines.push(...next)
      used += cost
      covered += entry.covers
    }
    texts.push(lines.join('\n'))
  }
  return { texts, covered }
}

const moreLine = (remaining: number): string => `-# …and ${remaining} more need attention`

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

export function buttonsMessage(arcade: Arcade, states: readonly ButtonState[]): ButtonsMessage {
  const issues = summarizeIssues(states)
  const summary = issues.total === 0 ? ALL_WORKING : capitalize(issueText(issues))
  const heading = `## ${arcade.name}\n-# ${summary}`
  const problems = states.filter(state => state.status !== 'good')
  const blocks = cabinetsOf(arcade)
    .map(cabinet => cabinetBlock(cabinet, problems))
    .filter(block => block !== null)
  const budget = MAX_TEXT_LENGTH - heading.length - moreLine(problems.length).length - 1
  const { texts, covered } = layoutBlocks(blocks, budget)
  const listed = texts.length === 0 ? null : texts.join(BLOCK_SEPARATOR)
  if (covered === problems.length) return { heading, summary, cabinets: listed }
  const trailer = moreLine(problems.length - covered)
  return { heading, summary, cabinets: listed === null ? trailer : `${listed}\n${trailer}` }
}
