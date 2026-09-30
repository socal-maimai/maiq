import { describe, expect, test } from 'bun:test'
import { assert, integer, property, string } from 'fast-check'
import { COUNT_HINT, findCount, formatCount, parseCount } from '@maiq/core/count'

describe('parseCount', () => {
  test.each([
    ['4p2q', 4, 2],
    ['0p0q', 0, 0],
    ['4P2Q', 4, 2],
    [' 4p 2q ', 4, 2],
    ['12p40q', 12, 40],
  ])('parses %p', (input, players, queue) => {
    expect(parseCount(input)).toEqual({ ok: true, count: { players, queue } })
  })

  test.each(['', '4p', 'p2q', '4q2p', '100p0q', '-1p0q', '4p2q3', 'four p two q', '4.5p1q'])(
    'rejects %p with the hint',
    input => {
      expect(parseCount(input)).toEqual({ ok: false, reason: COUNT_HINT })
    }
  )

  test('round-trips every two-digit count', () => {
    assert(
      property(integer({ min: 0, max: 99 }), integer({ min: 0, max: 99 }), (p, q) => {
        const count = { players: p, queue: q }
        expect(parseCount(formatCount(count))).toEqual({ ok: true, count })
      })
    )
  })

  test('never throws on arbitrary input', () => {
    assert(
      property(string(), input => {
        parseCount(input)
      })
    )
  })
})

describe('formatCount', () => {
  test('writes the community notation', () => {
    expect(formatCount({ players: 4, queue: 2 })).toBe('4p2q')
  })
})

describe('findCount', () => {
  test.each([
    ['3p2q', 3, 2],
    ['3P2Q', 3, 2],
    ['3p 2q', 3, 2],
    ['3 p 2 q', 3, 2],
    ['0p0q', 0, 0],
    ['just got here, 3p2q rn', 3, 2],
    ['3p2q!', 3, 2],
    ['(3p2q)', 3, 2],
  ])('finds %p', (input, players, queue) => {
    expect(findCount(input)).toEqual({ players, queue })
  })

  test.each(['was 4p3q now 2p1q', '2pq', 'p2q', '123p1q', '2p100q', '2p1qq', 'a2p1q', 'hello', ''])(
    'finds nothing in %p',
    input => {
      expect(findCount(input)).toBeNull()
    }
  )
})
