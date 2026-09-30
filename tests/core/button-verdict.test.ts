import { describe, expect, test } from 'bun:test'
import {
  array,
  assert,
  constantFrom,
  integer,
  property,
  record,
  shuffledSubarray,
} from 'fast-check'
import {
  buttonVerdict,
  REPORT_KINDS,
  statusOfKind,
  VOTE_TTL_MS,
  type ButtonVerdict,
  type ButtonVote,
  type ReportKind,
} from '@maiq/core/buttons'

const now = new Date('2026-10-02T03:00:00Z')
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const vote = (reporter: string, kind: ReportKind, ageMs: number): ButtonVote => ({
  reporter,
  kind,
  at: new Date(now.getTime() - ageMs),
})

const summary = (verdict: ButtonVerdict): string =>
  verdict.pending ? `pending:${verdict.confirmed}->${verdict.pending}` : verdict.status

describe('buttonVerdict', () => {
  test.each<[string, ButtonVote[], string]>([
    ['no reports', [], 'good'],
    ['one report', [vote('a', 'broken', HOUR)], 'pending:good->broken'],
    ['two people agree', [vote('a', 'broken', 2 * HOUR), vote('b', 'broken', HOUR)], 'broken'],
    [
      'one person twice counts once',
      [vote('a', 'broken', 2 * HOUR), vote('a', 'broken', HOUR)],
      'pending:good->broken',
    ],
    [
      'a newer report replaces the older one',
      [vote('a', 'broken', 2 * HOUR), vote('a', 'works', HOUR)],
      'good',
    ],
    [
      'one of each problem is pending on the newer',
      [vote('a', 'unreliable', 2 * HOUR), vote('b', 'broken', HOUR)],
      'pending:good->broken',
    ],
    [
      'fixing needs a second person',
      [vote('a', 'broken', 5 * HOUR), vote('b', 'broken', 4 * HOUR), vote('c', 'works', HOUR)],
      'pending:broken->works',
    ],
    [
      'two people fix it',
      [
        vote('a', 'broken', 5 * HOUR),
        vote('b', 'broken', 4 * HOUR),
        vote('c', 'works', 2 * HOUR),
        vote('d', 'works', HOUR),
      ],
      'good',
    ],
    [
      'a reaffirming vote leaves a dissenting one pending',
      [
        vote('a', 'broken', 5 * HOUR),
        vote('b', 'broken', 4 * HOUR),
        vote('c', 'broken', 3 * HOUR),
        vote('d', 'works', HOUR),
      ],
      'pending:broken->works',
    ],
    [
      'a confirmed status never expires',
      [vote('a', 'broken', 31 * DAY), vote('b', 'broken', 30 * DAY)],
      'broken',
    ],
    ['an unconfirmed report expires', [vote('a', 'broken', 10 * DAY)], 'good'],
    [
      'reports 9 days apart do not combine',
      [vote('a', 'broken', 10 * DAY), vote('b', 'broken', HOUR)],
      'pending:good->broken',
    ],
    [
      'escalates from unreliable to broken',
      [
        vote('a', 'unreliable', 9 * HOUR),
        vote('b', 'unreliable', 8 * HOUR),
        vote('c', 'broken', 2 * HOUR),
        vote('d', 'broken', HOUR),
      ],
      'broken',
    ],
    [
      'a vote a minute short of 7 days is live',
      [vote('a', 'broken', 7 * DAY - MINUTE)],
      'pending:good->broken',
    ],
    ['a vote exactly 7 days old has expired', [vote('a', 'broken', 7 * DAY)], 'good'],
    [
      'two against two does not confirm but is pending',
      [
        vote('a', 'works', 6 * DAY),
        vote('b', 'works', 5 * DAY),
        vote('c', 'broken', 4 * DAY),
        vote('d', 'broken', 3 * DAY),
      ],
      'pending:good->broken',
    ],
    [
      'simultaneous problems go to the more severe',
      [vote('a', 'unreliable', HOUR), vote('b', 'broken', HOUR)],
      'pending:good->broken',
    ],
    ['a vote from the future is ignored', [vote('a', 'broken', -HOUR)], 'good'],
  ])('%s', (_name, votes, expected) => {
    expect(summary(buttonVerdict(votes, now))).toBe(expected)
  })

  test('an expiring vote can break a tie', () => {
    const votes = [
      vote('a', 'works', 6 * DAY),
      vote('b', 'works', 5 * DAY),
      vote('c', 'broken', 4 * DAY),
      vote('d', 'broken', 3 * DAY),
    ]
    const dayLater = new Date(now.getTime() + DAY)
    expect(buttonVerdict(votes, dayLater)).toEqual({
      status: 'broken',
      confirmed: 'broken',
      pending: null,
      pendingVotes: 0,
    })
  })

  test('reports the pending vote count', () => {
    expect(buttonVerdict([vote('a', 'unreliable', HOUR)], now)).toEqual({
      status: 'pending',
      confirmed: 'good',
      pending: 'unreliable',
      pendingVotes: 1,
    })
  })

  test('a counter-vote does not cancel a live report', () => {
    const votes = [vote('a', 'broken', 2 * HOUR), vote('b', 'works', HOUR)]
    expect(buttonVerdict(votes, now)).toEqual({
      status: 'pending',
      confirmed: 'good',
      pending: 'broken',
      pendingVotes: 1,
    })
  })

  test('a newer dissent outranks an older one', () => {
    const votes = [
      vote('a', 'broken', 5 * HOUR),
      vote('b', 'broken', 4 * HOUR),
      vote('c', 'works', 3 * HOUR),
      vote('d', 'unreliable', 2 * HOUR),
    ]
    expect(buttonVerdict(votes, now)).toEqual({
      status: 'pending',
      confirmed: 'broken',
      pending: 'unreliable',
      pendingVotes: 1,
    })
  })

  test('a reaffirming vote does not cancel a dissenting one', () => {
    const votes = [
      vote('a', 'broken', 5 * HOUR),
      vote('b', 'broken', 4 * HOUR),
      vote('c', 'works', 3 * HOUR),
      vote('d', 'broken', 2 * HOUR),
    ]
    expect(buttonVerdict(votes, now)).toEqual({
      status: 'pending',
      confirmed: 'broken',
      pending: 'works',
      pendingVotes: 1,
    })
  })

  test('a lone reporter switching sides is pending', () => {
    const votes = [
      vote('a', 'broken', 3 * HOUR),
      vote('b', 'broken', 2 * HOUR),
      vote('a', 'works', HOUR),
    ]
    expect(buttonVerdict(votes, now)).toEqual({
      status: 'pending',
      confirmed: 'broken',
      pending: 'works',
      pendingVotes: 1,
    })
  })

  test('two votes just under 7 days apart both confirm', () => {
    const votes = [vote('a', 'broken', 7 * DAY - MINUTE), vote('b', 'broken', 0)]
    expect(buttonVerdict(votes, now)).toEqual({
      status: 'broken',
      confirmed: 'broken',
      pending: null,
      pendingVotes: 0,
    })
  })

  test('two votes exactly 7 days apart do not confirm', () => {
    const votes = [vote('a', 'broken', 7 * DAY), vote('b', 'broken', 0)]
    expect(buttonVerdict(votes, now)).toEqual({
      status: 'pending',
      confirmed: 'good',
      pending: 'broken',
      pendingVotes: 1,
    })
  })
})

const START = now.getTime() - 20 * DAY

const voteArbitrary = record({
  reporter: constantFrom('a', 'b', 'c', 'd'),
  kind: constantFrom(...REPORT_KINDS),
  minute: integer({ min: 0, max: 20 * 24 * 60 }),
}).map(({ reporter, kind, minute }) => ({
  reporter,
  kind,
  at: new Date(START + minute * MINUTE),
}))

const votesArbitrary = array(voteArbitrary, { maxLength: 12 })

describe('buttonVerdict properties', () => {
  test('does not depend on input order', () => {
    const pairs = votesArbitrary.chain(votes =>
      shuffledSubarray(votes, { minLength: votes.length }).map(shuffled => ({ votes, shuffled }))
    )
    assert(
      property(pairs, ({ votes, shuffled }) => {
        expect(buttonVerdict(shuffled, now)).toEqual(buttonVerdict(votes, now))
      })
    )
  })

  test('one person alone never confirms a problem', () => {
    assert(
      property(votesArbitrary, votes => {
        const alone = votes.map(v => ({ ...v, reporter: 'a' }))
        expect(buttonVerdict(alone, now).confirmed).toBe('good')
      })
    )
  })

  test('a pending kind never matches the confirmed status', () => {
    assert(
      property(votesArbitrary, votes => {
        const verdict = buttonVerdict(votes, now)
        if (verdict.pending) {
          expect(verdict.status).toBe('pending')
          expect(statusOfKind(verdict.pending)).not.toBe(verdict.confirmed)
          expect(verdict.pendingVotes).toBeGreaterThanOrEqual(1)
        } else {
          expect(verdict.status).toBe(verdict.confirmed)
          expect(verdict.pendingVotes).toBe(0)
        }
      })
    )
  })

  test('nothing is pending 7 days after the newest vote', () => {
    assert(
      property(votesArbitrary, votes => {
        const newest =
          votes.length === 0 ? now.getTime() : Math.max(...votes.map(v => v.at.getTime()))
        const later = new Date(newest + VOTE_TTL_MS)
        expect(buttonVerdict(votes, later).status).not.toBe('pending')
      })
    )
  })
})
