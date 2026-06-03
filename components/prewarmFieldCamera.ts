import { CAMERA_HOST, PLAYER_SCRIPT_URL, SNAPSHOT_URL } from '@/lib/fieldCameraConfig'

let prewarmStarted = false

export function prewarmFieldCameraSurface() {
  if (typeof window === 'undefined' || prewarmStarted) return
  prewarmStarted = true

  preconnectCameraHost()
  preloadSnapshot()

  void import('./FieldCameraFeed')
    .then((module) => module.prewarmFieldCameraFeed())
    .catch(() => {
      prewarmStarted = false
    })
}

function preconnectCameraHost() {
  const rels: Array<'preconnect' | 'dns-prefetch'> = ['preconnect', 'dns-prefetch']

  for (const rel of rels) {
    const existing = document.querySelector(`link[data-field-camera="${rel}"]`)
    if (existing) continue

    const link = document.createElement('link')
    link.rel = rel
    link.href = CAMERA_HOST
    link.dataset.fieldCamera = rel
    if (rel === 'preconnect') link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  }
}

function preloadSnapshot() {
  const image = new Image()
  image.decoding = 'async'
  image.src = `${SNAPSHOT_URL}?v=${Date.now()}`
}

export function prewarmFieldCameraPlayerScript() {
  if (typeof document === 'undefined') return

  const existing = document.querySelector('link[data-field-camera="player-script"]')
  if (existing) return

  const link = document.createElement('link')
  link.rel = 'modulepreload'
  link.href = PLAYER_SCRIPT_URL
  link.crossOrigin = 'anonymous'
  link.dataset.fieldCamera = 'player-script'
  document.head.appendChild(link)
}
