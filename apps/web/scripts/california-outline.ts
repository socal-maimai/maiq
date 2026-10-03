import { project, type Projected } from '$lib/map/projection'

const SIMPLIFY_KM = 1.2
const MIN_ISLAND_KM2 = 40
const PADDING_KM = 12

type Ring = Projected[]

function distanceToSegment(point: Projected, start: Projected, end: Projected): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)
        )
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy))
}

function simplify(points: Ring, tolerance: number): Ring {
  if (points.length < 3) return points
  const first = points[0]
  const last = points.at(-1)
  if (!first || !last) return points
  let farthest = 0
  let index = 0
  for (let i = 1; i < points.length - 1; i += 1) {
    const point = points[i]
    if (!point) continue
    const distance = distanceToSegment(point, first, last)
    if (distance > farthest) {
      farthest = distance
      index = i
    }
  }
  if (farthest <= tolerance) return [first, last]
  const left = simplify(points.slice(0, index + 1), tolerance)
  const right = simplify(points.slice(index), tolerance)
  return [...left.slice(0, -1), ...right]
}

function area(ring: Ring): number {
  let sum = 0
  ring.forEach((point, i) => {
    const next = ring[(i + 1) % ring.length]
    if (next) sum += point.x * next.y - next.x * point.y
  })
  return Math.abs(sum) / 2
}

const [input, output] = Bun.argv.slice(2)
if (!input || !output) {
  throw new Error('Usage: bun scripts/california-outline.ts <rings.json> <california.ts>')
}

const rawRings = (await Bun.file(input).json()) as [number, number][][]
const rings = rawRings
  .map(ring => ring.map(([lng, lat]) => project({ lat, lng })))
  .filter(ring => area(ring) >= MIN_ISLAND_KM2)
  .map(ring => simplify(ring, SIMPLIFY_KM))
  .filter(ring => ring.length >= 4)

const points = rings.flat()
const minX = Math.min(...points.map(point => point.x)) - PADDING_KM
const minY = Math.min(...points.map(point => point.y)) - PADDING_KM
const maxX = Math.max(...points.map(point => point.x)) + PADDING_KM
const maxY = Math.max(...points.map(point => point.y)) + PADDING_KM

const round = (value: number): string => (Math.round(value * 10) / 10).toString()
const path = rings
  .map(ring => `M${ring.map(point => `${round(point.x)} ${round(point.y)}`).join('L')}Z`)
  .join('')

const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
const source = `export const CALIFORNIA_BOUNDS = ${JSON.stringify(
  Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, Number(round(value))]))
)}

export const CALIFORNIA_PATH =
  '${path}'
`
await Bun.write(output, source)
console.log(`${rings.length} rings, ${points.length} points, ${path.length} bytes`)
