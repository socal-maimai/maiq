import type { ButtonStatus } from '@maiq/core/buttons'

export const FACE_EYES = [
  { cx: 7.2, cy: 8.2, r: 1.3 },
  { cx: 12.8, cy: 8.2, r: 1.3 },
] as const

export const FACE_MOUTHS: Record<ButtonStatus, string> = {
  good: 'M6.6 11.6q3.4 3 6.8 0',
  unreliable: 'M6.6 13.2q1.7-1.5 3.4 0t3.4 0',
  broken: 'M6.6 13.8q3.4-3 6.8 0',
  pending: 'M10 11.3a1.6 1.6 0 1 1 0 3.2a1.6 1.6 0 1 1 0-3.2z',
}
