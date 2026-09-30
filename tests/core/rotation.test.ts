import { describe, expect, test } from 'bun:test'
import { assert, boolean, constant, integer, property, tuple } from 'fast-check'
import { findLine } from '@maiq/core/arcades'
import { playableSeats, rotation } from '@maiq/core/rotation'

describe('rotation', () => {
  test.each([
    [0, 0, 1, false, 'Free cab now', 'go'],
    [1, 0, 1, false, 'Free seat now', 'go'],
    [2, 0, 1, false, 'With you: play 1–2, wait 1', 'go'],
    [2, 0, 1, true, 'No wait', 'go'],
    [1, 1, 1, true, 'No wait', 'go'],
    [2, 1, 1, true, 'Play 1–2, wait 1', 'go'],
    [2, 1, 1, false, 'With you: play 1, wait 1', 'go'],
    [2, 2, 1, true, 'Play 1, wait 1', 'go'],
    [2, 2, 1, false, 'With you: play 1, wait 1–2', 'soon'],
    [2, 3, 1, true, 'Play 1, wait 1–2', 'soon'],
    [1, 3, 1, true, 'Play 1, wait 1–3', 'soon'],
    [2, 6, 1, true, 'Play 1, wait 3', 'long'],
    [0, 0, 2, false, 'Free cab now', 'go'],
    [2, 0, 2, false, 'Free cab now', 'go'],
    [3, 0, 2, false, 'Free seat now', 'go'],
    [4, 0, 2, false, 'With you: play 1, wait 0–1', 'go'],
    [4, 1, 2, true, 'Play 1, wait 0–1', 'go'],
    [4, 2, 2, true, 'Play 1–2, wait 1', 'go'],
    [4, 4, 2, true, 'Play 1, wait 1', 'go'],
    [4, 5, 2, true, 'Play 1, wait 1–2', 'soon'],
    [2, 3, 2, true, 'Play 1, wait 0–2', 'soon'],
    [6, 0, 3, false, 'With you: play 1, wait 0–1', 'go'],
    [6, 3, 3, true, 'Play 1–2, wait 1', 'go'],
    [8, 0, 4, false, 'With you: play 1, wait 0–1', 'go'],
    [8, 8, 4, true, 'Play 1, wait 1', 'go'],
    [8, 12, 4, true, 'Play 1, wait 1–2', 'soon'],
  ] as const)('%pp%pq on %p cab(s), at arcade %p: %p', (p, q, cabs, atArcade, text, tier) => {
    const result = rotation(p, q, 2 * cabs, atArcade)
    expect(result.text).toBe(text)
    expect(result.tier).toBe(tier)
    expect(result.withYou).toBe(text.startsWith('With you'))
    expect(result.short).toBe(
      text.replace(/^With you: (.)/, (_, first: string) => first.toUpperCase())
    )
  })

  const TEXT_SHAPE =
    /^(With you: )?(Free (cab|seat) now|No wait|[Pp]lay \d+(–\d+)?, wait \d+(–\d+)?)$/

  test('always produces a well-formed text with ascending ranges', () => {
    assert(
      property(
        integer({ min: 1, max: 4 }).chain(cabs =>
          tuple(
            constant(cabs),
            integer({ min: 0, max: 2 * cabs }),
            integer({ min: 0, max: 40 }),
            boolean()
          )
        ),
        ([cabs, players, queue, atArcade]) => {
          const { text } = rotation(players, queue, 2 * cabs, atArcade)
          expect(text).toMatch(TEXT_SHAPE)
          for (const [, low, high] of text.matchAll(/(\d+)–(\d+)/g)) {
            expect(Number(low)).toBeLessThan(Number(high))
          }
        }
      )
    )
  })

  test('never says "With you" for someone already at the arcade', () => {
    assert(
      property(integer({ min: 0, max: 8 }), integer({ min: 0, max: 40 }), (p, q) => {
        expect(rotation(p, q, 8, true).withYou).toBe(false)
      })
    )
  })

  test.each([
    [1, 0, false, 'Free cab now', 'go'],
    [2, 0, false, 'Free seat now', 'go'],
    [3, 0, false, 'With you: play 1, wait 0–1', 'go'],
    [3, 0, true, 'No wait', 'go'],
    [3, 3, true, 'Play 1, wait 1', 'go'],
    [3, 4, true, 'Play 1, wait 1–2', 'soon'],
    [1, 4, true, 'Play 1, wait 1–2', 'soon'],
  ] as const)('%pp%pq on 3 seats, at arcade %p: %p', (p, q, atArcade, text, tier) => {
    const result = rotation(p, q, 3, atArcade)
    expect(result.text).toBe(text)
    expect(result.tier).toBe(tier)
  })

  test.each([
    [0, 0, false],
    [2, 3, true],
    [0, 5, false],
  ])('%pp%pq with no playable seats, at arcade %p', (p, q, atArcade) => {
    expect(rotation(p, q, 0, atArcade)).toEqual({
      text: 'No playable cabs',
      short: 'No playable cabs',
      tier: 'long',
      withYou: false,
    })
  })
})

describe('playableSeats', () => {
  const burbank = findLine('burbank')
  if (!burbank) throw new Error('test setup: no line burbank')

  test('is two per cab minus the down sides', () => {
    expect(playableSeats(burbank, 0)).toBe(6)
    expect(playableSeats(burbank, 1)).toBe(5)
    expect(playableSeats(burbank, 6)).toBe(0)
  })

  test('never goes below zero', () => {
    expect(playableSeats(burbank, 9)).toBe(0)
  })
})
