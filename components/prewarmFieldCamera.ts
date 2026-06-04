import { SNAPSHOT_URL } from '@/lib/fieldCameraConfig'

let prewarmStarted = false

export function prewarmFieldCameraSurface() {
  if (typeof window === 'undefined' || prewarmStarted) return
  prewarmStarted = true

  preloadSnapshot()

  void import('./FieldCameraFeed')
    .then((module) => module.prewarmFieldCameraFeed())
    .catch(() => {
      prewarmStarted = false
    })
}

function preloadSnapshot() {
  const image = new Image()
  image.decoding = 'async'
  image.src = `${SNAPSHOT_URL}?v=${Date.now()}`
}
