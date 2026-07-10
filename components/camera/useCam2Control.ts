'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CAMERA_2_CONTROL_FALLBACK_URL,
  CAMERA_2_CONTROL_URL,
  CAMERA_2_CONTROL_WS_FALLBACK_URL,
  CAMERA_2_CONTROL_WS_URL,
  CAMERA_2_SETTINGS_FALLBACK_URL,
  CAMERA_2_SETTINGS_URL,
} from '@/lib/fieldCameraConfig'
import { useControlAuth } from '../ControlAuthProvider'

export type Cam2Settings = {
  ok?: boolean
  stream0?: {
    width?: number
    height?: number
    fps?: number
    bitrate?: number
    gop?: number
    max_gop?: number
    format?: string
    mode?: string
    profile?: number
  } | null
  motor?: {
    steps_pan?: number
    steps_tilt?: number
    accel_pan?: number
    accel_tilt?: number
    motion_driver?: string
    preview_control_mode?: string
  } | null
}

export type Cam2Command = 'ul' | 'uc' | 'ur' | 'cl' | 'center' | 'cr' | 'dl' | 'dc' | 'dr' | 'home' | 'stop'

export type Cam2MotionState = {
  active?: boolean
  command?: string | null
  vector?: { x?: number; y?: number; speed?: number }
  interval_ms?: number
  ttl_ms?: number
}

type ControlPayload = {
  command?: Cam2Command
  direction?: Cam2Command
  action?: 'move' | 'stop' | 'hold'
  x?: number
  y?: number
  speed?: number
  step?: 'fine' | 'normal' | 'coarse'
  hold?: boolean
}

type QueuedControlPayload = {
  payload: ControlPayload
  keepalive?: boolean
}

export function useCam2Control() {
  const { unlocked, requestUnlock, markLocked } = useControlAuth()
  const [settings, setSettings] = useState<Cam2Settings | null>(null)
  const [controlPending, setControlPending] = useState<Cam2Command | null>(null)
  const [controlConnected, setControlConnected] = useState(false)
  const [motionState, setMotionState] = useState<Cam2MotionState | null>(null)
  const controlWsRef = useRef<WebSocket | null>(null)
  const controlWsRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const controlBusyRef = useRef(false)
  const vectorHttpQueuedRef = useRef<QueuedControlPayload | null>(null)
  const vectorHttpProcessingRef = useRef(false)
  const vectorHttpLastSentAtRef = useRef(0)

  const controlUrls = useMemo(() => uniqueUrls([
    CAMERA_2_CONTROL_URL,
    CAMERA_2_CONTROL_FALLBACK_URL,
    '/api/v3/camera2/control',
  ]), [])
  const controlWsUrls = useMemo(() => uniqueUrls([
    CAMERA_2_CONTROL_WS_URL,
    CAMERA_2_CONTROL_WS_FALLBACK_URL,
  ]), [])
  const settingsUrls = useMemo(() => uniqueUrls([
    CAMERA_2_SETTINGS_URL,
    CAMERA_2_SETTINGS_FALLBACK_URL,
    '/api/v3/camera2/settings',
  ]), [])

  const loadSettings = useCallback(() => {
    fetchJsonCandidate<Cam2Settings>(settingsUrls)
      .then((next) => setSettings(next))
      .catch(() => setSettings({ ok: false }))
  }, [settingsUrls])

  const sendControlWs = useCallback((payload: ControlPayload) => {
    const ws = controlWsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    ws.send(JSON.stringify(payload))
    return true
  }, [])

  const postControlPayload = useCallback(async (payload: ControlPayload, keepalive = false) => {
    if (!unlocked) throw new Error('control_auth_required')
    const body = JSON.stringify(payload)
    let lastError: unknown = null
    for (const url of controlUrls) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          keepalive,
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
        if (response.ok) return
        if (response.status === 401 || response.status === 403) markLocked()
        lastError = new Error(`control_${response.status}`)
      } catch (error) {
        lastError = error
      }
    }
    if (lastError) throw lastError
  }, [controlUrls, markLocked, unlocked])

  const sendControlPayload = useCallback(async (payload: ControlPayload, keepalive = false) => {
    if (sendControlWs(payload)) return
    await postControlPayload(payload, keepalive)
  }, [postControlPayload, sendControlWs])

  const sendQueuedVectorHttp = useCallback((payload: ControlPayload, keepalive = false) => {
    if (sendControlWs(payload)) return

    vectorHttpQueuedRef.current = { payload, keepalive }
    if (vectorHttpProcessingRef.current) return

    vectorHttpProcessingRef.current = true
    const processQueue = async () => {
      try {
        while (vectorHttpQueuedRef.current) {
          const next = vectorHttpQueuedRef.current
          vectorHttpQueuedRef.current = null
          const isStop = next.payload.action === 'stop' || next.payload.command === 'stop'
          const minSpacingMs = isStop ? 0 : 170
          const elapsed = Date.now() - vectorHttpLastSentAtRef.current
          if (elapsed < minSpacingMs) {
            await new Promise((resolve) => window.setTimeout(resolve, minSpacingMs - elapsed))
          }

          vectorHttpLastSentAtRef.current = Date.now()
          try {
            await postControlPayload(next.payload, next.keepalive)
          } catch {
            // The relay TTL stops stale motion; keep only the latest vector queued.
          }
        }
      } finally {
        vectorHttpProcessingRef.current = false
      }
    }
    void processQueue()
  }, [postControlPayload, sendControlWs])

  const sendControl = useCallback(async (
    command: Cam2Command,
    step: 'fine' | 'normal' | 'coarse' = 'normal',
    trackPending = true,
    hold = false,
  ) => {
    if (trackPending) {
      if (controlBusyRef.current) return
      controlBusyRef.current = true
      setControlPending(command)
    }
    try {
      await sendControlPayload({ command, step, ...(hold ? { hold: true } : {}) }, command === 'stop')
    } finally {
      if (trackPending) {
        controlBusyRef.current = false
        setControlPending(null)
      }
    }
  }, [sendControlPayload])

  const sendVectorControl = useCallback((x: number, y: number, speed: number) => {
    sendQueuedVectorHttp({
      action: 'move',
      x: clampUnit(x),
      y: clampUnit(y),
      speed: clamp01(speed),
      step: 'fine',
    })
  }, [sendQueuedVectorHttp])

  const stopVectorControl = useCallback(() => {
    if (!unlocked) return
    sendQueuedVectorHttp({ command: 'stop', action: 'stop', step: 'fine' }, true)
  }, [sendQueuedVectorHttp, unlocked])

  useEffect(() => {
    loadSettings()
    return stopVectorControl
  }, [loadSettings, stopVectorControl])

  useEffect(() => {
    let disposed = false

    const connect = (index = 0) => {
      if (disposed || !unlocked || controlWsUrls.length === 0 || typeof WebSocket === 'undefined') return
      const url = controlWsUrls[index % controlWsUrls.length]
      try {
        const ws = new WebSocket(url)
        controlWsRef.current = ws
        ws.onopen = () => {
          if (controlWsRef.current === ws) setControlConnected(true)
        }
        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(String(event.data)) as {
              motion?: Cam2MotionState
              interval_ms?: number
              ttl_ms?: number
              mode?: string
              command?: string
            }
            if (payload.motion) {
              setMotionState(payload.motion)
            } else if (payload.interval_ms || payload.ttl_ms || payload.mode) {
              setMotionState((previous) => ({
                ...previous,
                command: payload.command ?? previous?.command ?? null,
                interval_ms: payload.interval_ms ?? previous?.interval_ms,
                ttl_ms: payload.ttl_ms ?? previous?.ttl_ms,
                active: payload.mode === 'vector' || payload.mode === 'hold'
                  ? true
                  : payload.mode === 'stopped'
                    ? false
                    : previous?.active,
              }))
            }
          } catch {
            // ACK state is advisory; the relay motion TTL remains authoritative.
          }
        }
        ws.onclose = () => {
          if (controlWsRef.current === ws) controlWsRef.current = null
          setControlConnected(false)
          setMotionState((previous) => previous ? { ...previous, active: false } : previous)
          if (!disposed) {
            const nextIndex = (index + 1) % controlWsUrls.length
            controlWsRetryRef.current = setTimeout(() => connect(nextIndex), index === 0 ? 350 : 1200)
          }
        }
        ws.onerror = () => {
          try {
            ws.close()
          } catch {
            // HTTP control remains available.
          }
        }
      } catch {
        if (!disposed) {
          const nextIndex = (index + 1) % controlWsUrls.length
          controlWsRetryRef.current = setTimeout(() => connect(nextIndex), index === 0 ? 350 : 1800)
        }
      }
    }

    connect()
    return () => {
      disposed = true
      if (controlWsRetryRef.current) clearTimeout(controlWsRetryRef.current)
      try {
        controlWsRef.current?.close()
      } catch {
        // Best effort cleanup only.
      }
      controlWsRef.current = null
      setControlConnected(false)
    }
  }, [controlWsUrls, unlocked])

  return {
    settings,
    controlPending,
    controlConnected,
    motionState,
    sendControl,
    sendVectorControl,
    stopVectorControl,
    unlocked,
    requestUnlock,
  }
}

function uniqueUrls(urls: Array<string | null | undefined>) {
  return Array.from(new Set(urls.filter((url): url is string => Boolean(url))))
}

async function fetchJsonCandidate<T>(urls: string[]): Promise<T> {
  let lastError: unknown = null
  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: 'no-store' })
      if (!response.ok) {
        lastError = new Error(`${url}_${response.status}`)
        continue
      }
      return await response.json() as T
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('all_candidates_failed')
}

function clampUnit(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(-1, Math.min(1, value))
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}
