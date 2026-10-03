export type Circle = { x: number; y: number; radius: number }

const ITERATIONS = 80
const SPACING = 0.65

export function separateCircles(circles: readonly Circle[]): { x: number; y: number }[] {
  const placed = circles.map(({ x, y, radius }) => ({ x, y, radius }))
  for (let round = 0; round < ITERATIONS; round += 1) {
    let moved = false
    for (const [i, a] of placed.entries()) {
      for (const b of placed.slice(i + 1)) {
        const dx = b.x - a.x
        const dy = b.y - a.y
        const distance = Math.hypot(dx, dy)
        const overlap = (a.radius + b.radius) * SPACING - distance
        if (overlap <= 0) continue
        const [ux, uy] = distance === 0 ? [1, 0] : [dx / distance, dy / distance]
        a.x -= (ux * overlap) / 2
        a.y -= (uy * overlap) / 2
        b.x += (ux * overlap) / 2
        b.y += (uy * overlap) / 2
        moved = true
      }
    }
    if (!moved) break
  }
  return placed.map(({ x, y }) => ({ x, y }))
}
