import type { Point } from '@maiq/core/geo'

const EARTH_RADIUS_KM = 6371
const RADIANS = Math.PI / 180
const STANDARD_PARALLELS = [34 * RADIANS, 40.5 * RADIANS] as const
const CENTRAL_MERIDIAN = -120 * RADIANS

const [first, second] = STANDARD_PARALLELS
const n = (Math.sin(first) + Math.sin(second)) / 2
const c = Math.cos(first) ** 2 + 2 * n * Math.sin(first)
const rho0 = (EARTH_RADIUS_KM * Math.sqrt(c)) / n

export type Projected = { x: number; y: number }

export function project({ lat, lng }: Point): Projected {
  const rho = (EARTH_RADIUS_KM * Math.sqrt(c - 2 * n * Math.sin(lat * RADIANS))) / n
  const theta = n * (lng * RADIANS - CENTRAL_MERIDIAN)
  return { x: rho * Math.sin(theta), y: rho * Math.cos(theta) - rho0 }
}
