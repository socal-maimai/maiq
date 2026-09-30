import { describe, expect, test } from 'bun:test'
import {
  buttonKey,
  cabinetsOf,
  checkDescription,
  downSides,
  isButtonOf,
  isStation,
  issueText,
  type IssueInput,
  KIND_LABEL,
  MAX_CABS_PER_LINE,
  needsDescription,
  STATION,
  stationKindLabel,
  stationStatusLabel,
  STATUS_LABEL,
  statusOfKind,
  summarizeIssues,
} from '@maiq/core/buttons'
import { arcade, line } from 'maiq-tests-core/support/lookup'

describe('cabinetsOf', () => {
  test('numbers the cabs of an unlabeled line', () => {
    expect(cabinetsOf(arcade('burbank')).map(c => c.label)).toEqual(['Cab 1', 'Cab 2', 'Cab 3'])
  })

  test('calls a lone cab just Cab', () => {
    expect(cabinetsOf(arcade('2nd-loop'))).toEqual([
      { line: line('2nd-loop'), cab: 1, label: 'Cab' },
    ])
  })

  test('names cabs after their line, in line order', () => {
    expect(cabinetsOf(arcade('lakewood')).map(c => [c.line.id, c.cab, c.label])).toEqual([
      ['lakewood:main', 1, 'Main cab 1'],
      ['lakewood:main', 2, 'Main cab 2'],
      ['lakewood:cuck', 1, 'Cuck cab'],
    ])
  })
})

describe('isButtonOf', () => {
  test('accepts the corners of the range', () => {
    expect(isButtonOf(line('burbank'), { cab: 1, side: 1, button: 1 })).toBe(true)
    expect(isButtonOf(line('burbank'), { cab: 3, side: 2, button: 8 })).toBe(true)
  })

  test('accepts button 0, the side itself', () => {
    expect(STATION).toBe(0)
    expect(isButtonOf(line('burbank'), { cab: 2, side: 2, button: STATION })).toBe(true)
  })

  test.each([
    { cab: 0, side: 1, button: 1 },
    { cab: 4, side: 1, button: 1 },
    { cab: 1, side: 0, button: 1 },
    { cab: 1, side: 3, button: 1 },
    { cab: 1, side: 1, button: -1 },
    { cab: 1, side: 1, button: 0.5 },
    { cab: 1, side: 1, button: 9 },
    { cab: 1.5, side: 1, button: 1 },
  ])('rejects %p on a 3-cab line', ref => {
    expect(isButtonOf(line('burbank'), ref)).toBe(false)
  })

  test('knows the largest line', () => {
    expect(MAX_CABS_PER_LINE).toBe(4)
  })
})

describe('isStation', () => {
  test('is true only for button 0', () => {
    expect(isStation({ button: 0 })).toBe(true)
    expect(isStation({ button: 1 })).toBe(false)
  })
})

describe('side labels', () => {
  test('read as the side being up or down', () => {
    expect(stationKindLabel).toEqual({ works: 'Working', unreliable: 'Acting up', broken: 'Down' })
    expect(stationStatusLabel).toEqual({
      good: 'Working',
      unreliable: 'Acting up',
      broken: 'Down',
      pending: 'Pending',
    })
  })

  test('leave the button labels alone', () => {
    expect(KIND_LABEL.broken).toBe('Broken')
    expect(STATUS_LABEL.good).toBe('Good')
  })
})

const state = (lineId: string, button: number, confirmed: 'good' | 'unreliable' | 'broken') => ({
  lineId,
  button,
  confirmed,
})

describe('downSides', () => {
  test('counts confirmed broken sides of one line', () => {
    const states = [
      state('lakewood:main', STATION, 'broken'),
      state('lakewood:main', STATION, 'broken'),
      state('lakewood:main', STATION, 'unreliable'),
      state('lakewood:main', STATION, 'good'),
      state('lakewood:main', 3, 'broken'),
      state('lakewood:cuck', STATION, 'broken'),
    ]
    expect(downSides(states, 'lakewood:main')).toBe(2)
    expect(downSides(states, 'lakewood:cuck')).toBe(1)
    expect(downSides(states, 'burbank')).toBe(0)
  })
})

describe('buttonKey', () => {
  test('joins the parts with slashes', () => {
    expect(buttonKey({ lineId: 'lakewood:main', cab: 2, side: 1, button: 7 })).toBe(
      'lakewood:main/2/1/7'
    )
  })
})

describe('descriptions', () => {
  test('only problems need one', () => {
    expect(needsDescription('works')).toBe(false)
    expect(needsDescription('unreliable')).toBe(true)
    expect(needsDescription('broken')).toBe(true)
  })

  test('trims before checking', () => {
    expect(checkDescription('broken', '  dead  ')).toEqual({ ok: true, description: 'dead' })
    expect(checkDescription('broken', '   ')).toEqual({ ok: false, problem: 'required' })
    expect(checkDescription('works', '   ')).toEqual({ ok: true, description: '' })
  })

  test('allows 280 characters and no more', () => {
    expect(checkDescription('unreliable', 'a'.repeat(280)).ok).toBe(true)
    expect(checkDescription('unreliable', ` ${'a'.repeat(280)} `).ok).toBe(true)
    expect(checkDescription('works', 'a'.repeat(281))).toEqual({ ok: false, problem: 'tooLong' })
  })
})

describe('statusOfKind', () => {
  test('maps works to good', () => {
    expect(statusOfKind('works')).toBe('good')
    expect(statusOfKind('broken')).toBe('broken')
  })
})

const button = (issue: IssueInput) => ({ ...issue, button: 3 })
const side = (issue: IssueInput) => ({ ...issue, button: STATION })

describe('summarizeIssues', () => {
  const good: IssueInput = { confirmed: 'good', status: 'good' }
  const pending: IssueInput = { confirmed: 'good', status: 'pending' }
  const unreliable: IssueInput = { confirmed: 'unreliable', status: 'unreliable' }
  const broken: IssueInput = { confirmed: 'broken', status: 'broken' }
  const none = { broken: 0, unreliable: 0, pending: 0 }

  test('counts everything that is not good and names the worst', () => {
    const summary = summarizeIssues([good, pending, unreliable, pending, good].map(button))
    expect(summary).toEqual({
      broken: 0,
      unreliable: 1,
      pending: 2,
      sides: none,
      total: 3,
      worst: 'unreliable',
    })
    expect(issueText(summary)).toBe('1 unreliable, 2 pending buttons')
  })

  test('broken beats everything', () => {
    expect(summarizeIssues([pending, broken, unreliable].map(button)).worst).toBe('broken')
    expect(issueText(summarizeIssues([button(broken)]))).toBe('1 broken button')
  })

  test('has no worst when all is well', () => {
    expect(summarizeIssues([button(good), side(good)])).toEqual({
      broken: 0,
      unreliable: 0,
      pending: 0,
      sides: none,
      total: 0,
      worst: null,
    })
  })

  test('a confirmed problem counts as itself while a dissenting vote shows it pending', () => {
    const brokenWithDissent: IssueInput = { confirmed: 'broken', status: 'pending' }
    const unreliableWithDissent: IssueInput = { confirmed: 'unreliable', status: 'pending' }
    const summary = summarizeIssues(
      [brokenWithDissent, unreliableWithDissent, pending].flatMap(issue => [
        button(issue),
        side(issue),
      ])
    )
    expect(summary).toEqual({
      broken: 1,
      unreliable: 1,
      pending: 1,
      sides: { broken: 1, unreliable: 1, pending: 1 },
      total: 6,
      worst: 'broken',
    })
  })

  test('counts sides apart from buttons and names them first', () => {
    const summary = summarizeIssues([side(broken), button(broken), button(broken), button(good)])
    expect(summary).toEqual({
      broken: 2,
      unreliable: 0,
      pending: 0,
      sides: { broken: 1, unreliable: 0, pending: 0 },
      total: 3,
      worst: 'broken',
    })
    expect(issueText(summary)).toBe('1 side down, 2 broken buttons')
  })

  test('a side alone sets the worst', () => {
    const summary = summarizeIssues([side(broken), side(broken), button(pending)])
    expect(summary.worst).toBe('broken')
    expect(issueText(summarizeIssues([side(broken), side(broken)]))).toBe('2 sides down')
  })

  test('reads acting up and pending sides', () => {
    expect(issueText(summarizeIssues([side(unreliable), button(pending)]))).toBe(
      '1 side acting up, 1 pending button'
    )
    expect(issueText(summarizeIssues([side(broken), side(unreliable), side(pending)]))).toBe(
      '1 side down, 1 side acting up, 1 side pending'
    )
  })
})
