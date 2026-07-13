"use client"

import { useEffect, useRef } from "react"

/**
 * Creative "Nothing & Something" Parallax Particle Background.
 * - Nothing particles (Gold): Repelled by the mouse cursor, representing deconstruction/void.
 * - Something particles (Emerald/Rose): Attracted by the mouse, representing cohesion/cooperation.
 * - Faint geometric networks (constellations) form between Something particles when they cluster.
 * - Three depth layers drifting at different scroll parallax speeds.
 * - Smooth dampening physics.
 */
export function LandingBg() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf: number
    const mouse = { x: -9999, y: -9999 }
    let scrollY = 0
    let smoothedScrollY = 0
    let W = 0
    let H = 0
    let pageH = 1

    // Shockwave structure for tactile clicks
    interface Shockwave {
      x: number
      y: number
      scrollYAtClick: number
      radius: number
      maxRadius: number
      force: number
      age: number
    }
    const shockwaves: Shockwave[] = []

    // Permanent void craters that keep areas empty of particles
    interface VoidCircle {
      x: number
      y: number
      scrollYAtClick: number
      radius: number
    }
    const voids: VoidCircle[] = []

    // Track scroll velocity for vertical wind tilt
    let lastScrollY = typeof window !== "undefined" ? window.scrollY : 0
    let scrollVelocity = 0

    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      W = window.innerWidth
      H = window.innerHeight
      pageH = Math.max(document.documentElement.scrollHeight, H)
      canvas.width = W * dpr
      canvas.height = H * dpr
      canvas.style.width = W + "px"
      canvas.style.height = H + "px"
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const onResize = () => resize()
    const onScroll = () => {
      const curY = window.scrollY
      scrollVelocity = (curY - lastScrollY) * 0.18
      lastScrollY = curY
      scrollY = curY
      pageH = Math.max(document.documentElement.scrollHeight, H)
    }
    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }
    const onLeave = () => {
      mouse.x = -9999
      mouse.y = -9999
    }
    const onClick = (e: MouseEvent) => {
      shockwaves.push({
        x: e.clientX,
        y: e.clientY,
        scrollYAtClick: smoothedScrollY,
        radius: 0,
        maxRadius: 280,
        force: 6.5,
        age: 0
      })
    }

    window.addEventListener("resize", onResize)
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("mousemove", onMove, { passive: true })
    document.addEventListener("mouseleave", onLeave)
    window.addEventListener("mousedown", onClick, { passive: true })

    // ── Particle System Definition ─────────────────────────────────
    type Particle = {
      x: number // original page X
      y: number // original page Y
      vx: number
      vy: number
      baseR: number
      depth: number // scroll parallax multiplier
      type: "nothing" | "something" | "star"
      color: string
      phase: number
      pulseSpeed: number
      baseAlpha: number
      isEmerald?: boolean
    }

    const particles: Particle[] = []

    // 1. Static Far Stars (background anchor)
    const STAR_COUNT = 180
    for (let i = 0; i < STAR_COUNT; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * pageH,
        vx: (Math.random() - 0.5) * 0.05,
        vy: (Math.random() - 0.5) * 0.05,
        baseR: 0.3 + Math.random() * 0.6,
        depth: 0.18, // moves very slowly
        type: "star",
        color: "rgba(255, 255, 255, 0.4)",
        phase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.005 + Math.random() * 0.01,
        baseAlpha: 0.15 + Math.random() * 0.3,
      })
    }

    // 2. Nothing Particles (Gold - Repelled by cursor)
    const NOTHING_COUNT = 110
    for (let i = 0; i < NOTHING_COUNT; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * pageH,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        baseR: 0.8 + Math.random() * 1.2,
        depth: 0.45, // medium parallax
        type: "nothing",
        color: "rgba(227, 194, 122, ", // partial string for opacity injection
        phase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.01 + Math.random() * 0.02,
        baseAlpha: 0.2 + Math.random() * 0.4,
      })
    }

    // 3. Something Particles (Emerald/Rose - Attracted to cursor & linkable)
    const SOMETHING_COUNT = 85
    for (let i = 0; i < SOMETHING_COUNT; i++) {
      const isEmerald = Math.random() > 0.4
      particles.push({
        x: Math.random() * W,
        y: Math.random() * pageH,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        baseR: 1.2 + Math.random() * 1.5,
        depth: 0.72, // fast parallax
        type: "something",
        color: isEmerald ? "rgba(52, 211, 153, " : "rgba(244, 114, 182, ",
        phase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.012 + Math.random() * 0.025,
        baseAlpha: 0.25 + Math.random() * 0.45,
        isEmerald,
      })
    }

    // Nebula background spots
    const nebulae = [
      { xFrac: 0.15, yAbs: 300, r: 450, color: [227, 194, 122], a: 0.025, parallax: 0.1 },
      { xFrac: 0.85, yAbs: 800, r: 400, color: [244, 114, 182], a: 0.018, parallax: 0.15 },
      { xFrac: 0.35, yAbs: 1500, r: 500, color: [52, 211, 153], a: 0.022, parallax: 0.08 },
      { xFrac: 0.75, yAbs: 2400, r: 420, color: [227, 194, 122], a: 0.015, parallax: 0.12 },
      { xFrac: 0.25, yAbs: 3400, r: 380, color: [244, 114, 182], a: 0.012, parallax: 0.18 },
    ]

    const MOUSE_RADIUS = 220
    let tiltX = 0
    let tiltY = 0

    const tick = () => {
      ctx.clearRect(0, 0, W, H)

      // Interpolate scroll smoothly towards target scrollY
      smoothedScrollY += (scrollY - smoothedScrollY) * 0.16

      // Calculate smooth mouse depth tilt
      if (mouse.x > -1000 && mouse.y > -1000) {
        const targetTiltX = ((mouse.x - W / 2) / (W / 2)) * 14
        const targetTiltY = ((mouse.y - H / 2) / (H / 2)) * 14
        tiltX += (targetTiltX - tiltX) * 0.08
        tiltY += (targetTiltY - tiltY) * 0.08
      } else {
        tiltX += (0 - tiltX) * 0.08
        tiltY += (0 - tiltY) * 0.08
      }

      // Decay scroll velocity smoothly
      scrollVelocity *= 0.93

      // Update active shockwaves
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i]
        sw.radius += 8.5
        sw.force *= 0.94
        if (sw.radius > sw.maxRadius || sw.force < 0.02) {
          // Convert decayed shockwave to a permanent void zone
          voids.push({
            x: sw.x,
            y: sw.y,
            scrollYAtClick: sw.scrollYAtClick,
            radius: sw.maxRadius * 0.7
          })
          shockwaves.splice(i, 1)
        }
      }

      // ── Draw nebulae with parallax ────────────────────────────────
      for (const n of nebulae) {
        const px = n.xFrac * W
        const py = n.yAbs - smoothedScrollY * (1 - n.parallax)
        if (py > -n.r && py < H + n.r) {
          const grd = ctx.createRadialGradient(px, py, 0, px, py, n.r)
          grd.addColorStop(0, `rgba(${n.color[0]},${n.color[1]},${n.color[2]},${n.a})`)
          grd.addColorStop(1, "transparent")
          ctx.beginPath()
          ctx.arc(px, py, n.r, 0, Math.PI * 2)
          ctx.fillStyle = grd
          ctx.fill()
        }
      }

      // Every void heals/shrinks slowly on every frame to create a self-healing cosmic dust effect
      for (const vd of voids) {
        vd.radius -= 0.08
      }

      // Maintain maximum voids to prevent the screen from emptying completely
      const MAX_VOIDS = 5
      if (voids.length > MAX_VOIDS) {
        // Excess voids shrink much faster
        for (let i = 0; i < voids.length - MAX_VOIDS; i++) {
          voids[i].radius -= 0.35
        }
      }

      // Filter out fully healed/dissolved voids
      for (let i = voids.length - 1; i >= 0; i--) {
        if (voids[i].radius <= 0.5) {
          voids.splice(i, 1)
        }
      }

      // Draw permanent void boundaries (craters) with a faint breathing amber glow
      for (const vd of voids) {
        if (vd.radius <= 0) continue
        ctx.beginPath()
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.0018 + vd.x)
        const opacity = (0.012 + pulse * 0.015) * Math.min(1, vd.radius / 30) // fade out when shrinking close to 0
        ctx.strokeStyle = `rgba(227, 194, 122, ${opacity})`
        ctx.lineWidth = 0.5
        // Calculate relative screen Y based on scroll movement since click (drawn at 0.55 standard parallax depth)
        const vdScreenY = vd.y + (vd.scrollYAtClick - smoothedScrollY) * 0.55
        ctx.arc(vd.x, vdScreenY, vd.radius, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Draw Expanding Shockwave Rings
      for (const sw of shockwaves) {
        ctx.beginPath()
        const opacity = (1 - sw.radius / sw.maxRadius) * sw.force * 0.08
        ctx.strokeStyle = `rgba(227, 194, 122, ${opacity})`
        ctx.lineWidth = 0.5 + (1 - sw.radius / sw.maxRadius) * 2.0
        // Calculate relative screen Y based on scroll movement since click (drawn at 0.55 standard parallax depth)
        const swScreenY = sw.y + (sw.scrollYAtClick - smoothedScrollY) * 0.55
        ctx.arc(sw.x, swScreenY, sw.radius, 0, Math.PI * 2)
        ctx.stroke()
      }

      // ── Update & Draw Particles ──────────────────────────────────
      const renderedSomething: { x: number; y: number; color: string; alpha: number }[] = []
      const renderedStars: { x: number; y: number; alpha: number }[] = []

      for (const p of particles) {
        // Accelerate twinkling for stars to make them breathe/twinkle organically
        if (p.type === "star") {
          p.phase += p.pulseSpeed * 1.6
        } else {
          p.phase += p.pulseSpeed
        }

        // 1. Natural Organic Drift (Independent of scroll velocity to prevent physics locking)
        p.x += p.vx + 0.04
        p.y += p.vy + 0.02

        // 2. Parallax Coordinates + 3D Mouse Depth Tilt + Transient Scroll Wind Lag
        // Scroll velocity creates a beautiful dynamic visual lag (wind drag) scaled by depth
        const visualX = p.x + tiltX * p.depth * 3.5 - scrollVelocity * (p.depth * 0.4)
        const visualY = p.y - smoothedScrollY * p.depth + tiltY * p.depth * 3.5 - scrollVelocity * (p.depth * 2.2)

        // Wrap coordinates with a 120px buffer outside viewport boundaries to prevent edge popping
        const screenX = ((visualX + 120) % (W + 240) + (W + 240)) % (W + 240) - 120
        const screenY = ((visualY + 120) % (H + 240) + (H + 240)) % (H + 240) - 120

        // Apply Click Shockwaves
        for (const sw of shockwaves) {
          const swScreenY = sw.y + (sw.scrollYAtClick - smoothedScrollY) * p.depth
          const dx = screenX - sw.x
          const dy = screenY - swScreenY
          const dist = Math.sqrt(dx * dx + dy * dy)
          const distFromRing = Math.abs(dist - sw.radius)
          if (distFromRing < 45 && dist > 10) {
            const pushFactor = (1 - distFromRing / 45) * sw.force
            p.vx += (dx / dist) * pushFactor * 1.8
            p.vy += (dy / dist) * pushFactor * 1.8
          }
        }

        // Apply Permanent Voids (Craters)
        for (const vd of voids) {
          const vdScreenY = vd.y + (vd.scrollYAtClick - smoothedScrollY) * p.depth
          const dx = screenX - vd.x
          const dy = screenY - vdScreenY
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < vd.radius) {
            // Push factor scales down dynamically as the void shrinks/heals
            const pushFactor = (1 - dist / vd.radius) * 0.85 * Math.min(1, vd.radius / 40)
            p.vx += (dx / (dist || 1)) * pushFactor
            p.vy += (dy / (dist || 1)) * pushFactor
          }
        }

        // 3. Mouse Physics (in screen space)
        const dx = screenX - mouse.x
        const dy = screenY - mouse.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (mouse.x > 0 && mouse.y > 0 && dist < MOUSE_RADIUS) {
          const force = (1 - dist / MOUSE_RADIUS) * 0.35

          if (p.type === "nothing") {
            // Doubt Repels
            const pushX = (dx / (dist || 1)) * force * 1.5
            const pushY = (dy / (dist || 1)) * force * 1.5
            p.vx += pushX
            p.vy += pushY
          } else if (p.type === "something") {
            // Belief Attracts
            const pullX = (dx / (dist || 1)) * force * 1.2
            const pullY = (dy / (dist || 1)) * force * 1.2
            p.vx -= pullX
            p.vy -= pullY

            // Add a soft orbit/swirl effect
            p.vx += (-dy / (dist || 1)) * force * 0.6
            p.vy += (dx / (dist || 1)) * force * 0.6
          }
        }

        // Add organic continuous noise so particles drift even when cursor is still
        if (p.type === "nothing") {
          p.vx += (Math.random() - 0.5) * 0.025
          p.vy += (Math.random() - 0.5) * 0.025
        } else if (p.type === "something") {
          p.vx += (Math.random() - 0.5) * 0.035
          p.vy += (Math.random() - 0.5) * 0.035
        } else if (p.type === "star") {
          p.vx += (Math.random() - 0.5) * 0.005
          p.vy += (Math.random() - 0.5) * 0.005
        }

        // Apply friction/dampening
        p.vx *= 0.94
        p.vy *= 0.94

        // 4. Wrap Page-Space Boundaries
        if (p.x < -20) p.x = W + 20
        if (p.x > W + 20) p.x = -20
        if (p.y < -20) p.y = pageH + 20
        if (p.y > pageH + 20) p.y = -20

        // Twinkle/Pulse Opacity
        const pulse = 0.6 + 0.4 * Math.sin(p.phase)
        let alpha = p.baseAlpha * pulse

        // Mouse proximity glow boost
        if (dist < MOUSE_RADIUS) {
          const proximity = 1 - dist / MOUSE_RADIUS
          alpha = Math.min(alpha + proximity * 0.4, 0.95)
        }

        // Chemistry color morphing interpolation
        let finalColor = p.color
        if (p.type === "something" && dist < MOUSE_RADIUS && mouse.x > 0) {
          const ratio = 1 - dist / MOUSE_RADIUS
          if (p.isEmerald) {
            const r = Math.round(52 + (6 - 52) * ratio)
            const g = Math.round(211 + (182 - 211) * ratio)
            const b = Math.round(153 + (212 - 153) * ratio)
            finalColor = `rgba(${r}, ${g}, ${b}, `
          } else {
            const r = Math.round(244 + (139 - 244) * ratio)
            const g = Math.round(114 + (92 - 114) * ratio)
            const b = Math.round(182 + (246 - 182) * ratio)
            finalColor = `rgba(${r}, ${g}, ${b}, `
          }
        }

        // 5. Draw Particle with Star Micro-Shiver if mouse is near
        let renderX = screenX
        let renderY = screenY
        if (p.type === "star" && mouse.x > 0 && mouse.y > 0) {
          if (dist < 320) {
            const shiverFactor = (1 - dist / 320) * 1.5
            renderX += Math.sin(p.phase * 3) * shiverFactor
            renderY += Math.cos(p.phase * 3) * shiverFactor
          }
        }

        ctx.beginPath()
        const colorStr = p.type === "star" ? finalColor : `${finalColor}${alpha})`
        ctx.fillStyle = colorStr
        const r = p.type === "star" ? p.baseR : p.baseR * (1 + (hoveredFactor(p, dist) * 0.4))
        ctx.arc(renderX, renderY, r, 0, Math.PI * 2)
        ctx.fill()

        // Cache coordinates for link drawing
        if (p.type === "something") {
          renderedSomething.push({ x: screenX, y: screenY, color: finalColor, alpha })
        } else if (p.type === "star") {
          renderedStars.push({ x: renderX, y: renderY, alpha })
        }
      }

      // ── Draw Constellation Links (Something networks) ────────────
      const LINK_DIST = 95
      const LINK_DIST_SQ = LINK_DIST * LINK_DIST
      for (let i = 0; i < renderedSomething.length; i++) {
        const p1 = renderedSomething[i]
        for (let j = i + 1; j < renderedSomething.length; j++) {
          const p2 = renderedSomething[j]
          const dx = p1.x - p2.x
          const dy = p1.y - p2.y
          const distSq = dx * dx + dy * dy
          
          if (distSq < LINK_DIST_SQ) {
            const dist = Math.sqrt(distSq)
            const opacity = (1 - dist / LINK_DIST) * 0.08 * Math.min(p1.alpha, p2.alpha)
            
            // Draw baseline connection
            ctx.beginPath()
            ctx.strokeStyle = `${p1.color}${opacity})`
            ctx.lineWidth = 0.5 + (1 - dist / LINK_DIST) * 0.5
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.stroke()

            // Draw animated pulse dot traveling along the link path
            const globalPhase = (Date.now() * 0.0018) % 1.0
            const pulseX = p1.x + (p2.x - p1.x) * globalPhase
            const pulseY = p1.y + (p2.y - p1.y) * globalPhase
            
            ctx.beginPath()
            ctx.arc(pulseX, pulseY, 1.25, 0, Math.PI * 2)
            ctx.fillStyle = `${p1.color}${opacity * 4.0})`
            ctx.fill()
          }
        }
      }

      // ── Draw Faint Star Connections (Cosmic background linkages) ────────
      const STAR_LINK_DIST = 60
      const STAR_LINK_DIST_SQ = STAR_LINK_DIST * STAR_LINK_DIST
      for (let i = 0; i < renderedStars.length; i += 2) {
        const p1 = renderedStars[i]
        for (let j = i + 1; j < renderedStars.length; j++) {
          const p2 = renderedStars[j]
          const dx = p1.x - p2.x
          const dy = p1.y - p2.y
          const distSq = dx * dx + dy * dy

          if (distSq < STAR_LINK_DIST_SQ) {
            const dist = Math.sqrt(distSq)
            const opacity = (1 - dist / STAR_LINK_DIST) * 0.035 * Math.min(p1.alpha, p2.alpha)
            ctx.beginPath()
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`
            ctx.lineWidth = 0.35
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.stroke()
          }
        }
      }

      raf = requestAnimationFrame(tick)
    }

    const hoveredFactor = (p: Particle, dist: number): number => {
      if (mouse.x < 0 || p.type === "star") return 0
      return dist < MOUSE_RADIUS ? 1 - dist / MOUSE_RADIUS : 0
    }

    tick()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseleave", onLeave)
      window.removeEventListener("mousedown", onClick)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}
