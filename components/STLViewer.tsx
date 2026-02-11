'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export default function STLViewer({ url }: { url: string }) {
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

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.1
    controls.enableZoom = true
    controls.autoRotate = true
    controls.autoRotateSpeed = 2

    // Load STL
    const loader = new STLLoader()
    loader.load(url, (geometry) => {
      const material = new THREE.MeshPhongMaterial({
        color: 0x888888,
        specular: 0x444444,
        shininess: 60,
      })
      const mesh = new THREE.Mesh(geometry, material)

      // Center the model
      geometry.computeBoundingBox()
      const box = geometry.boundingBox!
      const center = new THREE.Vector3()
      box.getCenter(center)
      mesh.position.sub(center)

      scene.add(mesh)

      // Position camera to fit model
      const size = new THREE.Vector3()
      box.getSize(size)
      const maxDim = Math.max(size.x, size.y, size.z)
      camera.position.set(maxDim, maxDim, maxDim)
      controls.target.set(0, 0, 0)
      controls.update()
    })

    // Animation loop
    let animationId: number
    const animate = () => {
      animationId = requestAnimationFrame(animate)
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

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationId)
      controls.dispose()
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [url])

  return (
    <div
      ref={containerRef}
      className="w-full h-full cursor-grab active:cursor-grabbing"
    />
  )
}
