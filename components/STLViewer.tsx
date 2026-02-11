'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js'

export default function STLViewer({ urls, colors }: { urls: string[]; colors?: number[] }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xffffff)

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
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

    // Controls - TrackballControls allows full free rotation
    const controls = new TrackballControls(camera, renderer.domElement)
    controls.rotateSpeed = 3.0
    controls.zoomSpeed = 1.2
    controls.panSpeed = 0.8
    controls.dynamicDampingFactor = 0.15
    controls.noPan = false
    controls.noZoom = false
    controls.noRotate = false

    // Load all STL parts
    const loader = new STLLoader()
    const group = new THREE.Group()
    scene.add(group)

    const defaultColors = [0x888888, 0xcccccc]
    let loaded = 0

    urls.forEach((url, i) => {
      loader.load(url, (geometry) => {
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
          // Center the entire group
          const box = new THREE.Box3().setFromObject(group)
          const center = new THREE.Vector3()
          box.getCenter(center)
          group.position.sub(center)

          // Position camera to fit - front/side view
          const size = new THREE.Vector3()
          box.getSize(size)
          const maxDim = Math.max(size.x, size.y, size.z)
          camera.position.set(maxDim * 0.3, maxDim * 0.5, maxDim * 1.2)
          camera.lookAt(0, 0, 0)
          controls.target.set(0, 0, 0)
          controls.update()
        }
      })
    })

    // Auto-rotate the group
    let autoRotating = true
    const onPointerDown = () => { autoRotating = false }
    const onPointerUp = () => {
      setTimeout(() => { autoRotating = true }, 3000)
    }
    container.addEventListener('pointerdown', onPointerDown)
    container.addEventListener('pointerup', onPointerUp)

    // Animation loop
    let animationId: number
    const animate = () => {
      animationId = requestAnimationFrame(animate)
      if (autoRotating) {
        group.rotation.y += 0.005
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
      controls.handleResize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      container.removeEventListener('pointerdown', onPointerDown)
      container.removeEventListener('pointerup', onPointerUp)
      cancelAnimationFrame(animationId)
      controls.dispose()
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [urls, colors])

  return (
    <div
      ref={containerRef}
      className="w-full h-full cursor-grab active:cursor-grabbing"
    />
  )
}
