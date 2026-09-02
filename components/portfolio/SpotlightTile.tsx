'use client'

import Image from 'next/image'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { ModalKey } from '../CompactModals'
import CameraIdleSurface from '../CameraIdleSurface'
import { useFieldTheme } from '../fieldTheme'
import { haptic } from '@/lib/haptics'
import type { FieldCameraSource } from '@/lib/fieldCameraConfig'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { SPOTLIGHT_ITEMS, SPOTLIGHT_ROTATION_MS, type SpotlightItem } from './content'
import Tile from './Tile'

const CameraFeedSwitcher = dynamic(() => import('../CameraFeedSwitcher'), {
  ssr: false,
  loading: () => <CameraIdleSurface mode="loading" />,
})

export default function SpotlightTile({
  enabled,
  streamSessionId,
  modalOpen,
  onCameraChange,
  onOpen,
}: {
  enabled: boolean
  streamSessionId: number
  modalOpen: boolean
  onCameraChange: (value: FieldCameraSource) => void
  onOpen: (key: ModalKey) => void
}) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const reducedMotion = useReducedMotion()
  const [activeIndex, setActiveIndex] = useState(0)
  const [streamIntent, setStreamIntent] = useState<{
    itemId: string
    sessionId: number
  } | null>(null)
  const interactionPausedRef = useRef(false)
  const active = SPOTLIGHT_ITEMS[activeIndex]
  const streamEnabled = enabled &&
    streamIntent?.itemId === active.id &&
    streamIntent.sessionId === streamSessionId

  useEffect(() => {
    if (reducedMotion || modalOpen || streamEnabled) return

    const timer = window.setInterval(() => {
      if (!interactionPausedRef.current) {
        setActiveIndex((current) => (current + 1) % SPOTLIGHT_ITEMS.length)
      }
    }, SPOTLIGHT_ROTATION_MS)

    return () => window.clearInterval(timer)
  }, [modalOpen, reducedMotion, streamEnabled])

  const selectSpotlight = (index: number) => {
    setActiveIndex(index)
    setStreamIntent(null)

    const nextCamera = SPOTLIGHT_ITEMS[index]?.camera
    if (nextCamera) onCameraChange(nextCamera)
  }

  const openActive = () => {
    if (active.camera) onCameraChange(active.camera)
    onOpen(active.modal)
  }

  const startActiveCamera = () => {
    if (!active.camera) return
    onCameraChange(active.camera)
    setStreamIntent({ itemId: active.id, sessionId: streamSessionId })
  }

  const resumeAfterFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      interactionPausedRef.current = false
    }
  }

  return (
    <Tile
      label="Spotlight"
      accent={active.accent}
      deepLink="/#now"
      onOpen={openActive}
      modalLabel={`Open ${active.title}`}
      className="min-h-[310px] lg:min-h-0"
    >
      <div
        data-spotlight-motion="true"
        className="flex flex-1 min-h-0 flex-col"
        onPointerEnter={() => { interactionPausedRef.current = true }}
        onPointerLeave={() => { interactionPausedRef.current = false }}
        onFocusCapture={() => { interactionPausedRef.current = true }}
        onBlurCapture={resumeAfterFocus}
      >
        <div className="relative flex-1 min-h-[230px] overflow-hidden">
          {SPOTLIGHT_ITEMS.map((item, index) => {
            const isActive = index === activeIndex
            return (
              <div
                key={item.id}
                aria-hidden={!isActive}
                className={`spotlight-slide absolute inset-0 ${isActive
                  ? 'opacity-100 translate-x-0 scale-100 pointer-events-auto'
                  : 'opacity-0 translate-x-4 scale-[0.985] pointer-events-none'}`}
              >
                {item.kind === 'camera' ? (
                  <SpotlightCameraPanel
                    item={item}
                    active={isActive}
                    enabled={enabled}
                    streamEnabled={isActive && streamEnabled}
                    onStart={startActiveCamera}
                    onOpen={openActive}
                  />
                ) : (
                  <SpotlightProjectPanel
                    item={item}
                    active={isActive}
                  />
                )}
              </div>
            )
          })}
        </div>

        <SpotlightRail
          items={SPOTLIGHT_ITEMS}
          activeIndex={activeIndex}
          onSelect={selectSpotlight}
          isLight={isLight}
          border={palette.cardBorder}
          muted={palette.mutedText}
        />
      </div>
    </Tile>
  )
}

function SpotlightCameraPanel({
  item,
  active,
  enabled,
  streamEnabled,
  onStart,
  onOpen,
}: {
  item: SpotlightItem
  active: boolean
  enabled: boolean
  streamEnabled: boolean
  onStart: () => void
  onOpen: () => void
}) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const camera = item.camera ?? 'field'

  return (
    <div className="h-full px-3 md:px-[clamp(0.75rem,1.15vw,1rem)] pt-2 md:pt-[clamp(0.35rem,1.0dvh,0.75rem)] pb-2 flex flex-col gap-2">
      <div
        className="relative w-full flex-1 min-h-[148px] overflow-hidden rounded-[14px]"
        style={{
          background: isLight ? '#0a0a0c' : '#000',
          border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)',
          boxShadow: isLight
            ? '0 4px 12px rgba(28,26,28,0.12)'
            : '0 8px 24px rgba(0,0,0,0.4)',
        }}
      >
        <CameraFeedSwitcher
          enabled={enabled && streamEnabled}
          fit="cover"
          selectedCamera={camera}
          onStart={active ? onStart : undefined}
        />
        {!streamEnabled && (
          <>
            <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 rounded-full bg-black/58 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/82">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: item.accent.dark, boxShadow: `0 0 8px ${item.accent.dark}` }}
              />
              {item.eyebrow}
            </div>
            <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-full bg-black/54 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/72">
              {item.title}
            </div>
          </>
        )}
        {active && streamEnabled && (
          <button
            type="button"
            aria-label={`Expand ${item.title}`}
            onClick={(event) => {
              event.stopPropagation()
              haptic('open')
              onOpen()
            }}
            className="absolute right-3 bottom-3 z-20 flex h-8 w-8 items-center justify-center rounded-full text-white/82 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
            style={{
              background: 'rgba(0,0,0,0.58)',
              border: '1px solid rgba(255,255,255,0.14)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
            </svg>
          </button>
        )}
      </div>
      <div className="min-w-0">
        <div
          className="truncate text-[18px] md:text-[clamp(14px,1.8dvh,18px)] font-semibold leading-tight tracking-tight"
          style={{ color: isLight ? '#1c1a1c' : '#fff' }}
        >
          {item.subtitle}
        </div>
        <p
          className="mt-0.5 line-clamp-1 text-[11px] md:text-[clamp(9px,1.1dvh,11px)] leading-tight"
          style={{ color: palette.bodyText }}
        >
          {item.description}
        </p>
      </div>
    </div>
  )
}

function SpotlightProjectPanel({
  item,
  active,
}: {
  item: SpotlightItem
  active: boolean
}) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'

  if (item.previewImage) {
    return <SpotlightPreviewProjectPanel item={item} previewImage={item.previewImage} active={active} />
  }

  const accent = isLight ? item.accent.light : item.accent.dark
  const halo = isLight ? item.halo?.light : item.halo?.dark
  const isWideMedia = !!item.iconContain
  const mediaClass = isWideMedia
    ? 'h-[76px] w-[118px] sm:h-[clamp(5rem,11dvh,7rem)] sm:w-[clamp(7.25rem,16dvh,10.5rem)]'
    : 'h-[76px] w-[76px] sm:h-[clamp(5rem,11dvh,7rem)] sm:w-[clamp(5rem,11dvh,7rem)]'

  return (
    <div className="h-full px-3 md:px-[clamp(0.75rem,1.15vw,1rem)] pt-2 md:pt-[clamp(0.35rem,1.0dvh,0.75rem)] pb-2">
      <div
        className="relative h-full min-h-0 overflow-hidden rounded-[14px] p-3.5 sm:p-4 md:p-[clamp(0.9rem,1.7dvh,1.25rem)] flex flex-col justify-between gap-3 sm:gap-4"
        style={{
          background: isLight
            ? 'linear-gradient(135deg, rgba(255,255,255,0.94), rgba(245,247,250,0.92))'
            : 'linear-gradient(135deg, rgba(19,22,28,0.98), rgba(9,10,13,0.98))',
          border: isLight ? '1px solid rgba(0,0,0,0.07)' : '1px solid rgba(255,255,255,0.08)',
          boxShadow: isLight
            ? '0 4px 12px rgba(28,26,28,0.10)'
            : '0 8px 24px rgba(0,0,0,0.34)',
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full"
          style={{ background: `radial-gradient(circle, ${halo ?? 'rgba(255,255,255,0.12)'}, transparent 68%)` }}
        />
        <div className="relative flex items-center gap-3 sm:items-start sm:justify-between sm:gap-4">
          <div
            className={`relative ${mediaClass} flex-shrink-0 overflow-hidden rounded-[18px] sm:rounded-2xl`}
            style={{
              background: isLight ? '#fff' : 'rgba(255,255,255,0.94)',
              border: palette.cardBorder,
              boxShadow: isLight
                ? '0 10px 24px rgba(28,26,28,0.10)'
                : '0 14px 32px rgba(0,0,0,0.32)',
            }}
          >
            {item.icon ? (
              <Image
                src={item.icon}
                alt=""
                fill
                sizes={isWideMedia ? '(max-width: 640px) 118px, 168px' : '(max-width: 640px) 76px, 112px'}
                className={isWideMedia ? 'object-contain p-2' : 'object-cover'}
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1 sm:hidden">
            <div
              className="inline-flex rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em]"
              style={{
                color: accent,
                background: isLight ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.05)',
                border: palette.cardBorder,
              }}
            >
              {item.eyebrow}
            </div>
            <div
              className="mt-2 text-[24px] font-semibold leading-[0.95] tracking-tight"
              style={{ color: isLight ? '#1c1a1c' : '#fff' }}
            >
              {item.title}
            </div>
            <div
              className="mt-1.5 text-[12px] font-semibold leading-tight tracking-tight"
              style={{ color: accent }}
            >
              {item.subtitle}
            </div>
          </div>
          <div
            className="hidden rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] sm:block"
            style={{
              color: accent,
              background: isLight ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.05)',
              border: palette.cardBorder,
            }}
          >
            {item.eyebrow}
          </div>
        </div>

        <div className="relative max-w-[30rem]">
          <div
            className="hidden text-[30px] font-semibold leading-[0.95] tracking-tight sm:block md:text-[clamp(24px,4.2dvh,40px)]"
            style={{ color: isLight ? '#1c1a1c' : '#fff' }}
          >
            {item.title}
          </div>
          <div
            className="mt-2 hidden text-[13px] font-semibold tracking-tight sm:block md:text-[clamp(11px,1.55dvh,14px)]"
            style={{ color: accent }}
          >
            {item.subtitle}
          </div>
          <p
            className="max-w-[42ch] text-[13px] leading-snug sm:mt-2 sm:text-[12px] md:text-[clamp(10px,1.35dvh,13px)]"
            style={{ color: palette.bodyText }}
          >
            {item.description}
          </p>
        </div>

        <div className="relative flex flex-wrap items-center gap-2">
          {item.caseStudyHref ? (
            <Link
              href={item.caseStudyHref}
              tabIndex={active ? undefined : -1}
              className="rounded-[8px] px-3 py-1.5 text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
              style={{
                color: isLight ? '#fff' : '#081012',
                background: accent,
              }}
            >
              Case study
            </Link>
          ) : null}
          {item.href ? (
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={active ? undefined : -1}
              className="rounded-[8px] px-3 py-1.5 text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
              style={{
                color: palette.bodyText,
                background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.07)',
                border: palette.cardBorder,
              }}
            >
              {item.cta ?? 'Open'}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function SpotlightPreviewProjectPanel({
  item,
  previewImage,
  active,
}: {
  item: SpotlightItem
  previewImage: string
  active: boolean
}) {
  const palette = useFieldTheme()
  const isLight = palette.mode === 'light'
  const accent = isLight ? item.accent.light : item.accent.dark
  const halo = isLight ? item.halo?.light : item.halo?.dark

  return (
    <div className="h-full px-3 pb-2 pt-2 md:px-[clamp(0.75rem,1.15vw,1rem)] md:pt-[clamp(0.35rem,1dvh,0.75rem)]">
      <div
        className="relative flex h-full min-h-0 flex-col gap-2.5 overflow-hidden rounded-[14px] p-3 sm:p-3.5"
        style={{
          background: isLight
            ? 'linear-gradient(145deg, rgba(255,255,255,0.96), rgba(245,242,235,0.94))'
            : 'linear-gradient(145deg, rgba(22,23,25,0.99), rgba(8,9,11,0.99))',
          border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.09)',
          boxShadow: isLight
            ? '0 4px 12px rgba(28,26,28,0.1)'
            : '0 8px 24px rgba(0,0,0,0.36)',
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-60 w-60 rounded-full"
          style={{ background: `radial-gradient(circle, ${halo ?? 'rgba(255,255,255,0.12)'}, transparent 68%)` }}
        />

        {item.id === 'epaper-dashboard' ? (
          <div
            data-epaper-product-viewer="true"
            data-epaper-product-poster="true"
            className="relative aspect-[17/7.4] shrink overflow-hidden rounded-[13px] bg-[#b4ab9d] ring-1 ring-inset ring-white/20 shadow-[0_18px_42px_rgba(0,0,0,0.34)] min-[1024px]:[@media(min-height:1180px)]:aspect-[2/1] min-[1024px]:[@media(min-height:1180px)]:shrink-0"
          >
            <Image
              src="/images/epaper-dashboard-studio.webp"
              alt={item.previewAlt ?? ''}
              fill
              priority
              unoptimized
              sizes="(max-width: 640px) 88vw, 42vw"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="relative rounded-[9px] bg-[#111216] p-[5px] shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
            <div className="relative aspect-[17/6] overflow-hidden rounded-[5px] bg-white">
              <Image
                src={previewImage}
                alt={item.previewAlt ?? ''}
                fill
                sizes="(max-width: 640px) 88vw, 38vw"
                className="object-contain"
              />
            </div>
            <span className="absolute bottom-[2px] left-1/2 h-[2px] w-7 -translate-x-1/2 rounded-full bg-white/18" />
          </div>
        )}

        <div className={`relative flex min-h-0 gap-3 ${item.id === 'epaper-dashboard' ? 'grow items-center' : 'items-start'}`}>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-baseline gap-2">
              <div
                className={`truncate font-semibold leading-tight tracking-tight ${item.id === 'epaper-dashboard'
                  ? 'text-[17px] sm:text-[19px] min-[1024px]:[@media(min-height:1180px)]:text-[24px]'
                  : 'text-[17px] sm:text-[19px]'}`}
                style={{ color: isLight ? '#1c1a1c' : '#fff' }}
              >
                {item.title}
              </div>
              <span className="hidden shrink-0 text-[9px] font-semibold uppercase tracking-[0.12em] sm:inline" style={{ color: accent }}>
                {item.eyebrow}
              </span>
            </div>
            {item.id === 'epaper-dashboard' ? (
              <p
                className="mt-1 hidden text-[12px] font-semibold leading-tight min-[1024px]:[@media(min-height:1180px)]:block"
                style={{ color: accent }}
              >
                {item.subtitle}
              </p>
            ) : null}
            <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug sm:text-[11px]" style={{ color: palette.bodyText }}>
              {item.description}
            </p>
          </div>
          {item.caseStudyHref ? (
            <Link
              href={item.caseStudyHref}
              tabIndex={active ? undefined : -1}
              className="shrink-0 rounded-[8px] px-3 py-1.5 text-[10.5px] font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
              style={{ color: isLight ? '#fff' : '#13090a', background: accent }}
            >
              Explore
            </Link>
          ) : null}
        </div>

        {item.id === 'epaper-dashboard' ? (
          <dl
            aria-label="E-paper dashboard specifications"
            className="relative hidden shrink-0 grid-cols-3 overflow-hidden rounded-[10px] min-[1024px]:[@media(min-height:1180px)]:grid"
            style={{
              color: isLight ? '#1c1a1c' : '#fff',
              background: isLight ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.035)',
              border: palette.cardBorder,
            }}
          >
            {[
              { label: 'Display', value: '10.85″', color: '#f87171' },
              { label: 'Canvas', value: '1360 × 480', color: '#67e8f9' },
              { label: 'E-paper', value: '4-color', color: '#facc15' },
            ].map((spec, index) => (
              <div
                key={spec.label}
                className="min-w-0 px-3 py-2.5"
                style={{ borderLeft: index ? palette.cardBorder : undefined }}
              >
                <dt className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.16em]" style={{ color: palette.mutedText }}>
                  <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: spec.color }} />
                  {spec.label}
                </dt>
                <dd className="mt-1 truncate text-[13px] font-semibold tracking-tight">{spec.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </div>
  )
}

function SpotlightRail({
  items,
  activeIndex,
  onSelect,
  isLight,
  border,
  muted,
}: {
  items: SpotlightItem[]
  activeIndex: number
  onSelect: (index: number) => void
  isLight: boolean
  border: string
  muted: string
}) {
  return (
    <div
      className="grid gap-1 px-3 pb-3 sm:gap-1.5"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      role="tablist"
      aria-label="Featured spotlight"
    >
      {items.map((item, index) => {
        const active = index === activeIndex
        const accent = isLight ? item.accent.light : item.accent.dark

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`Show ${item.title}`}
            onClick={(event) => {
              event.stopPropagation()
              haptic('tap')
              onSelect(index)
            }}
            className="min-w-0 rounded-full px-2 sm:px-2.5 py-1.5 text-left focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
            style={{
              color: active ? accent : muted,
              background: active
                ? (isLight ? `${accent}14` : 'rgba(255,255,255,0.07)')
                : (isLight ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.035)'),
              border,
            }}
          >
            <span className="flex min-w-0 items-center gap-1 sm:gap-1.5">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ background: active ? accent : muted }}
              />
              <span className="truncate text-[8px] sm:text-[9px] font-semibold uppercase tracking-[0.08em] sm:tracking-[0.14em]">
                {item.railLabel ?? item.title}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
