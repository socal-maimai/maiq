import { describe, expect, test } from 'bun:test'
import { retryText } from '@maiq/core/retry'

describe('retryText', () => {
  test.each([
    [-5, 'Try again in 1s.'],
    [0, 'Try again in 1s.'],
    [1, 'Try again in 1s.'],
    [1000, 'Try again in 1s.'],
    [1001, 'Try again in 2s.'],
    [59_000, 'Try again in 59s.'],
    [59_001, 'Try again in 1 min.'],
    [60_000, 'Try again in 1 min.'],
    [60_001, 'Try again in 2 min.'],
    [10 * 60_000, 'Try again in 10 min.'],
  ])('%p ms reads %p', (ms, text) => {
    expect(retryText(ms)).toBe(text)
  })
})
