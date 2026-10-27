type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

type DayHours = { open: number; close: number } | null

type WeeklyHours = readonly DayHours[]

type AgeRule = { minAge: 18 | 21; from: number; days?: readonly Weekday[] }

export type Hours = { week: WeeklyHours; ageRules: readonly AgeRule[] }

type OpenState = { open: true; closesAt: Date } | { open: false; opensAt: Date | null }

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
type Day = (typeof DAYS)[number]
type DayKey = Day | `${Day}-${Day}`

const MINUTE = 60_000
const DAY_MINUTES = 1440
const WEEK_MINUTES = 7 * DAY_MINUTES

function minutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!match) throw new Error(`Bad time "${time}" in arcade hours. Write it like 10:00 or 26:00.`)
  return Number(match[1]) * 60 + Number(match[2])
}

function daysIn(key: DayKey): Weekday[] {
  const [first = 'mon', last = first] = key.split('-') as Day[]
  const start = DAYS.indexOf(first)
  const length = ((DAYS.indexOf(last) - start + 7) % 7) + 1
  return Array.from({ length }, (_, i) => ((start + i) % 7) as Weekday)
}

/** Builds hours from day ranges like { 'sun-thu': '10:00-24:00' }. Missing days are closed. */
export function hours(
  ranges: Partial<Record<DayKey, string>>,
  ageRules: readonly AgeRule[] = []
): Hours {
  const week: DayHours[] = Array.from({ length: 7 }, () => null)
  for (const [key, range] of Object.entries(ranges)) {
    const [open = '', close = ''] = range.split('-')
    for (const day of daysIn(key as DayKey)) {
      week[day] = { open: minutes(open), close: minutes(close) }
    }
  }
  return { week, ageRules }
}

const losAngeles = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  weekday: 'short',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
})

function offsetMinutes(date: Date): number {
  const parts = Object.fromEntries(losAngeles.formatToParts(date).map(p => [p.type, p.value]))
  const local =
    DAY_NAMES.indexOf(parts['weekday'] as (typeof DAY_NAMES)[number]) * DAY_MINUTES +
    Number(parts['hour']) * 60 +
    Number(parts['minute'])
  const utc =
    ((date.getUTCDay() + 6) % 7) * DAY_MINUTES + date.getUTCHours() * 60 + date.getUTCMinutes()
  const diff = (local - utc + WEEK_MINUTES) % WEEK_MINUTES
  return diff > WEEK_MINUTES / 2 ? diff - WEEK_MINUTES : diff
}

/**
 * Turns a Los Angeles wall time (as epoch ms read as if it were UTC) into an instant. The first
 * guess uses the offset at `hint`; one pass with the guess's own offset fixes a DST change in
 * between. If the two offsets disagree, the wall time falls in the spring-forward gap (02:00 to
 * 03:00 does not exist), so return the moment the clock jumps: the gap's start hour read with the
 * earlier (smaller) offset. openState also treats a boundary inside the gap as reached at 03:00.
 */
function wallToDate(wall: number, hint: number): Date {
  const guess = wall - hint * MINUTE
  const guessOffset = offsetMinutes(new Date(guess))
  const fixed = wall - guessOffset * MINUTE
  const fixedOffset = offsetMinutes(new Date(fixed))
  if (fixedOffset === guessOffset) return new Date(fixed)
  const hour = 60 * MINUTE
  // ponytail: assumes the gap starts on the hour, true for Los Angeles (02:00)
  return new Date(Math.floor(wall / hour) * hour - Math.min(guessOffset, fixedOffset) * MINUTE)
}

export function openState(arcadeHours: Hours, now: Date): OpenState {
  const offset = offsetMinutes(now)
  const wallNow = now.getTime() + offset * MINUTE
  const midnight = Math.floor(wallNow / (DAY_MINUTES * MINUTE)) * DAY_MINUTES * MINUTE
  const today = (new Date(wallNow).getUTCDay() + 6) % 7
  const minute = (wallNow - midnight) / MINUTE
  const windows = Array.from({ length: 9 }, (_, i) => i - 1).flatMap(dayOffset => {
    const day = arcadeHours.week[(today + dayOffset + 7) % 7]
    const base = dayOffset * DAY_MINUTES
    return day ? [{ start: base + day.open, end: base + day.close }] : []
  })
  const at = (wallMinute: number) => wallToDate(midnight + wallMinute * MINUTE, offset)
  const current = windows.find(w => w.start <= minute && minute < w.end)
  if (current) return { open: true, closesAt: at(current.end) }
  const next = windows.find(w => w.start > minute)
  return { open: false, opensAt: next ? at(next.start) : null }
}

function timeText(wallMinute: number): string {
  const minute = wallMinute % DAY_MINUTES
  const hour = Math.floor(minute / 60)
  const mins = minute % 60
  const clock = `${hour % 12 || 12}${mins ? `:${String(mins).padStart(2, '0')}` : ''}`
  return `${clock} ${hour < 12 ? 'AM' : 'PM'}`
}

const sameHours = (a: DayHours, b: DayHours): boolean =>
  a === b || (a !== null && b !== null && a.open === b.open && a.close === b.close)

type DayGroup = { first: Weekday; last: Weekday; day: DayHours }

function dayGroups(week: WeeklyHours): DayGroup[] {
  const dayAt = (i: number): DayHours => week[(i + 7) % 7] ?? null
  let start = 0
  while (start > -6 && sameHours(dayAt(start - 1), dayAt(start))) start--
  const groups: DayGroup[] = []
  for (let i = start; i < start + 7; i++) {
    const index = ((i + 7) % 7) as Weekday
    const group = groups.at(-1)
    if (group && sameHours(group.day, dayAt(i))) group.last = index
    else groups.push({ first: index, last: index, day: dayAt(i) })
  }
  return groups
}

function ageText(rule: AgeRule): string {
  const from = rule.from % DAY_MINUTES === 0 ? 'midnight' : timeText(rule.from)
  const days = rule.days ? ` on ${rule.days.map(day => DAY_NAMES[day]).join(', ')}` : ''
  return `${rule.minAge}+ after ${from}${days}`
}

const daysText = (first: Weekday, last: Weekday): string =>
  first === last ? DAY_NAMES[first] : `${DAY_NAMES[first]}–${DAY_NAMES[last]}`

export function formatHours(arcadeHours: Hours): string[] {
  const groups = dayGroups(arcadeHours.week)
  const lines = groups.map(({ first, last, day }) => {
    const days = groups.length === 1 ? 'Every day' : daysText(first, last)
    return day ? `${days} ${timeText(day.open)}–${timeText(day.close)}` : `${days} closed`
  })
  return [...lines, ...arcadeHours.ageRules.map(ageText)]
}
