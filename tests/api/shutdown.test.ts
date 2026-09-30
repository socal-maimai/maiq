import { describe, expect, test } from 'bun:test'
import pino from 'pino'
import { shutdown } from '@maiq/api/lib/shutdown'

function recordingParts(options: { flush?: () => Promise<void>; bot?: boolean } = {}) {
  const steps: string[] = []
  const record = (step: string) => () => {
    steps.push(step)
    return Promise.resolve()
  }
  const bot = {
    disconnect: () => {
      steps.push('gateway disconnect')
    },
    publisher: { flush: options.flush ?? record('publisher flush') },
  }
  const parts = {
    server: { stop: (force: boolean) => record(`server stop force=${String(force)}`)() },
    bot: options.bot === false ? null : bot,
    database: { end: record('database end') },
    logger: pino({ level: 'silent' }),
    flushDeadlineMs: 20,
  }
  return { steps, parts }
}

describe('shutdown', () => {
  test('stops HTTP, the gateway, status edits, then the database, in that order', async () => {
    const { steps, parts } = recordingParts()
    await shutdown(parts)
    expect(steps).toEqual([
      'server stop force=true',
      'gateway disconnect',
      'publisher flush',
      'database end',
    ])
  })

  test('closes the database when a status flush outlives the deadline', async () => {
    const { steps, parts } = recordingParts({ flush: () => new Promise<void>(() => {}) })
    await shutdown(parts)
    expect(steps).toEqual(['server stop force=true', 'gateway disconnect', 'database end'])
  })

  test('closes the database without a bot', async () => {
    const { steps, parts } = recordingParts({ bot: false })
    await shutdown(parts)
    expect(steps).toEqual(['server stop force=true', 'database end'])
  })
})
