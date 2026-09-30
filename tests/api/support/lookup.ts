import { findArcade, type Arcade } from '@maiq/core/arcades'

export function arcade(id: string): Arcade {
  const found = findArcade(id)
  if (!found) throw new Error(`test setup: no arcade ${id}`)
  return found
}
