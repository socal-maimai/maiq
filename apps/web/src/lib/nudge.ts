import type { Attachment } from 'svelte/attachments'

export function nudge(field: HTMLElement | null, focus: FocusOptions = {}): void {
  if (!field) return
  field.removeAttribute('data-nudge')
  void field.offsetWidth
  field.setAttribute('data-nudge', '')
  field.focus(focus)
}

export const nudgeable: Attachment<HTMLElement> = node => {
  const clear = (event: AnimationEvent): void => {
    if (event.animationName === 'm-nudge') node.removeAttribute('data-nudge')
  }
  node.addEventListener('animationend', clear)
  return () => node.removeEventListener('animationend', clear)
}
