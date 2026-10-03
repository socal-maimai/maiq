import { redirect } from '@sveltejs/kit'
import { startingRegion } from '$lib/region'

export function load(): void {
  const region = startingRegion()
  if (region) redirect(307, `/${region}`)
}
