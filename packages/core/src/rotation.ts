import type { Line } from '@maiq/core/arcades'
import { maxPlayers } from '@maiq/core/caps'

export type WaitTier = 'go' | 'soon' | 'long'

export type Rotation = { text: string; short: string; tier: WaitTier; withYou: boolean }

type Range = { label: string; best: number; worst: number }

export const playableSeats = (line: Line, down: number): number =>
  Math.max(0, maxPlayers(line) - down)

function freeSeatText(players: number, seats: number): string | null {
  if (players <= seats - 2) return 'Free cab now'
  if (players < seats) return 'Free seat now'
  return null
}

function playWaitRange(players: number, queue: number, seats: number): Range {
  const people = players + queue
  if (people <= seats) return { label: 'No wait', best: 0, worst: 0 }

  const cabs = Math.ceil(seats / 2)
  const seatsInUse = Math.min(seats, Math.max(cabs, players))
  const best = (people - seats) / seats
  const worst = Math.ceil(people / seatsInUse) - 1

  if (best < 1) {
    const bestPlays = Math.floor(seats / (people - seats))
    if (bestPlays >= 3) return { label: `Play 1, wait 0–${worst}`, best, worst }
    if (worst === 1) {
      const playRange = bestPlays > 1 ? `1–${bestPlays}` : '1'
      return { label: `Play ${playRange}, wait 1`, best, worst }
    }
    return { label: `Play 1, wait 1–${worst}`, best, worst }
  }

  const low = Math.floor(best)
  const label = low === worst ? `Play 1, wait ${worst}` : `Play 1, wait ${low}–${worst}`
  return { label, best, worst }
}

const tierFor = ({ best, worst }: Range): WaitTier => {
  const middle = (best + worst) / 2
  if (middle <= 1) return 'go'
  return middle <= 2 ? 'soon' : 'long'
}

export function rotation(
  players: number,
  queue: number,
  seats: number,
  atArcade: boolean
): Rotation {
  if (seats <= 0) {
    const text = 'No playable cabs'
    return { text, short: text, tier: 'long', withYou: false }
  }
  if (!atArcade && queue === 0) {
    const free = freeSeatText(players, seats)
    if (free) return { text: free, short: free, tier: 'go', withYou: false }
  }
  const range = playWaitRange(players, atArcade ? queue : queue + 1, seats)
  const tier = tierFor(range)
  if (atArcade) return { text: range.label, short: range.label, tier, withYou: false }
  const label = range.label.replace(/^Play /, 'play ')
  return { text: `With you: ${label}`, short: range.label, tier, withYou: true }
}
