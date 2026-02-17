'use client'

import { useEffect, useRef, useState } from 'react'

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

export default function STLViewer({ urls, colors }: { urls: string[]; colors?: number[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    if (!isWebGLAvailable()) {
      setSupported(false)
      return
    }

    const container = containerRef.current
    if (!container) return

    let renderer: import('three').WebGLRenderer
    let animationId: number
    let resumeTimer: ReturnType<typeof setTimeout>

    import('three').then(async (THREE) => {
      const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js')
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')

      const width = container.clientWidth
      const height = container.clientHeight

      // Scene
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0xffffff)

      // Camera
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)

      // Renderer
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true })
      } catch {
        setSupported(false)
        return
      }
      renderer.setSize(width, height)
      renderer.setPixelRatio(window.devicePixelRatio)
      container.appendChild(renderer.domElement)

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
      scene.add(ambientLight)

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
      directionalLight.position.set(1, 1, 1)
      scene.add(directionalLight)

      const backLight = new THREE.DirectionalLight(0xffffff, 0.4)
      backLight.position.set(-1, -1, -1)
      scene.add(backLight)

      // Controls - Solidworks-style:
      // Middle mouse (or left click) = rotate
      // Scroll = zoom
      // Right click = pan
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.1
      controls.enableZoom = true
      controls.enablePan = true
      controls.autoRotateSpeed = 0.8
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.ROTATE,
        RIGHT: THREE.MOUSE.PAN,
      }

      // Load all STL parts
      const loader = new STLLoader()
      const group = new THREE.Group()
      scene.add(group)

      const defaultColors = [0x888888, 0xcccccc]
      let loaded = 0

      urls.forEach((url, i) => {
        loader.load(url, (geometry) => {
          // Center each geometry on its own origin
          geometry.computeBoundingBox()
          const color = colors?.[i] ?? defaultColors[i % defaultColors.length]
          const material = new THREE.MeshPhongMaterial({
            color,
            specular: 0x444444,
            shininess: 60,
          })
          const mesh = new THREE.Mesh(geometry, material)
          group.add(mesh)

          loaded++
          if (loaded === urls.length) {
            // Compute the world bounding box of the full assembly
            const box = new THREE.Box3().setFromObject(group)
            const center = new THREE.Vector3()
            box.getCenter(center)

            // Shift every mesh so the assembly center lands at the origin
            group.children.forEach((child) => {
              child.position.sub(center)
            })

            // Orbit target = origin (now the true center of the model)
            controls.target.set(0, 0, 0)

            // Position camera to fit
            const size = new THREE.Vector3()
            box.getSize(size)
            const maxDim = Math.max(size.x, size.y, size.z)
            camera.position.set(maxDim, maxDim, maxDim)
            controls.update()
          }
        })
      })

      // Auto-rotate the model around its center, pause while user interacts
      let autoRotating = true
      const onPointerDown = () => {
        autoRotating = false
        clearTimeout(resumeTimer)
      }
      const onPointerUp = () => {
        resumeTimer = setTimeout(() => { autoRotating = true }, 3000)
      }
      container.addEventListener('pointerdown', onPointerDown)
      container.addEventListener('pointerup', onPointerUp)

      // Animation loop
      const animate = () => {
        animationId = requestAnimationFrame(animate)
        if (autoRotating) {
          group.rotation.y += 0.003
        }
        controls.update()
        renderer.render(scene, camera)
      }
      animate()

      // Handle resize
      const handleResize = () => {
        const w = container.clientWidth
        const h = container.clientHeight
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
      window.addEventListener('resize', handleResize)
    })

    return () => {
      clearTimeout(resumeTimer)
      if (animationId) cancelAnimationFrame(animationId)
      if (renderer) {
        renderer.dispose()
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement)
        }
      }
    }
  }, [urls, colors])

  if (!supported) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-2xl">
        <img
          src="/images/airpods-tesla-mount.png"
          alt="AirPods Pro 3 Tesla Charger Mount"
          className="w-full h-full object-contain p-4"
        />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full cursor-grab active:cursor-grabbing"
    />
  )
}
