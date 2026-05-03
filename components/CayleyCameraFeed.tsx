'use client'

/**
 * CayleyCameraFeed — live WebRTC video from the on-board go2rtc, with a
 * graceful fallback that keeps the page beautiful when the camera is
 * unreachable.
 *
 * Data path:
 *   browser ──WHEP──> https://cayley-v3-cam.tailc7d6b6.ts.net/api/webrtc?src=cayley
 *                            │
 *                            ▼ (Tailscale Funnel proxies "/" to 127.0.0.1:1984)
 *                       go2rtc ──RTSP──> rkipc (5MP H.265)
 *
 * go2rtc speaks WHEP: POST the SDP offer to /api/webrtc?src=<stream>, get
 * the SDP answer back in the body. No extra JS deps; just the browser's
 * native RTCPeerConnection. We auto-retry every 30 s on failure.
 */

import { useEffect, useRef, useState } from 'react'

// Default points at the Funnel hostname; override with NEXT_PUBLIC_V3_FEED_URL
// (e.g. http://localhost:1984 for local dev against a port-forwarded board).
const FEED_BASE = (process.env.NEXT_PUBLIC_V3_FEED_URL || 'https://cayley-v3-cam.tailc7d6b6.ts.net').replace(/\/$/, '')
const STREAM_NAME = 'cayley'

type FeedState = 'idle' | 'connecting' | 'live' | 'offline'

export default function CayleyCameraFeed() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [state, setState] = useState<FeedState>('idle')
  const [retryCountdown, setRetryCountdown] = useState<number>(0)

  // The connect routine. Cancellable via cleanup, idempotent: tearing down
  // an existing PC is safe to re-call.
  useEffect(() => {
    let cancelled = false

    const teardown = () => {
      if (pcRef.current) {
        try { pcRef.current.close() } catch {}
        pcRef.current = null
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }

    const connect = async () => {
      if (cancelled) return
      teardown()
      setState('connecting')

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })
      pcRef.current = pc

      // Receive video + audio tracks. addTransceiver before createOffer so
      // the SDP advertises recvonly capability for both media types.
      pc.addTransceiver('video', { direction: 'recvonly' })
      pc.addTransceiver('audio', { direction: 'recvonly' })

      const remoteStream = new MediaStream()
      pc.ontrack = (e) => {
        const tracks = e.streams[0]?.getTracks() ?? [e.track]
        for (const track of tracks) {
          remoteStream.addTrack(track)
        }
        if (videoRef.current && videoRef.current.srcObject !== remoteStream) {
          videoRef.current.srcObject = remoteStream
        }
      }

      pc.oniceconnectionstatechange = () => {
        if (cancelled) return
        const s = pc.iceConnectionState
        if (s === 'connected' || s === 'completed') {
          setState('live')
        } else if (s === 'failed' || s === 'disconnected' || s === 'closed') {
          scheduleRetry('ice ' + s)
        }
      }

      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        // Wait for ICE gathering to settle (or 1.5s, whichever first) so the
        // offer carries candidates — go2rtc accepts non-trickle WHEP.
        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === 'complete') return resolve()
          const t = setTimeout(resolve, 1500)
          pc.addEventListener('icegatheringstatechange', () => {
            if (pc.iceGatheringState === 'complete') {
              clearTimeout(t)
              resolve()
            }
          })
        })

        if (cancelled) return

        const localSdp = pc.localDescription?.sdp
        if (!localSdp) throw new Error('no local SDP')

        const ctrl = new AbortController()
        const timeoutId = setTimeout(() => ctrl.abort(), 8000)
        const res = await fetch(`${FEED_BASE}/api/webrtc?src=${encodeURIComponent(STREAM_NAME)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: localSdp,
          signal: ctrl.signal,
        })
        clearTimeout(timeoutId)

        if (!res.ok) throw new Error('whep ' + res.status)
        const answerSdp = await res.text()
        if (!answerSdp.startsWith('v=')) throw new Error('bad sdp')
        if (cancelled) return

        await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })
        // ICE will fire connected; state flips to 'live' there.
      } catch (err) {
        if (cancelled) return
        scheduleRetry((err as Error)?.message || 'connect failed')
      }
    }

    const scheduleRetry = (_reason: string) => {
      if (cancelled) return
      teardown()
      setState('offline')
      // 30s retry with a visible countdown so the placeholder doesn't feel
      // dead.
      let remaining = 30
      setRetryCountdown(remaining)
      const tick = () => {
        if (cancelled) return
        remaining -= 1
        setRetryCountdown(remaining)
        if (remaining <= 0) {
          connect()
        } else {
          retryRef.current = setTimeout(tick, 1000)
        }
      }
      retryRef.current = setTimeout(tick, 1000)
    }

    connect()

    return () => {
      cancelled = true
      if (retryRef.current) clearTimeout(retryRef.current)
      teardown()
    }
  }, [])

  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl">
      {/* Video — always mounted, even before live, so srcObject swap is instant */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        aria-label="Live camera feed from the Cayley board"
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          opacity: state === 'live' ? 1 : 0,
          transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          background: '#000',
        }}
      />

      {/* Connecting shimmer */}
      {(state === 'connecting' || state === 'idle') && (
        <FeedShimmer label="connecting…" />
      )}

      {/* Offline placeholder */}
      {state === 'offline' && (
        <FeedOffline countdown={retryCountdown} />
      )}

      {/* Live indicator */}
      {state === 'live' && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest"
             style={{
               background: 'rgba(0,0,0,0.6)',
               color: '#fff',
               backdropFilter: 'blur(8px)',
               WebkitBackdropFilter: 'blur(8px)',
             }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{
            background: '#ff453a',
            boxShadow: '0 0 6px #ff453a',
            animation: 'cayLivePulse 1.6s cubic-bezier(0.4,0,0.6,1) infinite',
          }} />
          LIVE
        </div>
      )}

      <style jsx global>{`
        @keyframes cayLivePulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.35; }
        }
        @keyframes cayShimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes cayPlaceholderPulse {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50%      { opacity: 0.85; transform: scale(1.04); }
        }
      `}</style>
    </div>
  )
}

function FeedShimmer({ label }: { label: string }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background:
          'linear-gradient(105deg, #0a0a0c 25%, #16161a 50%, #0a0a0c 75%)',
        backgroundSize: '200% 100%',
        animation: 'cayShimmer 2.4s linear infinite',
      }}
    >
      <div className="flex flex-col items-center gap-3">
        <CameraGlyph />
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/50 font-medium">{label}</div>
      </div>
    </div>
  )
}

function FeedOffline({ countdown }: { countdown: number }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background:
          'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(10,132,255,0.06), transparent 70%), #08080a',
      }}
    >
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <div style={{ animation: 'cayPlaceholderPulse 2.8s cubic-bezier(0.4,0,0.6,1) infinite' }}>
          <CameraGlyph dim />
        </div>
        <div className="text-[13px] font-medium text-white/80 tracking-tight">Camera offline</div>
        <div className="text-[11px] text-white/40 tracking-wide">
          {countdown > 0 ? `Retrying in ${countdown}s` : 'Reconnecting…'}
        </div>
      </div>
    </div>
  )
}

function CameraGlyph({ dim = false }: { dim?: boolean }) {
  // A simple, dignified camera silhouette — better than a spinner.
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: dim ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.55)' }}
    >
      <path d="M3 7h3l2-2h8l2 2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="4" />
      <circle cx="12" cy="13" r="1.4" fill="currentColor" />
    </svg>
  )
}
