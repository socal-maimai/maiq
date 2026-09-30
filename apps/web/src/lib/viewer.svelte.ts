import { ARCADES, findArcade, nearestArcade, type Arcade } from '@maiq/core/arcades'
import { isWithinGeofence, type Point } from '@maiq/core/geo'

const HOME_KEY = 'maiq.homeArcade'

export type LocationStatus = 'pending' | 'granted' | 'unavailable'

export type Origin =
  | { kind: 'position'; point: Point; near: Arcade }
  | { kind: 'home'; point: Point; arcade: Arcade }
  | { kind: 'none' }

function readHome(): string | null {
  try {
    return localStorage.getItem(HOME_KEY)
  } catch (error) {
    console.warn('Could not read the saved home arcade', error)
    return null
  }
}

class Viewer {
  position = $state<Point | null>(null)
  status = $state<LocationStatus>('pending')
  homeArcadeId = $state<string | null>(readHome())

  origin = $derived.by((): Origin => {
    if (this.position) {
      return { kind: 'position', point: this.position, near: nearestArcade(this.position) }
    }
    const home = this.homeArcadeId ? findArcade(this.homeArcadeId) : undefined
    return home ? { kind: 'home', point: home.location, arcade: home } : { kind: 'none' }
  })

  hereArcadeId = $derived.by((): string | null => {
    const position = this.position
    if (!position) return null
    return ARCADES.find(arcade => isWithinGeofence(arcade.location, position))?.id ?? null
  })

  watch(): () => void {
    if (!('geolocation' in navigator)) {
      this.status = 'unavailable'
      return () => {}
    }
    const watchId = navigator.geolocation.watchPosition(
      position => {
        this.position = { lat: position.coords.latitude, lng: position.coords.longitude }
        this.status = 'granted'
      },
      () => {
        if (!this.position) this.status = 'unavailable'
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 20_000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }

  setHome(arcadeId: string): void {
    this.homeArcadeId = arcadeId
    try {
      localStorage.setItem(HOME_KEY, arcadeId)
    } catch (error) {
      console.warn('Could not save the home arcade; it will reset on reload', error)
    }
  }
}

export const viewer = new Viewer()
