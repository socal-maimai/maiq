import { distanceMeters, type Point } from '@maiq/core/geo'
import { hours, type Hours } from '@maiq/core/hours'

export type Line = {
  id: string
  arcadeId: string
  label: string | null
  cabs: number
  keywords: readonly string[]
}

export const REGIONS = [
  { id: 'socal', name: 'SoCal', fullName: 'Southern California' },
  { id: 'norcal', name: 'NorCal', fullName: 'Northern California' },
] as const

export type Region = (typeof REGIONS)[number]
export type RegionId = Region['id']

export type Arcade = {
  id: string
  name: string
  city: string
  region: RegionId
  unofficial: boolean
  location: Point
  lines: readonly Line[]
  hours?: Hours
}

type SingleLineArcade = {
  id: string
  name: string
  city: string
  region: RegionId
  location: Point
  cabs: number
  unofficial?: boolean
  hours?: Hours
}

function singleLine({ cabs, unofficial = false, ...arcade }: SingleLineArcade): Arcade {
  return {
    ...arcade,
    unofficial,
    lines: [{ id: arcade.id, arcadeId: arcade.id, label: null, cabs, keywords: [] }],
  }
}

export const ARCADES: readonly Arcade[] = [
  singleLine({
    id: 'burbank',
    name: 'Round1 Burbank',
    city: 'Burbank',
    region: 'socal',
    location: { lat: 34.18401, lng: -118.311656 },
    hours: hours({ 'mon-sun': '10:00-26:00' }),
    cabs: 3,
  }),
  {
    id: 'lakewood',
    name: 'Round1 Lakewood',
    city: 'Lakewood',
    region: 'socal',
    unofficial: false,
    location: { lat: 33.850428, lng: -118.138589 },
    hours: hours({ 'sun-thu': '10:00-24:00', 'fri-sat': '10:00-25:00' }),
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
  singleLine({
    id: 'main-place',
    name: 'Round1 Main Place',
    city: 'Santa Ana',
    region: 'socal',
    location: { lat: 33.774196, lng: -117.869038 },
    hours: hours({ 'mon-sun': '10:00-26:00' }),
    cabs: 2,
  }),
  singleLine({
    id: 'temecula',
    name: 'Round1 Temecula',
    city: 'Temecula',
    region: 'socal',
    location: { lat: 33.526131, lng: -117.153183 },
    hours: hours({ 'mon-sun': '10:00-26:00' }),
    cabs: 2,
  }),
  singleLine({
    id: 'puente-hills',
    name: 'Round1 Puente Hills',
    city: 'City of Industry',
    region: 'socal',
    location: { lat: 33.993422, lng: -117.926751 },
    hours: hours({ 'mon-sun': '10:00-26:00' }, [
      { minAge: 18, from: 22 * 60 },
      { minAge: 21, from: 24 * 60 },
    ]),
    cabs: 4,
  }),
  singleLine({
    id: 'mission-viejo',
    name: 'Round1 Mission Viejo',
    city: 'Mission Viejo',
    region: 'socal',
    location: { lat: 33.558026, lng: -117.668901 },
    hours: hours({ 'mon-sun': '10:00-23:00' }),
    cabs: 2,
  }),
  singleLine({
    id: 'moreno-valley',
    name: 'Round1 Moreno Valley',
    city: 'Moreno Valley',
    region: 'socal',
    location: { lat: 33.93932, lng: -117.271209 },
    hours: hours({ 'mon-sun': '10:00-26:00' }),
    cabs: 2,
  }),
  singleLine({
    id: 'plaza-bonita',
    name: 'Round1 Plaza Bonita',
    city: 'National City',
    region: 'socal',
    location: { lat: 32.656907, lng: -117.065308 },
    hours: hours({ 'mon-sun': '10:00-26:00' }),
    cabs: 4,
  }),
  singleLine({
    id: '2nd-loop',
    name: '2nd Loop',
    city: 'Gardena',
    region: 'socal',
    location: { lat: 33.86268, lng: -118.309819 },
    hours: hours({ 'wed-thu': '17:00-24:00', 'fri-sat': '15:00-25:00', sun: '15:00-24:00' }),
    cabs: 1,
  }),
  singleLine({
    id: 'kiddleton-sherman-oaks',
    name: 'Kiddleton Sherman Oaks',
    city: 'Sherman Oaks',
    region: 'socal',
    location: { lat: 34.156973, lng: -118.437405 },
    hours: hours({ 'mon-thu': '10:00-20:00', 'fri-sat': '10:00-21:00', sun: '11:00-19:00' }),
    cabs: 1,
  }),
  singleLine({
    id: 'kiddleton-little-tokyo',
    name: 'Kiddleton Little Tokyo',
    city: 'Los Angeles',
    region: 'socal',
    location: { lat: 34.049387, lng: -118.240725 },
    hours: hours({ 'mon-sun': '12:00-19:00' }),
    cabs: 1,
  }),
  singleLine({
    id: 'camelot-golfland',
    name: 'Camelot Golfland',
    city: 'Anaheim',
    region: 'socal',
    location: { lat: 33.850473, lng: -117.851619 },
    hours: hours({ 'mon-fri': '10:00-22:00', sat: '09:00-22:00', sun: '10:00-22:00' }),
    cabs: 1,
  }),
  singleLine({
    id: 'lucky-strike-aliso-viejo',
    name: 'Lucky Strike Aliso Viejo',
    city: 'Aliso Viejo',
    region: 'socal',
    location: { lat: 33.579378, lng: -117.723719 },
    hours: hours({
      'mon-thu': '16:00-22:00',
      fri: '15:00-24:00',
      sat: '11:00-24:00',
      sun: '11:00-22:00',
    }),
    cabs: 1,
  }),
  singleLine({
    id: 'factory-tea-bar',
    name: 'Factory Tea Bar',
    city: 'San Gabriel',
    region: 'socal',
    location: { lat: 34.097678, lng: -118.108958 },
    hours: hours({ 'sun-thu': '12:00-23:00', 'fri-sat': '12:00-26:00' }),
    cabs: 2,
    unofficial: true,
  }),
  singleLine({
    id: 'pacific-view',
    name: 'Round1 Pacific View',
    city: 'Ventura',
    region: 'socal',
    location: { lat: 34.268487, lng: -119.249725 },
    hours: hours({ 'mon-sun': '10:00-26:00' }),
    cabs: 2,
  }),
  singleLine({
    id: 'stonestown',
    name: 'Round1 Stonestown',
    city: 'San Francisco',
    region: 'norcal',
    location: { lat: 37.7266, lng: -122.477632 },
    cabs: 4,
  }),
  singleLine({
    id: 'eastridge',
    name: 'Round1 Eastridge',
    city: 'San Jose',
    region: 'norcal',
    location: { lat: 37.324669, lng: -121.813599 },
    cabs: 3,
  }),
  singleLine({
    id: 'southland',
    name: 'Round1 Southland',
    city: 'Hayward',
    region: 'norcal',
    location: { lat: 37.651515, lng: -122.104066 },
    cabs: 3,
  }),
  singleLine({
    id: 'roseville',
    name: 'Round1 Roseville',
    city: 'Roseville',
    region: 'norcal',
    location: { lat: 38.774709, lng: -121.269611 },
    cabs: 3,
  }),
  singleLine({
    id: 'sunvalley',
    name: 'Round1 Sunvalley',
    city: 'Concord',
    region: 'norcal',
    location: { lat: 37.968816, lng: -122.061916 },
    cabs: 2,
  }),
  singleLine({
    id: 'northridge',
    name: 'Round1 Northridge',
    city: 'Salinas',
    region: 'norcal',
    location: { lat: 36.716658, lng: -121.657593 },
    cabs: 2,
  }),
  singleLine({
    id: 'kiddleton-japan-center',
    name: 'Kiddleton Japan Center',
    city: 'San Francisco',
    region: 'norcal',
    location: { lat: 37.785164, lng: -122.431848 },
    cabs: 1,
  }),
  singleLine({
    id: 'roseville-golfland',
    name: 'Roseville Golfland',
    city: 'Roseville',
    region: 'norcal',
    location: { lat: 38.7615, lng: -121.257984 },
    cabs: 1,
  }),
  singleLine({
    id: 'fairfield-golfland',
    name: 'Fairfield Golfland',
    city: 'Fairfield',
    region: 'norcal',
    location: { lat: 38.224922, lng: -122.123905 },
    cabs: 1,
  }),
  singleLine({
    id: 'dave-and-busters-santa-rosa',
    name: "Dave & Buster's Santa Rosa",
    city: 'Santa Rosa',
    region: 'norcal',
    location: { lat: 38.439325, lng: -122.717167 },
    cabs: 1,
  }),
  singleLine({
    id: 'ten-pin-turlock',
    name: 'Ten Pin Fun Center',
    city: 'Turlock',
    region: 'norcal',
    location: { lat: 37.526584, lng: -120.88446 },
    cabs: 1,
  }),
  singleLine({
    id: 'hazes-toys',
    name: "Haze's Toys & Arcade",
    city: 'San Rafael',
    region: 'norcal',
    location: { lat: 38.004564, lng: -122.544422 },
    cabs: 2,
    unofficial: true,
  }),
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

export const findRegion = (id: string): Region | undefined =>
  REGIONS.find(region => region.id === id)

export const arcadesIn = (region: RegionId): Arcade[] =>
  ARCADES.filter(arcade => arcade.region === region)

export function sortByDistance(origin: Point, arcades: readonly Arcade[] = ARCADES): Arcade[] {
  return arcades.toSorted(
    (a, b) => distanceMeters(origin, a.location) - distanceMeters(origin, b.location)
  )
}

export function nearestArcade(point: Point): Arcade {
  const [nearest] = sortByDistance(point)
  if (!nearest) throw new Error('ARCADES is empty')
  return nearest
}

export function sortByRecent(
  lastReportedAt: ReadonlyMap<string, number>,
  arcades: readonly Arcade[] = ARCADES
): Arcade[] {
  return arcades.toSorted((a, b) => {
    const byRecency = (lastReportedAt.get(b.id) ?? -1) - (lastReportedAt.get(a.id) ?? -1)
    return byRecency === 0 ? a.name.localeCompare(b.name) : byRecency
  })
}

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

export function searchArcades(query: string): Arcade[] {
  const words = normalize(query).split(' ').filter(Boolean)
  return ARCADES.filter(arcade => {
    const haystack = normalize(`${arcade.name} ${arcade.city} ${arcade.id}`)
    return words.every(word => haystack.includes(word))
  })
}

export function resolveArcade(text: string): Arcade | undefined {
  const exact =
    findArcade(text) ?? ARCADES.find(arcade => normalize(arcade.name) === normalize(text))
  if (exact) return exact
  const [only, ...others] = searchArcades(text)
  return others.length === 0 ? only : undefined
}
