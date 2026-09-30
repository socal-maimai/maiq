export function createClock(start = new Date('2026-10-02T02:00:00Z')) {
  let current = start.getTime()
  return {
    now: (): Date => new Date(current),
    advance(ms: number): void {
      current += ms
    },
  }
}
