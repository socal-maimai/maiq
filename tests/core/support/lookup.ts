import { findArcade, findLine, type Arcade, type Line } from '@maiq/core/arcades'

export function arcade(id: string): Arcade {
  const found = findArcade(id)
  if (!found) throw new Error(`test setup: no arcade ${id}`)
  return found
}

export function line(id: string): Line {
  const found = findLine(id)
  if (!found) throw new Error(`test setup: no line ${id}`)
  return found
}
