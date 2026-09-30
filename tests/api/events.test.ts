import { describe, expect, test } from 'bun:test'
import type { LineState } from '@maiq/core/state'
import { createEvents } from '@maiq/api/lib/events'

const state: LineState = {
  lineId: 'burbank',
  count: null,
  reportedAt: null,
  freshness: 'unknown',
  verified: false,
}

describe('createEvents', () => {
  test('delivers to subscribers until they unsubscribe', () => {
    const events = createEvents<LineState>(error => {
      throw error
    })
    const seen: string[] = []
    const unsubscribe = events.subscribe(s => seen.push(s.lineId))
    events.emit(state)
    unsubscribe()
    events.emit(state)
    expect(seen).toEqual(['burbank'])
  })

  test('reports a failing listener and still runs the others', () => {
    const errors: unknown[] = []
    const events = createEvents<LineState>(error => errors.push(error))
    const seen: string[] = []
    events.subscribe(() => {
      throw new Error('boom')
    })
    events.subscribe(s => seen.push(s.lineId))
    events.emit(state)
    expect(errors).toHaveLength(1)
    expect(seen).toEqual(['burbank'])
  })
})
