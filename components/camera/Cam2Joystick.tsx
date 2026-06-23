'use client'

import { type PointerEvent, useCallback, useEffect, useRef, useState } from 'react'

type Cam2JoystickMotion = {
  active?: boolean
  command?: string | null
  vector?: { x?: number; y?: number; speed?: number }
  interval_ms?: number
  ttl_ms?: number
}

type Cam2JoystickProps = {
  connected: boolean
  motion: Cam2JoystickMotion | null
  homeDisabled: boolean
  onMove: (x: number, y: number, speed: number) => void
  onStop: () => void
  onHome: () => void
}

export default function Cam2Joystick({
  connected,
  motion,
  homeDisabled,
  onMove,
  onStop,
  onHome,
}: Cam2JoystickProps) {
  const padRef = useRef<HTMLDivElement>(null)
  const activePointerRef = useRef<number | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastVectorRef = useRef({ x: 0, y: 0, speed: 0 })
  const lastVectorSendAtRef = useRef(0)
  const [knob, setKnob] = useState({ x: 0, y: 0, active: false })
  const motionActive = knob.active || motion?.active === true

  const clearHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  }, [])

  const sendVector = useCallback((next: { x: number; y: number; speed: number }, force = false) => {
    lastVectorRef.current = next
    const now = performance.now()
    const minSpacingMs = connected ? 45 : 140
    if (!force && now - lastVectorSendAtRef.current < minSpacingMs) return
    lastVectorSendAtRef.current = now
    onMove(next.x, next.y, next.speed)
  }, [connected, onMove])

  const updateFromPointer = useCallback((event: PointerEvent<HTMLDivElement>, immediate = false) => {
    const pad = padRef.current
    if (!pad) return
    const next = joystickVectorFromPointer(event, pad)
    setKnob({ x: next.x, y: next.y, active: next.speed > 0 })
    sendVector(next, immediate)
  }, [sendVector])

  const stop = useCallback(() => {
    activePointerRef.current = null
    clearHeartbeat()
    lastVectorRef.current = { x: 0, y: 0, speed: 0 }
    lastVectorSendAtRef.current = 0
    setKnob({ x: 0, y: 0, active: false })
    onStop()
  }, [clearHeartbeat, onStop])

  useEffect(() => {
    const stopOnPageExit = () => stop()
    window.addEventListener('pagehide', stopOnPageExit)
    document.addEventListener('visibilitychange', stopOnPageExit)
    return () => {
      window.removeEventListener('pagehide', stopOnPageExit)
      document.removeEventListener('visibilitychange', stopOnPageExit)
      stop()
    }
  }, [stop])

  return (
    <div
      className="flex items-center gap-1.5 rounded-[14px] p-1.5"
      aria-label="Cam 2 pan and tilt controls"
      style={{
        background: 'rgba(0,0,0,0.58)',
        border: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div
        ref={padRef}
        role="application"
        aria-label="Cam 2 joystick"
        onPointerDown={(event) => {
          event.preventDefault()
          activePointerRef.current = event.pointerId
          event.currentTarget.setPointerCapture(event.pointerId)
          updateFromPointer(event, true)
          clearHeartbeat()
          heartbeatRef.current = setInterval(() => {
            const next = lastVectorRef.current
            if (next.speed > 0) sendVector(next, true)
          }, connected ? 70 : 180)
        }}
        onPointerMove={(event) => {
          if (activePointerRef.current !== event.pointerId) return
          event.preventDefault()
          updateFromPointer(event, false)
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
          stop()
        }}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
        onContextMenu={(event) => event.preventDefault()}
        className="relative h-[72px] w-[72px] touch-none rounded-full"
        style={{
          background: motionActive
            ? 'radial-gradient(circle at 50% 50%, rgba(103,232,249,0.24), rgba(255,255,255,0.08) 58%, rgba(255,255,255,0.04))'
            : 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.14), rgba(255,255,255,0.07) 58%, rgba(255,255,255,0.035))',
          boxShadow: motionActive ? '0 0 18px rgba(103,232,249,0.22)' : undefined,
        }}
      >
        <div
          className="absolute left-1/2 top-1/2 h-px w-[54px] -translate-x-1/2 bg-white/18"
          aria-hidden="true"
        />
        <div
          className="absolute left-1/2 top-1/2 h-[54px] w-px -translate-y-1/2 bg-white/18"
          aria-hidden="true"
        />
        <div
          className="absolute left-1/2 top-1/2 h-6 w-6 rounded-full border border-white/35 bg-white/22"
          aria-hidden="true"
          style={{
            transform: `translate(calc(-50% + ${knob.x * 24}px), calc(-50% + ${-knob.y * 24}px))`,
            boxShadow: '0 6px 18px rgba(0,0,0,0.28)',
          }}
        />
      </div>
      <div className="flex h-[72px] flex-col justify-between">
        <button
          type="button"
          aria-label="Home camera"
          disabled={homeDisabled}
          onClick={onHome}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[13px] font-bold text-white/86 transition hover:bg-white/18 hover:text-white disabled:opacity-45"
          style={{ background: 'rgba(255,255,255,0.12)' }}
        >
          ⌂
        </button>
        <div
          className="rounded-full px-1.5 py-0.5 text-center text-[8px] font-bold uppercase tracking-[0.12em]"
          style={{
            background: connected ? 'rgba(16,185,129,0.20)' : 'rgba(245,158,11,0.18)',
            color: connected ? '#a7f3d0' : '#fed7aa',
          }}
        >
          {connected ? 'WS' : 'HTTP'}
        </div>
      </div>
    </div>
  )
}

function joystickVectorFromPointer(event: PointerEvent<HTMLDivElement>, pad: HTMLDivElement) {
  const rect = pad.getBoundingClientRect()
  const rawX = ((event.clientX - rect.left) / rect.width) * 2 - 1
  const rawY = -(((event.clientY - rect.top) / rect.height) * 2 - 1)
  const panGain = 1.65
  const tiltGain = 1
  const shapedX = rawX * panGain
  const shapedY = rawY * tiltGain
  const magnitude = Math.hypot(shapedX, shapedY)
  const deadZone = 0.07
  if (!Number.isFinite(magnitude) || magnitude < deadZone) return { x: 0, y: 0, speed: 0 }
  const scale = magnitude > 1 ? 1 / magnitude : 1
  const x = clampUnit(shapedX * scale)
  const y = clampUnit(shapedY * scale)
  const speed = clamp01((Math.min(1, magnitude) - deadZone) / (1 - deadZone))
  return { x, y, speed }
}

function clampUnit(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(-1, Math.min(1, value))
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}
