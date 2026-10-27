import { describe, expect, test } from 'bun:test'
import { formatHours, hours, openState } from '@maiq/core/hours'
import { arcade } from 'maiq-tests-core/support/lookup'

const hoursOf = (id: string) => {
  const found = arcade(id).hours
  if (!found) throw new Error(`test setup: ${id} has no hours`)
  return found
}

const at = (iso: string) => new Date(iso)

describe('openState', () => {
  test.each([
    [
      'the Saturday before spring forward, 10:30 PST',
      '2026-03-07T18:30:00Z',
      '2026-03-08T07:00:00Z',
    ],
    ['the Sunday of spring forward, 10:30 PDT', '2026-03-08T17:30:00Z', '2026-03-09T06:00:00Z'],
    ['the Saturday before fall back, 10:30 PDT', '2026-10-31T17:30:00Z', '2026-11-01T06:00:00Z'],
    ['the Sunday of fall back, 10:30 PST', '2026-11-01T18:30:00Z', '2026-11-02T07:00:00Z'],
  ])('a 10:00 opener is open on %s', (_, now, closesAt) => {
    expect(openState(hoursOf('mission-viejo'), at(now))).toEqual({
      open: true,
      closesAt: at(closesAt),
    })
  })

  test.each([
    ['spring forward', '2026-03-08T08:30:00Z', '2026-03-08T17:00:00Z'],
    ['fall back', '2026-11-01T07:30:00Z', '2026-11-01T18:00:00Z'],
  ])('finds 10:00 local across %s', (_, now, opensAt) => {
    expect(openState(hoursOf('mission-viejo'), at(now))).toEqual({
      open: false,
      opensAt: at(opensAt),
    })
  })

  test("keeps Saturday's window open at 01:30 Sunday when the clocks spring forward", () => {
    expect(openState(hoursOf('burbank'), at('2026-03-08T09:30:00Z'))).toEqual({
      open: true,
      closesAt: at('2026-03-08T10:00:00Z'),
    })
  })

  test('puts a boundary inside the spring-forward gap at the 03:00 jump', () => {
    const spring = at('2026-03-08T09:30:00Z')
    expect(openState(hours({ sat: '10:00-26:30' }), spring)).toEqual({
      open: true,
      closesAt: at('2026-03-08T10:00:00Z'),
    })
    expect(openState(hours({ sun: '02:30-05:00' }), spring)).toEqual({
      open: false,
      opensAt: at('2026-03-08T10:00:00Z'),
    })
    expect(openState(hours({ sun: '02:30-05:00' }), at('2026-03-08T10:00:00Z')).open).toBe(true)
  })

  test.each(['2026-11-01T08:30:00Z', '2026-11-01T09:30:00Z'])(
    "keeps Saturday's window open at both 01:30s when the clocks fall back (%p)",
    now => {
      expect(openState(hoursOf('burbank'), at(now))).toEqual({
        open: true,
        closesAt: at('2026-11-01T10:00:00Z'),
      })
    }
  )

  test('skips closed days to the next opening', () => {
    const monday = at('2026-10-06T01:00:00Z')
    expect(openState(hoursOf('2nd-loop'), monday)).toEqual({
      open: false,
      opensAt: at('2026-10-08T00:00:00Z'),
    })
  })

  test('has no next opening when every day is closed', () => {
    expect(openState(hours({}), at('2026-10-06T01:00:00Z'))).toEqual({
      open: false,
      opensAt: null,
    })
  })
})

describe('hours', () => {
  test('rejects a malformed time', () => {
    expect(() => hours({ mon: '10-22' })).toThrow('Bad time "10" in arcade hours')
  })
})

describe('formatHours', () => {
  test('groups days across the end of the week', () => {
    expect(formatHours(hoursOf('lakewood'))).toEqual(['Sun–Thu 10 AM–12 AM', 'Fri–Sat 10 AM–1 AM'])
  })

  test('lists closed days', () => {
    expect(formatHours(hoursOf('2nd-loop'))).toEqual([
      'Mon–Tue closed',
      'Wed–Thu 5 PM–12 AM',
      'Fri–Sat 3 PM–1 AM',
      'Sun 3 PM–12 AM',
    ])
  })

  test('adds age rules after the days', () => {
    expect(formatHours(hoursOf('puente-hills'))).toEqual([
      'Every day 10 AM–2 AM',
      '18+ after 10 PM',
      '21+ after midnight',
    ])
  })

  test('shows minutes and the days an age rule applies to', () => {
    const late = hours({ 'mon-sun': '10:30-22:30' }, [{ minAge: 18, from: 21 * 60, days: [4, 5] }])
    expect(formatHours(late)).toEqual(['Every day 10:30 AM–10:30 PM', '18+ after 9 PM on Fri, Sat'])
  })
})
