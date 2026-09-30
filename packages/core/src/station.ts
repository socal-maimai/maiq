import { BUTTONS_PER_STATION } from '@maiq/core/buttons'
import { toRadians } from '@maiq/core/geo'

export type Slot = { button: number; points: string; faceAt: string }

type Geometry = { half: number; inner: number; outer: number; face: number }

type Point = [number, number]

const buttonAngle = (button: number): number => 22.5 + 45 * (button - 1)

function point(degrees: number, radius: number): Point {
  const angle = toRadians(degrees)
  return [100 + radius * Math.sin(angle), 100 - radius * Math.cos(angle)]
}

export const buttonCenter = (button: number, radius: number): Point =>
  point(buttonAngle(button), radius)

const format = ([x, y]: Point): string => `${x.toFixed(1)},${y.toFixed(1)}`

function slots({ half, inner, outer, face }: Geometry): Slot[] {
  return Array.from({ length: BUTTONS_PER_STATION }, (_, index) => {
    const middle = buttonAngle(index + 1)
    const corners = [
      point(middle - half, outer),
      point(middle + half, outer),
      point(middle + half, inner),
      point(middle - half, inner),
    ]
    const [x, y] = point(middle, face)
    return {
      button: index + 1,
      points: corners.map(format).join(' '),
      faceAt: `translate(${(x - 9.9).toFixed(1)} ${(y - 10.3).toFixed(1)}) scale(0.99)`,
    }
  })
}

export const RING_SLOTS = slots({ half: 11, inner: 72, outer: 98, face: 84 })
export const MINI_SLOTS = slots({ half: 13, inner: 62, outer: 98, face: 80 })
