import { VideoRTC } from '/api/go2rtc/video-rtc.js'

class FieldVideoStream extends VideoRTC {
  constructor() {
    super()
    this.selectedMode = 'loading'
  }

  emitState(detail) {
    this.dispatchEvent(new CustomEvent('field-stream-state', { detail, bubbles: true }))
  }

  setMode(mode) {
    this.selectedMode = mode
    this.dataset.mode = mode
    this.emitState({ phase: 'live', mode })
  }

  setError(error) {
    if (this.selectedMode !== 'loading') return
    this.dataset.error = error
    this.emitState({ phase: 'offline', error })
  }

  oninit() {
    super.oninit()

    this.style.display = 'block'
    this.style.width = '100%'
    this.style.height = '100%'
    this.style.minWidth = '0'
    this.style.background = '#000'

    this.video.controls = false
    this.video.autoplay = true
    this.video.muted = true
    this.video.playsInline = true
    this.video.style.width = '100%'
    this.video.style.height = '100%'
    this.video.style.objectFit = this.getAttribute('fit') || 'cover'
    this.video.style.objectPosition = this.getAttribute('position') || 'center center'
    this.video.style.background = '#000'
  }

  onconnect() {
    const result = super.onconnect()
    if (result) {
      this.selectedMode = 'loading'
      this.emitState({ phase: 'connecting', mode: 'loading' })
    }
    return result
  }

  onopen() {
    const modes = super.onopen()

    this.onmessage.stream = (msg) => {
      switch (msg.type) {
        case 'error':
          this.setError(msg.value)
          break
        case 'mse':
        case 'hls':
        case 'mp4':
        case 'mjpeg':
          this.setMode(msg.type.toUpperCase())
          break
        default:
          break
      }
    }

    this.emitState({ phase: 'connecting', mode: modes.join(',') || 'open' })
    return modes
  }

  onclose() {
    const result = super.onclose()
    if (result) {
      this.emitState({ phase: 'offline' })
    }
    return result
  }

  onpcvideo(video) {
    super.onpcvideo(video)

    if (this.pcState !== WebSocket.CLOSED) {
      this.setMode('RTC')
    }
  }
}

if (!customElements.get('field-video-stream')) {
  customElements.define('field-video-stream', FieldVideoStream)
}
