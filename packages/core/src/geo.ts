export type Point = { lat: number; lng: number }

export const GEOFENCE_METERS = 400
export const FAR_MILES = 3

const EARTH_RADIUS_METERS = 6_371_000
const METERS_PER_MILE = 1609.344

export const toRadians = (degrees: number): number => (degrees * Math.PI) / 180

export function distanceMeters(a: Point, b: Point): number {
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h))
}

export const distanceMiles = (a: Point, b: Point): number => distanceMeters(a, b) / METERS_PER_MILE

export const isWithinGeofence = (arcade: Point, viewer: Point): boolean =>
  distanceMeters(arcade, viewer) <= GEOFENCE_METERS

export function formatMiles(miles: number): string {
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`
}
