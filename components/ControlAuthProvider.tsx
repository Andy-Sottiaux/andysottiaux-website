'use client'

import { LockKeyhole, LogIn } from 'lucide-react'
import {
  createContext,
  type FormEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import Modal from './Modal'

type ControlAuthStatus = 'unknown' | 'locked' | 'unlocked'

type ControlAuthContextValue = {
  status: ControlAuthStatus
  unlocked: boolean
  requestUnlock: () => Promise<boolean>
  lockAccess: () => Promise<boolean>
  markLocked: () => void
}

const ControlAuthContext = createContext<ControlAuthContextValue | null>(null)
const AUTH_EVENT_KEY = 'cayley-private-access-event'
const AUTH_CHANNEL = 'cayley-private-access'

function broadcastLocked() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(AUTH_EVENT_KEY, JSON.stringify({ state: 'locked', at: Date.now() }))
  } catch {
    // BroadcastChannel remains available in browsers that deny localStorage.
  }
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(AUTH_CHANNEL)
    channel.postMessage({ state: 'locked' })
    channel.close()
  }
}

export default function ControlAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ControlAuthStatus>('unknown')
  const [open, setOpen] = useState(false)
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const requestUnlock = useCallback(async () => {
    if (status === 'unlocked') return true
    if (status === 'locked') {
      setOpen(true)
      return false
    }

    setChecking(true)
    try {
      const response = await fetch('/api/v3/control-auth', {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      const body = await response.json().catch(() => null) as {
        authenticated?: boolean
        configured?: boolean
      } | null
      if (response.ok && body?.authenticated === true) {
        setStatus('unlocked')
        return true
      }
      setStatus('locked')
      setError(body?.configured === false ? 'Private access is not configured.' : null)
      setOpen(true)
      return false
    } catch {
      setStatus('locked')
      setError('Private access is temporarily unavailable.')
      setOpen(true)
      return false
    } finally {
      setChecking(false)
    }
  }, [status])

  const applyLocked = useCallback(() => {
    setStatus('locked')
    setPassword('')
  }, [])

  const markLocked = useCallback(() => {
    applyLocked()
    broadcastLocked()
  }, [applyLocked])

  const lockAccess = useCallback(async () => {
    try {
      const response = await fetch('/api/v3/control-auth', {
        method: 'DELETE',
        cache: 'no-store',
        credentials: 'same-origin',
      })
      if (!response.ok) return false
      setOpen(false)
      setError(null)
      markLocked()
      return true
    } catch {
      return false
    }
  }, [markLocked])

  // Teardown below removes the listener and closes the optional channel.
  // react-doctor-disable-next-line react-doctor/effect-needs-cleanup
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_EVENT_KEY) applyLocked()
    }
    window.addEventListener('storage', onStorage)
    const channel = typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(AUTH_CHANNEL)
      : null
    if (channel) channel.onmessage = () => applyLocked()
    return () => {
      window.removeEventListener('storage', onStorage)
      channel?.close()
    }
  }, [applyLocked])

  useEffect(() => {
    if (status !== 'unlocked') return
    let disposed = false
    const validate = async () => {
      try {
        const response = await fetch('/api/v3/control-auth', {
          cache: 'no-store',
          credentials: 'same-origin',
        })
        const body = await response.json().catch(() => null) as { authenticated?: boolean } | null
        if (!disposed && (!response.ok || body?.authenticated !== true)) markLocked()
      } catch {
        // A transient health check must not interrupt an active stream. Media
        // requests remain independently protected by the server-side cookie.
      }
    }
    const interval = window.setInterval(() => void validate(), 5 * 60 * 1000)
    const onFocus = () => void validate()
    window.addEventListener('focus', onFocus)
    return () => {
      disposed = true
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [markLocked, status])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!password || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/v3/control-auth', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const body = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) {
        setError(body?.error === 'too_many_attempts' ? 'Try again later.' : 'Password not accepted.')
        return
      }
      setStatus('unlocked')
      setPassword('')
      setOpen(false)
    } catch {
      setError('Private access is temporarily unavailable.')
    } finally {
      setSubmitting(false)
    }
  }

  const value = useMemo<ControlAuthContextValue>(() => ({
    status,
    unlocked: status === 'unlocked',
    requestUnlock,
    lockAccess,
    markLocked,
  }), [lockAccess, markLocked, requestUnlock, status])

  return (
    <ControlAuthContext.Provider value={value}>
      {children}
      <Modal open={open} onClose={() => setOpen(false)} title="Camera & device access" eyebrow="Private system">
        <form onSubmit={submit} className="mx-auto flex max-w-sm flex-col gap-4">
          <div className="flex items-center gap-3 text-white/80">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[8px] bg-white/10">
              <LockKeyhole aria-hidden="true" className="h-4 w-4" />
            </span>
            <label htmlFor="device-control-password" className="text-[11px] font-semibold uppercase tracking-[0.16em]">
              Access password
            </label>
          </div>
          <input
            id="device-control-password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            disabled={submitting}
            className="h-11 w-full rounded-[8px] border border-white/10 bg-white/5 px-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20 disabled:opacity-60"
          />
          {error && (
            <div role="alert" className="text-[11px] font-medium text-amber-300">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={!password || submitting}
            className="flex h-11 items-center justify-center gap-2 rounded-[8px] bg-white text-[11px] font-bold uppercase tracking-[0.14em] text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <LogIn aria-hidden="true" className="h-4 w-4" />
            {submitting ? 'Checking' : 'Unlock'}
          </button>
        </form>
      </Modal>
      <span className="sr-only" aria-live="polite">
        {checking ? 'Checking private access' : status === 'unlocked' ? 'Camera and device access unlocked' : ''}
      </span>
    </ControlAuthContext.Provider>
  )
}

export function useControlAuth() {
  const value = useContext(ControlAuthContext)
  if (!value) throw new Error('useControlAuth must be used within ControlAuthProvider')
  return value
}
