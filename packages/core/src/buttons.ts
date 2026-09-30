import { LINES, type Arcade, type Line } from '@maiq/core/arcades'

export const BUTTONS_PER_STATION = 8
export const STATION = 0
export const SIDES = [1, 2] as const
export type Side = (typeof SIDES)[number]
export const MAX_CABS_PER_LINE = Math.max(...LINES.map(line => line.cabs))
export const DESCRIPTION_MAX = 280
export const RECENT_REPORTS = 4

export const REPORT_KINDS = ['works', 'unreliable', 'broken'] as const
export type ReportKind = (typeof REPORT_KINDS)[number]
export const CONFIRMED_STATUSES = ['good', 'unreliable', 'broken'] as const
export type ConfirmedStatus = (typeof CONFIRMED_STATUSES)[number]
export const BUTTON_STATUSES = [...CONFIRMED_STATUSES, 'pending'] as const
export type ButtonStatus = (typeof BUTTON_STATUSES)[number]

export type StatusPair = { status: ButtonStatus; confirmed: ConfirmedStatus }

export const UNREPORTED: Readonly<StatusPair> = { status: 'good', confirmed: 'good' }

export const KIND_LABEL: Record<ReportKind, string> = {
  works: 'Works fine',
  unreliable: 'Unreliable',
  broken: 'Broken',
}

export const STATUS_LABEL: Record<ButtonStatus, string> = {
  good: 'Good',
  unreliable: 'Unreliable',
  broken: 'Broken',
  pending: 'Pending',
}

export const stationKindLabel: Record<ReportKind, string> = {
  works: 'Working',
  unreliable: 'Acting up',
  broken: 'Down',
}

export const stationStatusLabel: Record<ButtonStatus, string> = {
  good: 'Working',
  unreliable: 'Acting up',
  broken: 'Down',
  pending: 'Pending',
}

const STATUS_OF_KIND: Record<ReportKind, ConfirmedStatus> = {
  works: 'good',
  unreliable: 'unreliable',
  broken: 'broken',
}

export const statusOfKind = (kind: ReportKind): ConfirmedStatus => STATUS_OF_KIND[kind]

export type ButtonRef = { lineId: string; cab: number; side: Side; button: number }

export const buttonKey = (ref: ButtonRef): string =>
  `${ref.lineId}/${ref.cab}/${ref.side}/${ref.button}`

export const isStation = (ref: { button: number }): boolean => ref.button === STATION

const inRange = (value: number, min: number, max: number): boolean =>
  Number.isInteger(value) && value >= min && value <= max

export function isButtonOf(
  line: Line,
  ref: { cab: number; side: number; button: number }
): boolean {
  return (
    inRange(ref.cab, 1, line.cabs) &&
    (ref.side === 1 || ref.side === 2) &&
    inRange(ref.button, STATION, BUTTONS_PER_STATION)
  )
}

export function downSides(
  states: Iterable<{ lineId: string; button: number; confirmed: ConfirmedStatus }>,
  lineId: string
): number {
  let down = 0
  for (const state of states) {
    if (state.lineId === lineId && isStation(state) && state.confirmed === 'broken') down += 1
  }
  return down
}

export type Cabinet = { line: Line; cab: number; label: string }

export function cabinetLabel(line: Line, cab: number): string {
  if (line.label) return line.cabs > 1 ? `${line.label.replace(/s$/, '')} ${cab}` : line.label
  return line.cabs > 1 ? `Cab ${cab}` : 'Cab'
}

export const cabinetsOf = (arcade: Arcade): Cabinet[] =>
  arcade.lines.flatMap(line =>
    Array.from({ length: line.cabs }, (_, index) => ({
      line,
      cab: index + 1,
      label: cabinetLabel(line, index + 1),
    }))
  )

export const needsDescription = (kind: ReportKind): boolean => kind !== 'works'

export type DescriptionProblem = 'required' | 'tooLong'

export function checkDescription(
  kind: ReportKind,
  raw: string
): { ok: true; description: string } | { ok: false; problem: DescriptionProblem } {
  const description = raw.trim()
  if (description.length > DESCRIPTION_MAX) return { ok: false, problem: 'tooLong' }
  if (description.length === 0 && needsDescription(kind)) return { ok: false, problem: 'required' }
  return { ok: true, description }
}

export type IssueStatus = 'broken' | 'unreliable' | 'pending'

type IssueCounts = Record<IssueStatus, number>

export type IssueSummary = IssueCounts & {
  sides: IssueCounts
  total: number
  worst: IssueStatus | null
}

const ISSUE_ORDER: readonly IssueStatus[] = ['broken', 'unreliable', 'pending']

export type IssueInput = { confirmed: ConfirmedStatus; status: ButtonStatus }

const sumOf = (counts: IssueCounts): number => counts.broken + counts.unreliable + counts.pending

export function summarizeIssues(items: Iterable<IssueInput & { button: number }>): IssueSummary {
  const buttons: IssueCounts = { broken: 0, unreliable: 0, pending: 0 }
  const sides: IssueCounts = { broken: 0, unreliable: 0, pending: 0 }
  for (const item of items) {
    const counts = isStation(item) ? sides : buttons
    if (item.confirmed !== 'good') counts[item.confirmed] += 1
    else if (item.status === 'pending') counts.pending += 1
  }
  return {
    ...buttons,
    sides,
    total: sumOf(buttons) + sumOf(sides),
    worst: ISSUE_ORDER.find(status => buttons[status] > 0 || sides[status] > 0) ?? null,
  }
}

const SIDE_ISSUE_TEXT: Record<IssueStatus, string> = {
  broken: 'down',
  unreliable: 'acting up',
  pending: 'pending',
}

export function issueText(summary: IssueSummary): string {
  const sides = ISSUE_ORDER.filter(status => summary.sides[status] > 0).map(status => {
    const count = summary.sides[status]
    return `${count} ${count === 1 ? 'side' : 'sides'} ${SIDE_ISSUE_TEXT[status]}`
  })
  const buttonTotal = sumOf(summary)
  const buttons = ISSUE_ORDER.filter(status => summary[status] > 0).map(
    status => `${summary[status]} ${status}`
  )
  const buttonText =
    buttonTotal > 0 ? [`${buttons.join(', ')} ${buttonTotal === 1 ? 'button' : 'buttons'}`] : []
  return [...sides, ...buttonText].join(', ')
}

const DAY_MS = 86_400_000

export const AGREE_PEOPLE = 2
export const VOTE_TTL_MS = 7 * DAY_MS

export type ButtonVote = { reporter: string; kind: ReportKind; at: Date }

export type ButtonVerdict = {
  status: ButtonStatus
  confirmed: ConfirmedStatus
  pending: ReportKind | null
  pendingVotes: number
}

type Vote = { reporter: string; kind: ReportKind; at: number }
type Backing = { count: number; newest: number }
type Tally = Map<ReportKind, Backing>

const SEVERITY: Record<ReportKind, number> = { works: 0, unreliable: 1, broken: 2 }

function compareVotes(a: Vote, b: Vote): number {
  if (a.at !== b.at) return a.at - b.at
  if (a.reporter !== b.reporter) return a.reporter < b.reporter ? -1 : 1
  return SEVERITY[a.kind] - SEVERITY[b.kind]
}

function eventTimes(votes: readonly Vote[], end: number): number[] {
  const times = new Set<number>()
  for (const vote of votes) {
    times.add(vote.at)
    if (vote.at + VOTE_TTL_MS <= end) times.add(vote.at + VOTE_TTL_MS)
  }
  return [...times].toSorted((a, b) => a - b)
}

function tallyAt(votes: readonly Vote[], since: number, t: number): Tally {
  const current = new Map<string, Vote>()
  for (const vote of votes) {
    if (vote.at > t) break
    current.set(vote.reporter, vote)
  }
  const tally: Tally = new Map()
  for (const vote of current.values()) {
    if (vote.at <= since || vote.at <= t - VOTE_TTL_MS) continue
    const backing = tally.get(vote.kind) ?? { count: 0, newest: vote.at }
    tally.set(vote.kind, { count: backing.count + 1, newest: Math.max(backing.newest, vote.at) })
  }
  return tally
}

function outranks(kind: ReportKind, backing: Backing, other: ReportKind, rival: Backing): boolean {
  if (backing.count !== rival.count) return backing.count > rival.count
  if (backing.newest !== rival.newest) return backing.newest > rival.newest
  return SEVERITY[kind] > SEVERITY[other]
}

function leader(tally: Tally, confirmed: ReportKind, minimum: number): ReportKind | null {
  const floor = tally.get(confirmed)?.count ?? 0
  let best: { kind: ReportKind; backing: Backing } | null = null
  for (const kind of REPORT_KINDS) {
    const backing = tally.get(kind)
    if (kind === confirmed || !backing || backing.count < minimum || backing.count <= floor)
      continue
    if (!best || outranks(kind, backing, best.kind, best.backing)) best = { kind, backing }
  }
  return best?.kind ?? null
}

function dissenter(tally: Tally, confirmed: ReportKind): ReportKind | null {
  let best: { kind: ReportKind; backing: Backing } | null = null
  for (const kind of REPORT_KINDS) {
    const backing = tally.get(kind)
    if (kind === confirmed || !backing) continue
    if (!best || outranks(kind, backing, best.kind, best.backing)) best = { kind, backing }
  }
  return best?.kind ?? null
}

export function buttonVerdict(votes: readonly ButtonVote[], now: Date): ButtonVerdict {
  const end = now.getTime()
  const sorted = votes
    .map(vote => ({ reporter: vote.reporter, kind: vote.kind, at: vote.at.getTime() }))
    .filter(vote => vote.at <= end)
    .toSorted(compareVotes)

  let confirmed: ReportKind = 'works'
  let since = Number.NEGATIVE_INFINITY
  for (const t of eventTimes(sorted, end)) {
    const next = leader(tallyAt(sorted, since, t), confirmed, AGREE_PEOPLE)
    if (next) {
      confirmed = next
      since = t
    }
  }

  const tally = tallyAt(sorted, since, end)
  const pending = dissenter(tally, confirmed)
  return {
    status: pending ? 'pending' : statusOfKind(confirmed),
    confirmed: statusOfKind(confirmed),
    pending,
    pendingVotes: pending ? (tally.get(pending)?.count ?? 0) : 0,
  }
}
