import { findArcade, findRegion, nearestArcade, type RegionId } from '@maiq/core/arcades'
import type { Point } from '@maiq/core/geo'
import { viewer } from '$lib/viewer.svelte'

const REGION_KEY = 'maiq.region'

export function rememberRegion(region: RegionId): void {
  try {
    localStorage.setItem(REGION_KEY, region)
  } catch (error) {
    console.warn('Could not save the last region', error)
  }
}

function rememberedRegion(): RegionId | null {
  try {
    return findRegion(localStorage.getItem(REGION_KEY) ?? '')?.id ?? null
  } catch (error) {
    console.warn('Could not read the last region', error)
    return null
  }
}

export const regionNear = (point: Point): RegionId => nearestArcade(point).region

export function startingRegion(): RegionId | null {
  const home = viewer.homeArcadeId ? findArcade(viewer.homeArcadeId) : undefined
  return rememberedRegion() ?? home?.region ?? null
}

export async function grantedPosition(): Promise<Point | null> {
  if (!('permissions' in navigator) || !('geolocation' in navigator)) return null
  const permission = await navigator.permissions.query({ name: 'geolocation' })
  if (permission.state !== 'granted') return null
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { maximumAge: 10 * 60_000, timeout: 5000 }
    )
  })
}
