import type { ButtonState } from '@maiq/core/button-service'
import type { LineState } from '@maiq/core/state'

type Listener<T> = (value: T) => void

type Events<T> = {
  emit(value: T): void
  subscribe(listener: Listener<T>): () => void
}

export type LineEvents = Events<LineState>
export type ButtonEvents = Events<ButtonState>

export function createEvents<T>(onListenerError: (error: unknown) => void): Events<T> {
  const listeners = new Set<Listener<T>>()
  return {
    emit(value) {
      for (const listener of listeners) {
        try {
          listener(value)
        } catch (error) {
          onListenerError(error)
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
