import { distanceMeters, type Point } from '@maiq/core/geo'

export type Line = {
  id: string
  arcadeId: string
  label: string | null
  cabs: number
  keywords: readonly string[]
}

export type Arcade = {
  id: string
  name: string
  city: string
  location: Point
  lines: readonly Line[]
}

function singleLine(id: string, name: string, city: string, location: Point, cabs: number): Arcade {
  return {
    id,
    name,
    city,
    location,
    lines: [{ id, arcadeId: id, label: null, cabs, keywords: [] }],
  }
}

export const ARCADES: readonly Arcade[] = [
  singleLine('burbank', 'Round1 Burbank', 'Burbank', { lat: 34.18401, lng: -118.311656 }, 3),
  {
    id: 'lakewood',
    name: 'Round1 Lakewood',
    city: 'Lakewood',
    location: { lat: 33.850428, lng: -118.138589 },
    lines: [
      {
        id: 'lakewood:main',
        arcadeId: 'lakewood',
        label: 'Main cabs',
        cabs: 2,
        keywords: ['main'],
      },
      { id: 'lakewood:cuck', arcadeId: 'lakewood', label: 'Cuck cab', cabs: 1, keywords: ['cuck'] },
    ],
  },
  singleLine(
    'main-place',
    'Round1 Main Place',
    'Santa Ana',
    { lat: 33.774196, lng: -117.869038 },
    2
  ),
  singleLine('temecula', 'Round1 Temecula', 'Temecula', { lat: 33.526131, lng: -117.153183 }, 2),
  singleLine(
    'puente-hills',
    'Round1 Puente Hills',
    'City of Industry',
    { lat: 33.993422, lng: -117.926751 },
    4
  ),
  singleLine(
    'mission-viejo',
    'Round1 Mission Viejo',
    'Mission Viejo',
    { lat: 33.558026, lng: -117.668901 },
    2
  ),
  singleLine(
    'moreno-valley',
    'Round1 Moreno Valley',
    'Moreno Valley',
    { lat: 33.93932, lng: -117.271209 },
    2
  ),
  singleLine(
    'plaza-bonita',
    'Round1 Plaza Bonita',
    'National City',
    { lat: 32.656907, lng: -117.065308 },
    4
  ),
  singleLine('2nd-loop', '2nd Loop', 'Gardena', { lat: 33.86268, lng: -118.309819 }, 1),
  singleLine(
    'kiddleton-sherman-oaks',
    'Kiddleton Sherman Oaks',
    'Sherman Oaks',
    { lat: 34.156973, lng: -118.437405 },
    1
  ),
  singleLine(
    'kiddleton-little-tokyo',
    'Kiddleton Little Tokyo',
    'Los Angeles',
    { lat: 34.049387, lng: -118.240725 },
    1
  ),
  singleLine(
    'camelot-golfland',
    'Camelot Golfland',
    'Anaheim',
    { lat: 33.850473, lng: -117.851619 },
    1
  ),
  singleLine(
    'lucky-strike-aliso-viejo',
    'Lucky Strike Aliso Viejo',
    'Aliso Viejo',
    { lat: 33.579378, lng: -117.723719 },
    1
  ),
  singleLine(
    'factory-tea-bar',
    'Factory Tea Bar',
    'San Gabriel',
    { lat: 34.097678, lng: -118.108958 },
    2
  ),
  singleLine(
    'pacific-view',
    'Round1 Pacific View',
    'Ventura',
    { lat: 34.268487, lng: -119.249725 },
    2
  ),
]

export const LINES: readonly Line[] = ARCADES.flatMap(arcade => arcade.lines)
export const LINE_IDS: readonly string[] = LINES.map(line => line.id)

const arcadesById = new Map(ARCADES.map(arcade => [arcade.id, arcade]))
const linesById = new Map(LINES.map(line => [line.id, line]))

export const findArcade = (id: string): Arcade | undefined => arcadesById.get(id)
export const findLine = (id: string): Line | undefined => linesById.get(id)

export function pickLine(lines: readonly Line[], text: string): Line | null {
  const words = new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u))
  const hits = lines.filter(line => line.keywords.some(keyword => words.has(keyword)))
  return hits.length === 1 ? (hits[0] ?? null) : null
}

export function arcadeOfLine(line: Line): Arcade {
  const arcade = arcadesById.get(line.arcadeId)
  if (!arcade) throw new Error(`Line ${line.id} points at unknown arcade ${line.arcadeId}`)
  return arcade
}

export function soleLine(arcade: Arcade): Line | undefined {
  const [only, ...others] = arcade.lines
  return only && others.length === 0 ? only : undefined
}

export const lineName = (line: Line): string => {
  const arcade = arcadeOfLine(line)
  return line.label ? `${arcade.name} (${line.label})` : arcade.name
}

export function sortByDistance(origin: Point): Arcade[] {
  return ARCADES.toSorted(
    (a, b) => distanceMeters(origin, a.location) - distanceMeters(origin, b.location)
  )
}

export function nearestArcade(point: Point): Arcade {
  const [nearest] = sortByDistance(point)
  if (!nearest) throw new Error('ARCADES is empty')
  return nearest
}

export function sortByRecent(lastReportedAt: ReadonlyMap<string, number>): Arcade[] {
  return ARCADES.toSorted((a, b) => {
    const byRecency = (lastReportedAt.get(b.id) ?? -1) - (lastReportedAt.get(a.id) ?? -1)
    return byRecency === 0 ? a.name.localeCompare(b.name) : byRecency
  })
}
