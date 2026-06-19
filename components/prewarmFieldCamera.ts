let prewarmStarted = false

export function prewarmFieldCameraSurface() {
  if (typeof window === 'undefined' || prewarmStarted) return
  prewarmStarted = true

  void import('./CameraFeedSwitcher')
    .catch(() => {
      prewarmStarted = false
    })
}
