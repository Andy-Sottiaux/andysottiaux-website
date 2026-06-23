'use client'

import type { FieldCameraSource } from '@/lib/fieldCameraConfig'

export default function CameraSourceToggle({
  value,
  onChange,
  isLight,
  compact = false,
}: {
  value: FieldCameraSource
  onChange: (value: FieldCameraSource) => void
  isLight: boolean
  compact?: boolean
}) {
  return (
    <fieldset
      aria-label="Camera source"
      className={`${compact ? 'h-7 text-[10px]' : 'h-8 text-[10.5px]'} m-0 grid min-w-0 grid-cols-2 overflow-hidden rounded-full border-0 p-0.5 font-semibold uppercase`}
      style={{
        background: isLight ? 'rgba(28,26,28,0.08)' : 'rgba(255,255,255,0.1)',
        color: isLight ? 'rgba(28,26,28,0.66)' : 'rgba(255,255,255,0.64)',
      }}
    >
      {[
        ['field', 'Cam 1'],
        ['thingino', 'Cam 2'],
      ].map(([id, label]) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(id as FieldCameraSource)}
            className={`${compact ? 'min-w-[56px] px-2.5' : 'min-w-[64px] px-3'} rounded-full transition`}
            style={{
              background: active
                ? isLight ? '#fff' : 'rgba(255,255,255,0.18)'
                : 'transparent',
              color: active
                ? isLight ? '#0a5f72' : '#e0fbff'
                : undefined,
              boxShadow: active && isLight ? '0 1px 4px rgba(28,26,28,0.1)' : undefined,
            }}
          >
            {label}
          </button>
        )
      })}
    </fieldset>
  )
}
