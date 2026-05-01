'use client'

/**
 * BoardViewer — interactive 3D Luckfox Pico Pi A W with hover/click annotations.
 *
 * Loads /luckfox-pico-pi.glb (decimated from the manufacturer STEP).
 * Annotations are positioned in 3D world-space relative to the model and
 * projected to screen-space each frame, so they stay anchored as the
 * camera orbits.
 */

import { useEffect, useRef, useState } from 'react'

type Annotation = {
  id: string
  label: string
  detail: string
  // Position in model local-space (meters, after the model is normalized).
  pos: [number, number, number]
}

const ANNOTATIONS: Annotation[] = [
  { id: 'soc',    label: 'RV1106G3 SoC',     detail: 'ARM Cortex-A7 @ 1.2 GHz · 1 TOPS NPU · ISP + H.265 encoder', pos: [-0.20, 0.04,  0.05] },
  { id: 'wifi',   label: 'AIC8800DC',        detail: 'WiFi 6 + Bluetooth 5.2 · SDIO bus · 2.4 GHz 1×1',            pos: [-0.04, 0.04,  0.30] },
  { id: 'lte',    label: 'M.2 LTE slot',      detail: 'SIM7600G-H · LTE Cat-4 · backup network path',              pos: [ 0.30, 0.02, -0.05] },
  { id: 'cam',    label: 'MIPI-CSI camera',   detail: 'MIS5001 · 5 MP · H.265 hardware encoded',                   pos: [-0.32, 0.04, -0.18] },
  { id: 'usb',    label: 'USB-C (DRD)',       detail: 'ADB / power · dual-role · peripheral or host',              pos: [ 0.32, 0.04,  0.20] },
  { id: 'led',    label: 'Status LEDs',       detail: 'Power · Heartbeat · NET · all kernel-controllable',         pos: [ 0.10, 0.05, -0.30] },
]

export default function BoardViewer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    const overlay = overlayRef.current
    if (!container || !overlay) return

    let disposed = false
    let animationId: number
    type Cleanup = () => void
    const cleanups: Cleanup[] = []

    ;(async () => {
      try {
        const THREE = await import('three')
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')

        // Wait for the container to have non-zero dimensions. On mobile
        // Safari, aspect-ratio sometimes resolves after the first paint,
        // so reading clientWidth/Height immediately gives 0×0.
        const waitForSize = (): Promise<{ w: number; h: number }> =>
          new Promise((resolve) => {
            const tryRead = () => {
              const w = container.clientWidth
              const h = container.clientHeight
              if (w > 0 && h > 0) return resolve({ w, h })
              requestAnimationFrame(tryRead)
            }
            tryRead()
          })
        const { w: width, h: height } = await waitForSize()
        if (disposed) return

        const scene = new THREE.Scene()
        scene.background = null  // transparent — let the page gradient show

        // Soft studio lighting (Apple-product style)
        const key = new THREE.DirectionalLight(0xffffff, 2.4)
        key.position.set(2, 3, 4)
        scene.add(key)
        const fill = new THREE.DirectionalLight(0xa8c8ff, 0.9)
        fill.position.set(-3, 1, -2)
        scene.add(fill)
        const rim = new THREE.DirectionalLight(0x30d158, 0.7)
        rim.position.set(0, -2, -3)
        scene.add(rim)
        const ambient = new THREE.AmbientLight(0xffffff, 0.55)
        scene.add(ambient)
        // Hemisphere fill for natural sky/ground gradient — gives the
        // model legible shape under any rotation, especially on mobile
        // where MSAA is off and dark areas otherwise crush.
        const hemi = new THREE.HemisphereLight(0xb8e8d4, 0x1a3325, 0.9)
        scene.add(hemi)
        // Camera-mounted "head-light" — moves with the user's view so
        // whatever they're looking at is always lit. Strongest mobile
        // legibility win.
        const headLight = new THREE.PointLight(0xffffff, 1.4, 10, 1.4)
        scene.add(headLight)

        const camera = new THREE.PerspectiveCamera(35, width / height, 0.01, 100)
        camera.position.set(0.9, 0.7, 0.9)

        // Mobile-friendly renderer setup: lower DPR cap saves a lot of
        // GPU memory on phones (where WebGL contexts are tight).
        const isMobile = /android|iphone|ipad/i.test(navigator.userAgent) || window.innerWidth < 720
        let renderer: import('three').WebGLRenderer
        try {
          renderer = new THREE.WebGLRenderer({
            antialias: !isMobile,    // skip MSAA on mobile (saves GPU memory)
            alpha: true,
            powerPreference: 'default',
          })
        } catch (err) {
          console.error('WebGL init failed', err)
          setError('WebGL not available on this browser.')
          setLoading(false)
          return
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2))
        renderer.setSize(width, height)
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.05
        container.appendChild(renderer.domElement)
        cleanups.push(() => {
          renderer.dispose()
          if (renderer.domElement.parentElement === container) {
            container.removeChild(renderer.domElement)
          }
        })

        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.08
        controls.enablePan = false
        controls.minDistance = 0.5
        controls.maxDistance = 3
        controls.minPolarAngle = Math.PI * 0.15
        controls.maxPolarAngle = Math.PI * 0.75
        // Touch controls — three's OrbitControls supports touch by default,
        // but we explicitly map to Apple-style gestures: one-finger orbit,
        // two-finger pinch zoom (no rotate-about-Z).
        controls.touches = {
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }
        // On the canvas, prevent default touchmove to disable page scroll
        // capture while interacting with the model.
        renderer.domElement.style.touchAction = 'none'
        cleanups.push(() => controls.dispose())

        const loader = new GLTFLoader()
        loader.load(
          '/luckfox-pico-pi.glb',
          (gltf) => {
            if (disposed) return
            const model = gltf.scene

            // Material override — Apple-product look. Brighter PCB green
            // with a subtle clearcoat sheen so it reads against the dark
            // background.
            //
            // CRITICAL: trimesh's quadric decimation drops vertex normals.
            // Without normals, lighting calculations return ~0 and the
            // model renders nearly black. Recompute them after load.
            model.traverse((child: import('three').Object3D) => {
              const mesh = child as import('three').Mesh
              if ((mesh as import('three').Mesh).isMesh) {
                if (mesh.geometry) {
                  mesh.geometry.computeVertexNormals()
                }
                const mat = new THREE.MeshStandardMaterial({
                  color: new THREE.Color('#5fc78f'),
                  metalness: 0.35,
                  roughness: 0.42,
                  emissive: new THREE.Color('#1a4a30'),
                  emissiveIntensity: 0.55,
                })
                mesh.material = mat
                mesh.castShadow = true
                mesh.receiveShadow = true
              }
            })

            // Center + scale model
            const box = new THREE.Box3().setFromObject(model)
            const size = new THREE.Vector3()
            box.getSize(size)
            const scale = 0.7 / Math.max(size.x, size.y, size.z)
            model.scale.setScalar(scale)
            const center = new THREE.Vector3()
            box.getCenter(center)
            model.position.sub(center.multiplyScalar(scale))

            scene.add(model)
            setLoading(false)
          },
          (xhr: ProgressEvent) => {
            // optional progress
            void xhr
          },
          (err: unknown) => {
            console.error('GLB load error', err)
            setError('Could not load 3D model.')
            setLoading(false)
          },
        )

        // Annotation projection — runs each frame to keep DOM labels anchored
        type Hot = { ann: Annotation; el: HTMLDivElement; vec: import('three').Vector3 }
        const hots: Hot[] = ANNOTATIONS.map((ann) => {
          const el = document.createElement('div')
          el.className = 'board-hotspot'
          el.dataset.id = ann.id
          el.innerHTML = `
            <button class="hotspot-dot" aria-label="${ann.label}"></button>
            <div class="hotspot-card">
              <div class="hotspot-label">${ann.label}</div>
              <div class="hotspot-detail">${ann.detail}</div>
            </div>
          `
          el.addEventListener('mouseenter', () => setActive(ann.id))
          el.addEventListener('mouseleave', () => setActive((a) => (a === ann.id ? null : a)))
          el.addEventListener('click', () => setActive((a) => (a === ann.id ? null : ann.id)))
          overlay.appendChild(el)
          return { ann, el, vec: new THREE.Vector3(...ann.pos) }
        })
        cleanups.push(() => hots.forEach((h) => h.el.remove()))

        // Auto-orbit on idle for ambient liveness
        let lastInteraction = performance.now()
        const onInteract = () => { lastInteraction = performance.now() }
        controls.addEventListener('start', onInteract)
        cleanups.push(() => controls.removeEventListener('start', onInteract))

        const tmpVec = new THREE.Vector3()
        const animate = () => {
          if (disposed) return
          animationId = requestAnimationFrame(animate)

          // Idle slow-orbit
          const idleFor = (performance.now() - lastInteraction) / 1000
          if (idleFor > 3) {
            const r = Math.hypot(camera.position.x, camera.position.z)
            const a = Math.atan2(camera.position.z, camera.position.x) + 0.0006
            camera.position.x = r * Math.cos(a)
            camera.position.z = r * Math.sin(a)
            camera.lookAt(0, 0, 0)
          }

          // Head-light follows the camera — whatever the user is looking
          // at is always front-lit.
          headLight.position.copy(camera.position)

          controls.update()
          renderer.render(scene, camera)

          // Project annotations
          const w = container.clientWidth, h = container.clientHeight
          for (const hot of hots) {
            tmpVec.copy(hot.vec).project(camera)
            const x = (tmpVec.x * 0.5 + 0.5) * w
            const y = (-tmpVec.y * 0.5 + 0.5) * h
            const visible = tmpVec.z < 1
            hot.el.style.transform = `translate3d(${x}px, ${y}px, 0)`
            hot.el.style.opacity = visible ? '1' : '0'
            hot.el.style.pointerEvents = visible ? 'auto' : 'none'
          }
        }
        animate()

        // Resize
        const onResize = () => {
          if (!container) return
          const w = container.clientWidth, h = container.clientHeight
          camera.aspect = w / h
          camera.updateProjectionMatrix()
          renderer.setSize(w, h)
        }
        const ro = new ResizeObserver(onResize)
        ro.observe(container)
        cleanups.push(() => ro.disconnect())

      } catch (err) {
        console.error(err)
        setError('Three.js failed to initialize.')
        setLoading(false)
      }
    })()

    return () => {
      disposed = true
      cancelAnimationFrame(animationId)
      cleanups.forEach((c) => c())
    }
  }, [])

  // Update active hotspot styles
  useEffect(() => {
    overlayRef.current?.querySelectorAll<HTMLDivElement>('.board-hotspot').forEach((el) => {
      el.classList.toggle('active', el.dataset.id === active)
    })
  }, [active])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0" />
      <div ref={overlayRef} className="absolute inset-0 pointer-events-none" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm tracking-tight">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Loading model…
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-400/80 text-sm">
          {error}
        </div>
      )}

      <style jsx global>{`
        .board-hotspot {
          position: absolute;
          top: 0;
          left: 0;
          width: 0;
          height: 0;
          will-change: transform, opacity;
          transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .hotspot-dot {
          position: absolute;
          left: -8px;
          top: -8px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: rgba(48, 209, 88, 0.95);
          border: 2px solid rgba(255, 255, 255, 0.95);
          box-shadow: 0 0 0 0 rgba(48, 209, 88, 0.5),
                      0 4px 14px rgba(0, 0, 0, 0.4);
          cursor: pointer;
          padding: 0;
          pointer-events: auto;
          animation: hotspotPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
                      background 0.2s;
        }
        @keyframes hotspotPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(48, 209, 88, 0.5), 0 4px 14px rgba(0,0,0,0.4); }
          50%      { box-shadow: 0 0 0 12px rgba(48, 209, 88, 0), 0 4px 14px rgba(0,0,0,0.4); }
        }
        .hotspot-dot:hover { transform: scale(1.25); }
        .board-hotspot.active .hotspot-dot { transform: scale(1.4); background: #fff; }
        .hotspot-card {
          position: absolute;
          left: 14px;
          top: -14px;
          background: rgba(20, 20, 22, 0.78);
          backdrop-filter: saturate(180%) blur(20px);
          -webkit-backdrop-filter: saturate(180%) blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.10);
          border-radius: 10px;
          padding: 8px 12px;
          min-width: 180px;
          opacity: 0;
          transform: translate3d(-6px, 0, 0);
          transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1),
                      transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          pointer-events: none;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
        }
        .board-hotspot:hover .hotspot-card,
        .board-hotspot.active .hotspot-card {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
        .hotspot-label {
          color: #30d158;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .hotspot-detail {
          color: #f5f5f7;
          font-size: 12.5px;
          margin-top: 3px;
          letter-spacing: -0.005em;
          line-height: 1.45;
        }
      `}</style>
    </div>
  )
}
