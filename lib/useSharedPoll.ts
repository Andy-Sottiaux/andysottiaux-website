'use client'

import { useEffect, useState } from 'react'

type Poller<T> = (signal: AbortSignal, previous?: T) => Promise<T>
type Store<T> = { value?: T; updatedAt: number; listeners: Set<(value: T) => void>; timer?: ReturnType<typeof setTimeout>; controller?: AbortController; stop?: () => void }
const stores = new Map<string, Store<unknown>>()

export function subscribeToPoll<T>(key: string, poller: Poller<T>, interval: number, initial: T | undefined, listener: (value: T) => void) {
  let store = stores.get(key) as Store<T> | undefined
  if (!store) {
    store = { value: initial, updatedAt: initial ? Date.now() : 0, listeners: new Set() }
    stores.set(key, store as Store<unknown>)
  }
  const current = store
  current.listeners.add(listener)
  if (current.value !== undefined) listener(current.value)
  if (current.listeners.size === 1) {
    let stopped = false
    const schedule = () => {
      clearTimeout(current.timer)
      if (!stopped && document.visibilityState !== 'hidden') {
        current.timer = setTimeout(() => void run(), Math.max(0, interval - (Date.now() - current.updatedAt)))
      }
    }
    const run = async () => {
      if (stopped || document.visibilityState === 'hidden' || current.controller) return
      const controller = new AbortController()
      current.controller = controller
      try {
        const next = await poller(controller.signal, current.value)
        if (!stopped && !controller.signal.aborted) {
          current.value = next
          current.updatedAt = Date.now()
          current.listeners.forEach((notify) => notify(next))
        }
      } catch {
        if (!controller.signal.aborted) current.updatedAt = Date.now()
      } finally {
        // A late aborted request must not clear a new subscriber's controller.
        if (current.controller === controller) {
          current.controller = undefined
          schedule()
        }
      }
    }
    const visibility = () => {
      if (document.visibilityState === 'hidden') {
        clearTimeout(current.timer)
        current.controller?.abort()
      } else schedule()
    }
    document.addEventListener('visibilitychange', visibility)
    current.stop = () => {
      stopped = true
      clearTimeout(current.timer)
      current.controller?.abort()
      current.controller = undefined
      document.removeEventListener('visibilitychange', visibility)
    }
    schedule()
  }
  return () => {
    current.listeners.delete(listener)
    if (!current.listeners.size) current.stop?.()
  }
}

/** One request per key, only while a visible page has active subscribers. */
export function useSharedPoll<T>(key: string, poller: Poller<T>, interval: number, initial?: T, enabled = true) {
  const [value, setValue] = useState<T | undefined>(initial)
  useEffect(() => {
    if (!enabled) return
    return subscribeToPoll(key, poller, interval, initial, setValue)
  }, [key, poller, interval, initial, enabled])
  return value
}
