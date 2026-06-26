'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useFieldTheme } from './fieldTheme'

type CollectionProgress = {
  available?: boolean
  status?: string
  attempts?: number
  kept?: number
  duplicates?: number
  duplicate_ratio?: number
  diverse_attempt_ratio?: number
  min_diverse_attempt_ratio?: number
  finish_reason?: string
  session_status?: string | null
}

type TrainingStatus = {
  ok?: boolean
  error?: string
  state?: string
  generated_at?: string
  dataset_ready?: boolean
  training_ready?: boolean
  short_action?: string
  collection_wait?: {
    status?: string
    latest_preflight_status?: string
    capture?: {
      attempts?: number
      kept?: number
      duplicates?: number
      diverse_attempt_ratio?: number
    }
    preflight_progress?: CollectionProgress
    guided_progress?: CollectionProgress
  }
  model_wait?: {
    latest_pipeline_status?: string
    next_action?: string
    readiness_failures?: string[]
  }
  production_readiness?: {
    ok?: boolean
    status?: string
    short_action?: string
    failures?: string[]
    total_images?: number
    labeled_images?: number
    total_labels?: number
    nonzero_classes?: Record<string, number>
    image_diversity?: {
      unique_images?: number
      labeled_unique_images?: number
    }
    collection_plan?: {
      min_new_images?: number
      min_new_labeled_images?: number
      min_new_labels?: number
      min_new_classes?: number
      min_new_unique_images?: number
      min_new_labeled_unique_images?: number
      focus?: string[]
      current_classes?: Record<string, number>
      suggested_min_rounds?: number
      suggested_round_target_frames?: number
    }
  }
  label_seed?: {
    total_images?: number
    labeled_images?: number
    total_labels?: number
    classes?: Record<string, number>
  }
}

type DetectionPayload = {
  ok?: boolean
  counts?: Record<string, number>
  recent?: Array<{
    class?: string
    confidence?: number
    ts?: number
  }>
  relay?: {
    stale?: boolean
    cache_age_s?: number
    type?: string
  }
  window_sec?: number
}

type CameraDiagnostics = {
  ok?: boolean
  summary?: {
    resolution?: string | null
    fps?: number | null
    rknn_state?: string | null
    rknn_fps?: number | null
    rknn_latency_ms?: number | null
    sanitizer_age_s?: number | null
    services_down?: string[] | null
  }
}

type IntelligenceState = {
  loading: boolean
  error: string | null
  training: TrainingStatus | null
  detections: DetectionPayload | null
  diagnostics: CameraDiagnostics | null
  updatedAt: number | null
}

const POLL_MS = 15_000

function surfaceStyle(isLight: boolean, border: string, accentGlow?: string): CSSProperties {
  return {
    background: accentGlow
      ? isLight
        ? `linear-gradient(135deg, ${accentGlow}, rgba(0,0,0,0.012))`
        : `linear-gradient(135deg, ${accentGlow}, rgba(255,255,255,0.032))`
      : isLight
        ? 'rgba(0,0,0,0.025)'
        : 'rgba(255,255,255,0.03)',
    border,
    boxShadow: isLight
      ? '0 10px 28px rgba(28,26,28,0.045)'
      : '0 14px 34px rgba(0,0,0,0.18)',
  }
}

function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const colors = {
    neutral: { fg: palette.bodyText, bg: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)' },
    good: { fg: isLight ? '#047857' : '#bbf7d0', bg: isLight ? 'rgba(16,185,129,0.10)' : 'rgba(16,185,129,0.13)' },
    warn: { fg: isLight ? '#92400e' : '#fde68a', bg: isLight ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.13)' },
    bad: { fg: isLight ? '#b91c1c' : '#fecaca', bg: isLight ? 'rgba(239,68,68,0.10)' : 'rgba(239,68,68,0.13)' },
  }[tone]

  return (
    <span
      className="rounded-md px-2 py-1 text-[10px] sm:text-[10.5px] font-semibold leading-none"
      style={{ color: colors.fg, background: colors.bg }}
    >
      {children}
    </span>
  )
}

async function readJson<T>(url: string, signal: AbortSignal): Promise<T | null> {
  const response = await fetch(url, {
    cache: 'no-store',
    signal,
  })
  if (!response.ok) return null
  return await response.json() as T
}

function useCameraIntelligence(enabled: boolean): IntelligenceState {
  const [state, setState] = useState<IntelligenceState>({
    loading: enabled,
    error: null,
    training: null,
    detections: null,
    diagnostics: null,
    updatedAt: null,
  })

  useEffect(() => {
    if (!enabled) {
      setState((current) => ({ ...current, loading: false }))
      return
    }

    let cancelled = false
    let activeController: AbortController | null = null

    const load = async () => {
      activeController?.abort()
      const controller = new AbortController()
      activeController = controller

      setState((current) => ({ ...current, loading: current.updatedAt === null, error: null }))

      const [training, detections, diagnostics] = await Promise.allSettled([
        readJson<TrainingStatus>('/api/v3/training/status', controller.signal),
        readJson<DetectionPayload>('/api/v3/detections?window_sec=900', controller.signal),
        readJson<CameraDiagnostics>('/api/v3/camera/diagnostics', controller.signal),
      ])

      if (cancelled || controller.signal.aborted) return

      const nextTraining = training.status === 'fulfilled' ? training.value : null
      const nextDetections = detections.status === 'fulfilled' ? detections.value : null
      const nextDiagnostics = diagnostics.status === 'fulfilled' ? diagnostics.value : null
      const anyData = Boolean(nextTraining || nextDetections || nextDiagnostics)

      setState({
        loading: false,
        error: anyData ? null : 'unavailable',
        training: nextTraining,
        detections: nextDetections,
        diagnostics: nextDiagnostics,
        updatedAt: Date.now(),
      })
    }

    void load()
    const interval = window.setInterval(() => void load(), POLL_MS)

    return () => {
      cancelled = true
      activeController?.abort()
      window.clearInterval(interval)
    }
  }, [enabled])

  return state
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function formatState(value?: string | null): string {
  return value ? value.replace(/_/g, ' ') : 'checking'
}

function currentClasses(training: TrainingStatus | null): Record<string, number> {
  return (
    training?.production_readiness?.nonzero_classes ||
    training?.production_readiness?.collection_plan?.current_classes ||
    training?.label_seed?.classes ||
    {}
  )
}

function trainingReady(training: TrainingStatus | null): boolean {
  return Boolean(training?.training_ready || training?.dataset_ready || training?.production_readiness?.ok)
}

function statusTone(training: TrainingStatus | null): 'good' | 'warn' | 'bad' {
  if (!training || training.ok === false || training.error) return 'bad'
  if (trainingReady(training)) return 'good'
  return 'warn'
}

function statusLabel(training: TrainingStatus | null): string {
  if (!training) return 'unavailable'
  if (training.error || training.ok === false) return 'offline'
  if (trainingReady(training)) return 'training ready'
  if (training.collection_wait?.guided_progress?.session_status === 'stalled') return 'diversity stalled'
  if (training.state === 'waiting_for_labels') return 'review labels'
  return formatState(training.state || training.production_readiness?.status)
}

function targetFromCurrent(current: number | null, minNew: number | null, fallback: number): number {
  if (current != null && minNew != null) return Math.max(current + minNew, current, 1)
  return Math.max(fallback, current ?? 0, 1)
}

function progressRows(training: TrainingStatus | null) {
  const readiness = training?.production_readiness
  const plan = readiness?.collection_plan
  const classes = currentClasses(training)
  const classCount = Object.keys(classes).length

  const images = numberValue(readiness?.total_images ?? training?.label_seed?.total_images)
  const labeled = numberValue(readiness?.labeled_images ?? training?.label_seed?.labeled_images)
  const labels = numberValue(readiness?.total_labels ?? training?.label_seed?.total_labels)
  const unique = numberValue(readiness?.image_diversity?.unique_images)

  return [
    {
      label: 'Images',
      value: images,
      target: targetFromCurrent(images, numberValue(plan?.min_new_images), 50),
    },
    {
      label: 'Labeled',
      value: labeled,
      target: targetFromCurrent(labeled, numberValue(plan?.min_new_labeled_images), 30),
    },
    {
      label: 'Labels',
      value: labels,
      target: targetFromCurrent(labels, numberValue(plan?.min_new_labels), 30),
    },
    {
      label: 'Unique',
      value: unique,
      target: targetFromCurrent(unique, numberValue(plan?.min_new_unique_images), 20),
    },
    {
      label: 'Classes',
      value: classCount,
      target: targetFromCurrent(classCount, numberValue(plan?.min_new_classes), 2),
    },
  ]
}

function progressPercent(value: number | null, target: number): number {
  if (value == null || target <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)))
}

function formatNumber(value: number | null | undefined, fallback = '—'): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Number.isInteger(value) ? String(value) : value.toFixed(value < 1 ? 2 : 1)
}

function primaryAction(training: TrainingStatus | null): string {
  return (
    training?.production_readiness?.short_action ||
    training?.short_action ||
    training?.model_wait?.next_action ||
    'Waiting for the camera training service to report its next action.'
  )
}

function collectionLine(training: TrainingStatus | null): string {
  const guided = training?.collection_wait?.guided_progress
  const preflight = training?.collection_wait?.preflight_progress
  const progress = guided?.available ? guided : preflight
  if (!progress) return 'No collection session reported.'

  const kept = numberValue(progress.kept)
  const attempts = numberValue(progress.attempts)
  const duplicateRatio = numberValue(progress.duplicate_ratio)
  const pieces = [
    formatState(progress.session_status || progress.status || training?.collection_wait?.status),
    kept != null && attempts != null ? `${kept}/${attempts} kept` : null,
    duplicateRatio != null ? `${Math.round(duplicateRatio * 100)}% duplicate` : null,
    progress.finish_reason ? `finish: ${formatState(progress.finish_reason)}` : null,
  ].filter(Boolean)
  return pieces.join(' · ')
}

function detectionTotal(detections: DetectionPayload | null): number {
  return Object.values(detections?.counts ?? {}).reduce((sum, count) => (
    Number.isFinite(count) ? sum + count : sum
  ), 0)
}

export default function CameraIntelligencePanel({ enabled = true }: { enabled?: boolean }) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const { training, detections, diagnostics, loading, error, updatedAt } = useCameraIntelligence(enabled)
  const rows = useMemo(() => progressRows(training), [training])
  const classes = currentClasses(training)
  const classEntries = Object.entries(classes).sort((a, b) => b[1] - a[1])
  const failures = training?.production_readiness?.failures || training?.model_wait?.readiness_failures || []
  const detTotal = detectionTotal(detections)
  const summary = diagnostics?.summary
  const ready = trainingReady(training)
  const firstSamplePending = loading && updatedAt === null && training === null
  const tone = firstSamplePending ? 'neutral' : statusTone(training)

  return (
    <section
      aria-label="Cam1 AI training readiness"
      className="rounded-2xl p-4 sm:p-5"
      style={surfaceStyle(
        isLight,
        palette.cardBorder,
        isLight ? 'rgba(16,185,129,0.055)' : 'rgba(52,211,153,0.075)'
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div
            className="text-[9.5px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: palette.mutedText }}
          >
            AI Readiness
          </div>
          <div
            className="mt-1.5 text-[16px] sm:text-[18px] font-semibold leading-tight tracking-tight"
            style={{ color: isLight ? '#1c1a1c' : '#fff' }}
          >
            Cam1 model quality is measured with dataset, diversity, and live inference gates.
          </div>
          <p className="mt-2 text-[12.5px] sm:text-[13.5px] leading-snug" style={{ color: palette.bodyText }}>
            This makes the edge-AI claim inspectable: the site shows whether labels, class balance,
            unique views, detections, and RKNN inference are healthy before calling a model trained.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
          <Pill tone={tone}>{firstSamplePending ? 'checking' : statusLabel(training)}</Pill>
          <Pill tone={firstSamplePending ? 'neutral' : ready ? 'good' : 'warn'}>
            {firstSamplePending ? 'loading gates' : ready ? 'ready gate passed' : 'not training ready'}
          </Pill>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <MetricCard label="Stream" value={`${summary?.resolution || '—'}`} detail={`${formatNumber(summary?.fps)} FPS`} />
        <MetricCard label="RKNN" value={formatState(summary?.rknn_state)} detail={`${formatNumber(summary?.rknn_latency_ms)} ms`} />
        <MetricCard label="Detections" value={String(detTotal)} detail={`last ${Math.round((detections?.window_sec ?? 900) / 60)} min`} />
        <MetricCard label="Sanitizer" value={summary?.sanitizer_age_s == null ? '—' : `${formatNumber(summary.sanitizer_age_s)}s`} detail="clean-frame age" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div
          className="rounded-2xl p-3.5"
          style={surfaceStyle(isLight, palette.cardBorder)}
        >
          <div
            className="text-[9.5px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: palette.mutedText }}
          >
            Training gates
          </div>
          <div className="mt-3 space-y-2.5">
            {rows.map((row) => {
              const pct = progressPercent(row.value, row.target)
              return (
                <div key={row.label}>
                  <div className="flex items-center justify-between gap-3 text-[11px] font-semibold" style={{ color: palette.bodyText }}>
                    <span>{row.label}</span>
                    <span className="tabular-nums">{formatNumber(row.value, '0')} / {row.target}</span>
                  </div>
                  <div
                    className="mt-1 h-1.5 overflow-hidden rounded-full"
                    style={{ background: isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.08)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: pct >= 100
                          ? 'linear-gradient(90deg,#22c55e,#14b8a6)'
                          : 'linear-gradient(90deg,#f59e0b,#22d3ee)',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div
            className="rounded-2xl p-3.5"
            style={surfaceStyle(isLight, palette.cardBorder)}
          >
            <div
              className="text-[9.5px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: palette.mutedText }}
            >
              Next best action
            </div>
            <p className="mt-2 text-[12px] leading-snug" style={{ color: palette.bodyText }}>
              {error ? 'Training telemetry is currently unavailable.' : primaryAction(training)}
            </p>
            <p className="mt-2 text-[11px] leading-snug" style={{ color: palette.mutedText }}>
              {collectionLine(training)}
            </p>
          </div>

          <div
            className="rounded-2xl p-3.5"
            style={surfaceStyle(isLight, palette.cardBorder)}
          >
            <div
              className="text-[9.5px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: palette.mutedText }}
            >
              Class coverage
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {classEntries.length > 0 ? classEntries.map(([name, count]) => (
                <Pill key={name} tone={count > 0 ? 'neutral' : 'warn'}>
                  {name} · {count}
                </Pill>
              )) : (
                <Pill tone="warn">no labeled classes</Pill>
              )}
            </div>
            {failures.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {failures.slice(0, 3).map((failure) => (
                  <Pill key={failure} tone="warn">{failure}</Pill>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          <Pill tone={detections?.relay?.stale ? 'warn' : 'good'}>
            detections {detections?.relay?.stale ? 'stale' : 'fresh'}
          </Pill>
          <Pill tone={(summary?.services_down?.length ?? 0) > 0 ? 'bad' : 'good'}>
            services {(summary?.services_down?.length ?? 0) > 0 ? 'attention' : 'healthy'}
          </Pill>
        </div>
        <div className="text-[10.5px] leading-tight" style={{ color: palette.mutedText }}>
          {updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Waiting for first sample'}
        </div>
      </div>
    </section>
  )
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  return (
    <div
      className="rounded-2xl px-3 py-2.5"
      style={surfaceStyle(isLight, palette.cardBorder)}
    >
      <div className="text-[9px] font-semibold uppercase tracking-[0.16em]" style={{ color: palette.mutedText }}>
        {label}
      </div>
      <div
        className="mt-1 truncate text-[14px] font-semibold leading-tight tracking-tight"
        style={{ color: isLight ? '#1c1a1c' : '#fff' }}
      >
        {value}
      </div>
      <div className="mt-0.5 truncate text-[10.5px] leading-tight" style={{ color: palette.bodyText }}>
        {detail}
      </div>
    </div>
  )
}
