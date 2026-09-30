import { describe, expect, test } from 'bun:test'
import {
  distanceMeters,
  distanceMiles,
  formatMiles,
  GEOFENCE_METERS,
  isWithinGeofence,
  type Point,
} from '@maiq/core/geo'

const METERS_PER_DEGREE_LATITUDE = 111_194.93
const lakewood: Point = { lat: 33.850428, lng: -118.138589 }
const north = (point: Point, meters: number): Point => ({
  lat: point.lat + meters / METERS_PER_DEGREE_LATITUDE,
  lng: point.lng,
})

describe('distanceMeters', () => {
  test('is zero for the same point', () => {
    expect(distanceMeters(lakewood, lakewood)).toBe(0)
  })

  test('measures one degree of latitude', () => {
    expect(distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_194.93, 0)
  })

  test('is symmetric', () => {
    const other = north(lakewood, 1234)
    expect(distanceMeters(lakewood, other)).toBeCloseTo(distanceMeters(other, lakewood), 6)
  })

  test('converts to miles', () => {
    expect(distanceMiles(lakewood, north(lakewood, 1609.344))).toBeCloseTo(1, 3)
  })
})

describe('isWithinGeofence', () => {
  test('accepts a viewer just inside the radius', () => {
    expect(isWithinGeofence(lakewood, north(lakewood, GEOFENCE_METERS - 1))).toBe(true)
  })

  test('rejects a viewer just outside the radius', () => {
    expect(isWithinGeofence(lakewood, north(lakewood, GEOFENCE_METERS + 1))).toBe(false)
  })
})

describe('formatMiles', () => {
  test('uses one decimal under 10 miles', () => {
    expect(formatMiles(2.64)).toBe('2.6 mi')
    expect(formatMiles(9.94)).toBe('9.9 mi')
  })

  test('rounds to whole miles from 10 up', () => {
    expect(formatMiles(12.4)).toBe('12 mi')
  })
})
