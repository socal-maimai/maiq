import * as zagToast from '@zag-js/toast'

export const ACTION_BAR_HEIGHT = '--action-bar-height'

const BOTTOM_OFFSET = `calc(var(${ACTION_BAR_HEIGHT}, 5.5rem) + 0.75rem)`

export const toaster = zagToast.createStore({
  placement: 'bottom',
  overlap: false,
  gap: 8,
  max: 3,
  offsets: { top: '1rem', right: '1rem', bottom: BOTTOM_OFFSET, left: '1rem' },
})

export const toast = {
  thanks(): void {
    toaster.success({ title: 'Thank you for your contribution!' })
  },
  error(title: string): void {
    toaster.error({ title })
  },
}
