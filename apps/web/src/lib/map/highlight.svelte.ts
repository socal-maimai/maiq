import { page } from '$app/state'

const SELECTED = /^#arcade-(.+)$/

class Highlight {
  arcadeId = $state<string | null>(null)

  selectedId = $derived(page.url.hash.match(SELECTED)?.[1] ?? null)

  enter(arcadeId: string): void {
    this.arcadeId = arcadeId
  }

  leave(arcadeId: string): void {
    if (this.arcadeId === arcadeId) this.arcadeId = null
  }

  isActive(arcadeId: string): boolean {
    return this.arcadeId === arcadeId || this.selectedId === arcadeId
  }
}

export const highlight = new Highlight()
