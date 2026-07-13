"use client"

import { Canvas, useFrame } from "@react-three/fiber"
import { useRef } from "react"
import { Mesh } from "three"

function Orb() {
  const ref = useRef<Mesh | null>(null)
  useFrame((state, delta) => {
    if (ref.current) {
      // slightly faster rotation so it's visibly animated
      ref.current.rotation.y += delta * 1.0
      ref.current.rotation.x += delta * 0.15
      ref.current.rotation.z += Math.sin(state.clock.elapsedTime / 4) * 0.02
      // subtle bobbing (y-axis) for a livelier effect
      ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.12
    }
  })

  return (
    <mesh ref={ref} position={[0, 0, 0]}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial emissive={"#c6a15b"} emissiveIntensity={0.6} roughness={0.3} metalness={0.2} />
    </mesh>
  )
}

export default function ThreeOrb({ size = 420 }: { size?: number }) {
  return (
    <div className="pointer-events-none -z-10" aria-hidden={true}>
      {/* slightly brighter and more visible orb for better contrast on dark headers */}
      <div style={{ width: size, height: size }} className="opacity-40">
        <Canvas camera={{ position: [0, 0, 4], fov: 50 }} dpr={[1, 1.5]}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={0.6} />
          <Orb />
        </Canvas>
      </div>
    </div>
  )
}
