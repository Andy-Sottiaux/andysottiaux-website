'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

type EpaperProductViewerProps = {
  active?: boolean
  compact?: boolean
  dashboardSrc?: string
  dashboardAlt?: string
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

export default function EpaperProductViewer({
  active = true,
  compact = false,
  dashboardSrc = '/images/epaper-dashboard-frame.png',
  dashboardAlt = 'Runner dashboard displayed in a 10.85-inch e-paper enclosure',
}: EpaperProductViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef(active)
  const wakeAnimationRef = useRef<(() => void) | null>(null)
  const [webglReady, setWebglReady] = useState(false)

  useEffect(() => {
    activeRef.current = active
    if (active) wakeAnimationRef.current?.()
  }, [active])

  useEffect(() => {
    const host = hostRef.current
    if (!host || !supportsWebGL()) return

    let cancelled = false
    let animationFrame = 0
    let visible = true
    let renderer: import('three').WebGLRenderer | undefined
    let controls: import('three/examples/jsm/controls/OrbitControls.js').OrbitControls | undefined
    let resizeObserver: ResizeObserver | undefined
    let visibilityObserver: IntersectionObserver | undefined
    let wakeAnimation: (() => void) | undefined
    let renderFrame = () => {}

    void Promise.all([
      import('three'),
      import('three/examples/jsm/controls/OrbitControls.js'),
      import('three/examples/jsm/geometries/RoundedBoxGeometry.js'),
    ]).then(([THREE, { OrbitControls }, { RoundedBoxGeometry }]) => {
      if (cancelled) return

      const width = Math.max(host.clientWidth, 1)
      const height = Math.max(host.clientHeight, 1)
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(compact ? 28 : 31, width / height, 0.1, 100)
      camera.position.set(compact ? 7 : 8.5, compact ? 3.2 : 4.2, compact ? 14.8 : 15.5)

      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      } catch {
        return
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, compact ? 1.5 : 2))
      renderer.setSize(width, height)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.shadowMap.enabled = !compact
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      renderer.domElement.setAttribute('role', 'img')
      renderer.domElement.setAttribute('aria-label', dashboardAlt)
      renderer.domElement.className = 'absolute inset-0 h-full w-full'
      renderer.domElement.style.pointerEvents = compact ? 'none' : 'auto'
      host.appendChild(renderer.domElement)

      const product = new THREE.Group()
      product.rotation.y = -0.12
      // Lift the full-size product above the case-study copy so the enclosure
      // reads as a distinct object instead of becoming a flat background.
      product.position.y = compact ? 0.15 : 1.1
      scene.add(product)

      const enclosureMaterial = new THREE.MeshStandardMaterial({
        color: 0xf5f3ed,
        roughness: 0.78,
        metalness: 0.02,
      })
      const edgeMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a2b2d,
        roughness: 0.68,
        metalness: 0.12,
      })
      const portMaterial = new THREE.MeshStandardMaterial({
        color: 0x17191d,
        roughness: 0.42,
        metalness: 0.45,
      })

      // Display geometry follows the Waveshare panel's 259.76 × 91.68 mm
      // proportions and the slim, frameless desk enclosure used for this build.
      const panel = new THREE.Group()
      panel.position.set(0, 0.65, -0.25)
      panel.rotation.x = -0.075
      product.add(panel)

      const rear = new THREE.Mesh(
        new RoundedBoxGeometry(14.48, 5.48, 0.34, 5, 0.16),
        edgeMaterial,
      )
      rear.castShadow = true
      panel.add(rear)

      const bezel = new THREE.Mesh(
        new RoundedBoxGeometry(14.32, 5.32, 0.32, 5, 0.13),
        enclosureMaterial,
      )
      bezel.position.z = 0.09
      bezel.castShadow = true
      panel.add(bezel)

      const inkBacking = new THREE.Mesh(
        new THREE.PlaneGeometry(13.72, 4.92),
        new THREE.MeshStandardMaterial({ color: 0xd9d7cf, roughness: 0.95 }),
      )
      inkBacking.position.z = 0.265
      panel.add(inkBacking)

      const texture = new THREE.TextureLoader().load(dashboardSrc, () => {
        if (!cancelled) {
          setWebglReady(true)
          // Reduced-motion mode is event-driven, so the initial render may
          // predate the asynchronous texture upload. Invalidate it explicitly.
          queueMicrotask(() => {
            if (!cancelled) renderFrame()
          })
        }
      })
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
      const inkMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.94,
        metalness: 0,
      })
      const ink = new THREE.Mesh(new THREE.PlaneGeometry(13.6, 4.8), inkMaterial)
      ink.position.z = 0.275
      panel.add(ink)

      const base = new THREE.Mesh(
        new RoundedBoxGeometry(15.1, 0.92, 2.72, 6, 0.22),
        enclosureMaterial,
      )
      base.position.set(0, -2.43, 0.3)
      base.castShadow = true
      base.receiveShadow = true
      product.add(base)

      const frontLip = new THREE.Mesh(
        new RoundedBoxGeometry(15.22, 0.48, 0.5, 5, 0.15),
        enclosureMaterial,
      )
      frontLip.position.set(0, -2.08, 1.15)
      frontLip.castShadow = true
      product.add(frontLip)

      const groove = new THREE.Mesh(
        new RoundedBoxGeometry(14.6, 0.16, 0.22, 3, 0.07),
        edgeMaterial,
      )
      groove.position.set(0, -1.84, 0.16)
      product.add(groove)

      const usbPort = new THREE.Mesh(
        new RoundedBoxGeometry(0.72, 0.3, 0.12, 4, 0.08),
        portMaterial,
      )
      usbPort.position.set(4.65, -2.43, 1.68)
      product.add(usbPort)

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(38, 24),
        new THREE.ShadowMaterial({ color: 0x1d1812, opacity: compact ? 0.08 : 0.17 }),
      )
      floor.rotation.x = -Math.PI / 2
      floor.position.y = product.position.y - 2.93
      floor.receiveShadow = true
      scene.add(floor)

      scene.add(new THREE.HemisphereLight(0xfffdf8, 0x68625b, compact ? 2.2 : 1.8))
      const key = new THREE.DirectionalLight(0xffffff, compact ? 2.4 : 2.8)
      key.position.set(-6, 11, 12)
      key.castShadow = !compact
      key.shadow.mapSize.set(1024, 1024)
      scene.add(key)
      const rim = new THREE.DirectionalLight(0xffe5bd, 1.15)
      rim.position.set(10, 3, -9)
      scene.add(rim)

      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.075
      controls.enablePan = false
      controls.enableRotate = !compact
      controls.enableZoom = !compact
      controls.minDistance = compact ? 8 : 10
      controls.maxDistance = compact ? 20 : 27
      controls.minPolarAngle = Math.PI * 0.27
      controls.maxPolarAngle = Math.PI * 0.62
      controls.minAzimuthAngle = -Math.PI * 0.34
      controls.maxAzimuthAngle = Math.PI * 0.34
      controls.target.set(0, compact ? 0.25 : -0.25, 0)
      // Preserve vertical page scrolling on touchscreens. The compact carousel
      // is presentation-only; the full viewer still supports mouse/pen orbit.
      renderer.domElement.style.touchAction = 'pan-y'

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      controls.autoRotate = activeRef.current && !reducedMotion
      controls.autoRotateSpeed = compact ? 0.28 : 0.38

      renderFrame = () => {
        if (visible && renderer) renderer.render(scene, camera)
      }
      if (reducedMotion) {
        controls.addEventListener('change', renderFrame)
        controls.update()
        renderFrame()
      } else {
        const clock = new THREE.Clock()
        let lastPaint = 0
        let animationRunning = false
        const animate = (time: number) => {
          if (cancelled || !visible || !activeRef.current) {
            animationRunning = false
            return
          }
          animationFrame = window.requestAnimationFrame(animate)
          const delta = clock.getDelta()
          if (!renderer || time - lastPaint < 32) return
          lastPaint = time
          if (controls) controls.autoRotate = true
          controls?.update(delta)
          renderer.render(scene, camera)
        }
        wakeAnimation = () => {
          if (cancelled || animationRunning || !visible || !activeRef.current) return
          animationRunning = true
          clock.start()
          animationFrame = window.requestAnimationFrame(animate)
        }
        wakeAnimationRef.current = wakeAnimation
        wakeAnimation()
      }

      resizeObserver = new ResizeObserver(() => {
        if (!renderer) return
        const nextWidth = Math.max(host.clientWidth, 1)
        const nextHeight = Math.max(host.clientHeight, 1)
        camera.aspect = nextWidth / nextHeight
        camera.updateProjectionMatrix()
        renderer.setSize(nextWidth, nextHeight)
        renderFrame()
      })
      resizeObserver.observe(host)

      visibilityObserver = new IntersectionObserver(([entry]) => {
        visible = entry?.isIntersecting ?? true
        if (visible) wakeAnimation?.()
      })
      visibilityObserver.observe(host)

      const cleanupScene = () => {
        controls?.removeEventListener('change', renderFrame)
        scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material.dispose())
        })
        texture.dispose()
      }
      ;(host as HTMLDivElement & { __epaperCleanup?: () => void }).__epaperCleanup = cleanupScene
    })

    return () => {
      cancelled = true
      if (wakeAnimationRef.current === wakeAnimation) wakeAnimationRef.current = null
      setWebglReady(false)
      window.cancelAnimationFrame(animationFrame)
      resizeObserver?.disconnect()
      visibilityObserver?.disconnect()
      controls?.dispose()
      const cleanupHost = host as HTMLDivElement & { __epaperCleanup?: () => void }
      cleanupHost.__epaperCleanup?.()
      delete cleanupHost.__epaperCleanup
      if (renderer) {
        renderer.dispose()
        renderer.forceContextLoss()
        if (host.contains(renderer.domElement)) host.removeChild(renderer.domElement)
      }
    }
  }, [compact, dashboardAlt, dashboardSrc])

  return (
    <div
      ref={hostRef}
      data-epaper-product-viewer="true"
      className="relative h-full w-full overflow-hidden bg-[#d9d2c5]"
    >
      <div aria-hidden="true" className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(25,22,18,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(25,22,18,.07)_1px,transparent_1px)] [background-size:32px_32px]" />
      <div
        aria-hidden={webglReady}
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${webglReady ? 'opacity-0' : 'opacity-100'}`}
      >
        <div className={`relative w-[88%] ${compact ? 'max-w-[620px]' : 'max-w-[1050px]'}`}>
          <div className="relative z-10 rounded-[10px] bg-[#f4f2ec] p-[5px] shadow-[0_24px_58px_rgba(24,20,16,0.3)] sm:p-2">
            <div className="relative aspect-[17/6] overflow-hidden rounded-[4px] bg-white">
              <Image src={dashboardSrc} alt={webglReady ? '' : dashboardAlt} fill sizes={compact ? '42vw' : '90vw'} className="object-contain" />
            </div>
          </div>
          <div aria-hidden="true" className="mx-auto h-4 w-[96%] rounded-b-[11px] bg-[#ece9e2] shadow-[0_12px_20px_rgba(24,20,16,0.18)] sm:h-7" />
        </div>
      </div>
      {!compact ? (
        <div className="pointer-events-none absolute bottom-4 right-5 rounded-full border border-[#17191d]/15 bg-white/55 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#17191d]/65 backdrop-blur-sm">
          Drag to inspect · scroll to zoom
        </div>
      ) : null}
    </div>
  )
}
