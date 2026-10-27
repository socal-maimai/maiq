import { describe, expect, test } from 'bun:test'
import {
  ARCADES,
  arcadeOfLine,
  arcadesIn,
  resolveArcade,
  searchArcades,
  findArcade,
  findLine,
  LINE_IDS,
  LINES,
  lineName,
  nearestArcade,
  pickLine,
  soleLine,
  sortByDistance,
  sortByRecent,
} from '@maiq/core/arcades'
import { checkCount, MAX_PLAYERS_PER_LINE, MAX_QUEUE, maxPlayers } from '@maiq/core/caps'
import { distanceMeters } from '@maiq/core/geo'
import { arcade, line } from 'maiq-tests-core/support/lookup'

describe('arcade data', () => {
  test('has 27 arcades with unique ids, 15 in SoCal and 12 in NorCal', () => {
    expect(ARCADES).toHaveLength(27)
    expect(new Set(ARCADES.map(a => a.id)).size).toBe(27)
    expect(arcadesIn('socal')).toHaveLength(15)
    expect(arcadesIn('norcal')).toHaveLength(12)
  })

  test('puts every arcade in the region its location belongs to', () => {
    const sacramento = { lat: 38.58, lng: -121.49 }
    const losAngeles = { lat: 34.05, lng: -118.24 }
    for (const a of ARCADES) {
      const north = a.location.lat > 35.8
      expect({ id: a.id, region: a.region }).toEqual({
        id: a.id,
        region: north ? 'norcal' : 'socal',
      })
    }
    expect(nearestArcade(sacramento).region).toBe('norcal')
    expect(nearestArcade(losAngeles).region).toBe('socal')
  })

  test('lists hours for every SoCal arcade and none in NorCal yet', () => {
    expect(arcadesIn('socal').filter(a => !a.hours)).toEqual([])
    expect(arcadesIn('norcal').filter(a => a.hours)).toEqual([])
  })

  test('marks only the off-network arcades as unofficial', () => {
    expect(ARCADES.filter(a => a.unofficial).map(a => a.id)).toEqual([
      'factory-tea-bar',
      'hazes-toys',
    ])
  })

  test('has unique line ids that point back at their arcade', () => {
    expect(new Set(LINE_IDS).size).toBe(LINES.length)
    for (const l of LINES) expect(arcadeOfLine(l).lines).toContain(l)
  })

  test('every line has at least one cab', () => {
    for (const l of LINES) expect(l.cabs).toBeGreaterThanOrEqual(1)
  })

  test('Lakewood has a main line and the Cuck cab', () => {
    expect(findArcade('lakewood')?.lines.map(l => [l.id, l.label, l.cabs])).toEqual([
      ['lakewood:main', 'Main cabs', 2],
      ['lakewood:cuck', 'Cuck cab', 1],
    ])
  })

  test('single-line arcades use the arcade id as the line id', () => {
    expect(line('burbank')).toEqual({
      id: 'burbank',
      arcadeId: 'burbank',
      label: null,
      cabs: 3,
      keywords: [],
    })
  })

  test('names lines with their label', () => {
    expect(lineName(line('burbank'))).toBe('Round1 Burbank')
    expect(lineName(line('lakewood:cuck'))).toBe('Round1 Lakewood (Cuck cab)')
  })

  test('returns undefined for unknown ids', () => {
    expect(findLine('nope')).toBeUndefined()
    expect(findArcade('nope')).toBeUndefined()
  })
})

describe('pickLine', () => {
  const lakewoodLines = findArcade('lakewood')?.lines ?? []

  test.each([
    ['main 2p1q', 'lakewood:main'],
    ['CUCK 1p0q', 'lakewood:cuck'],
  ])('picks the line named in %p', (text, id) => {
    expect(pickLine(lakewoodLines, text)?.id).toBe(id)
  })

  test.each(['2p1q', 'main and cuck 2p1q', 'domain 2p1q', 'cucked 2p1q'])(
    'returns null for %p',
    text => {
      expect(pickLine(lakewoodLines, text)).toBeNull()
    }
  )

  test('every line except Lakewood has no keywords', () => {
    for (const l of LINES) {
      if (l.arcadeId === 'lakewood') continue
      expect(l.keywords).toEqual([])
    }
  })
})

describe('soleLine', () => {
  test('is the only line of a one-line arcade', () => {
    expect(soleLine(arcade('burbank'))).toBe(line('burbank'))
  })

  test('is undefined when the arcade has several lines', () => {
    expect(soleLine(arcade('lakewood'))).toBeUndefined()
  })
})

describe('ordering', () => {
  test('nearestArcade finds the arcade at a given location', () => {
    const lakewood = findArcade('lakewood')
    if (!lakewood) throw new Error('test setup: no lakewood')
    expect(nearestArcade(lakewood.location).id).toBe('lakewood')
  })

  test('sortByDistance is ascending from the origin', () => {
    const origin = { lat: 33.8358, lng: -118.3406 }
    const sorted = sortByDistance(origin)
    const distances = sorted.map(a => distanceMeters(origin, a.location))
    expect(distances).toEqual(distances.toSorted((a, b) => a - b))
    expect(sorted).toHaveLength(ARCADES.length)
  })

  test('sortByRecent puts recent arcades first, then the rest by name', () => {
    const sorted = sortByRecent(
      new Map([
        ['temecula', 1000],
        ['burbank', 5000],
      ])
    )
    expect(sorted.slice(0, 2).map(a => a.id)).toEqual(['burbank', 'temecula'])
    const rest = sorted.slice(2).map(a => a.name)
    expect(rest).toEqual(rest.toSorted((a, b) => a.localeCompare(b)))
  })
})

describe('caps', () => {
  test('each cab seats two players', () => {
    expect(maxPlayers(line('2nd-loop'))).toBe(2)
    expect(maxPlayers(line('puente-hills'))).toBe(8)
    expect(MAX_PLAYERS_PER_LINE).toBe(8)
  })

  test('checkCount flags too many players or too long a queue', () => {
    expect(checkCount(line('2nd-loop'), { players: 2, queue: 40 })).toBeNull()
    expect(checkCount(line('2nd-loop'), { players: 3, queue: 0 })).toBe('playersOverCap')
    expect(checkCount(line('2nd-loop'), { players: 0, queue: MAX_QUEUE + 1 })).toBe('queueOverCap')
  })
})

describe('searchArcades', () => {
  test('matches every word against name, city and id', () => {
    expect(searchArcades('round1 san jose').map(a => a.id)).toEqual(['eastridge'])
    expect(searchArcades('golfland').map(a => a.id)).toEqual([
      'camelot-golfland',
      'roseville-golfland',
      'fairfield-golfland',
    ])
  })

  test('ignores case and punctuation', () => {
    expect(searchArcades("HAZE'S").map(a => a.id)).toEqual(['hazes-toys'])
  })

  test('returns nothing for an unknown arcade', () => {
    expect(searchArcades('dance dance')).toEqual([])
  })
})

describe('resolveArcade', () => {
  test('accepts an id, an exact name or a unique partial match', () => {
    expect(resolveArcade('burbank')?.id).toBe('burbank')
    expect(resolveArcade('round1 stonestown')?.id).toBe('stonestown')
    expect(resolveArcade('turlock')?.id).toBe('ten-pin-turlock')
  })

  test('refuses a partial match that fits several arcades', () => {
    expect(resolveArcade('kiddleton')).toBeUndefined()
  })
})
