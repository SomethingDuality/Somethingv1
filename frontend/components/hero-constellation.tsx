"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import JoinForm from "./waitlist-form"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export function HeroConstellation() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 pt-10 sm:pt-16 pb-14 sm:pb-20">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 mb-4">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#e3c27a]" aria-hidden="true" />
              Not another AI website
            </div>
            <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.03]">
              Ideas find their people. Capital finds its purpose.
            </h1>
            <p className="mt-4 text-white/70 text-base sm:text-lg max-w-xl">
              Two complementary AIs—Mut (the critical investor) and Iny (the empathetic CEO)—co-pilot you to aligned
              co-founders, teams, and community funding. Protected sharing. Radical transparency.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <a href="#duo">
                <Button className="rounded-full px-6 bg-white text-black hover:bg-[#e3c27a] hover:text-black">
                  Meet Mut + Iny
                </Button>
              </a>
              <a href="#how">
                <Button
                  variant="outline"
                  className="rounded-full border-white/20 text-white hover:bg-white/10 bg-transparent"
                >
                  How it works
                </Button>
              </a>
            </div>

            <div id="waitlist" className="mt-8 max-w-md">
              < JoinForm/> <p className="text-xs text-white/50 mt-2">
                Mutual NDAs + on-chain idea hashes to prove authorship and deter copying.
              </p>
            </div>
          </div>

          <div className="relative lg:pl-6">
            <DuoOrbs />
          </div>
        </div>
      </div>

      {/* Ambient border glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-60"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(227,194,122,0.6) 20%, rgba(244,114,182,0.4) 50%, rgba(52,211,153,0.6) 80%, transparent 100%)",
        }}
      />
    </section>
  )
}

function DuoOrbs() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [hover, setHover] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0

    function onMove(e: PointerEvent) {
      const rect = el.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      const y = (e.clientY - rect.top) / rect.height
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--mx", x.toString())
        el.style.setProperty("--my", y.toString())
      })
    }

    el.addEventListener("pointermove", onMove)
    return () => {
      el.removeEventListener("pointermove", onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      ref={ref}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      className={cn(
        "relative aspect-[4/3] rounded-2xl border border-white/10 overflow-hidden",
        "bg-black/40 backdrop-blur supports-[backdrop-filter]:bg-black/30",
        "ring-1 ring-inset ring-white/5",
      )}
      style={
        {
          "--mx": 0.5,
          "--my": 0.5,
        } as React.CSSProperties
      }
      aria-label="Animated Mut and Iny orbs reacting to your pointer"
    >
      {/* Gooey SVG backdrop */}
      <svg className="absolute inset-0 w-full h-full" role="img" aria-label="Gooey duo">
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 24 -8"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>

        <g filter="url(#goo)">
          {/* Mut */}
          <circle
            cx="40%"
            cy="55%"
            r="120"
            fill="url(#mutGrad)"
            style={{
              transformOrigin: "40% 55%",
            }}
            className="animate-[float_6s_ease-in-out_infinite]"
          />
          {/* Iny */}
          <circle
            cx="60%"
            cy="45%"
            r="120"
            fill="url(#inyGrad)"
            style={{
              transformOrigin: "60% 45%",
            }}
            className="animate-[float_7s_ease-in-out_infinite]"
          />
          {/* Mini satellites */}
          <circle
            cx="30%"
            cy="35%"
            r="40"
            fill="url(#mutGrad)"
            className="opacity-70 animate-[orbit_14s_linear_infinite]"
          />
          <circle
            cx="75%"
            cy="70%"
            r="34"
            fill="url(#inyGrad)"
            className="opacity-70 animate-[orbit_16s_linear_infinite_reverse]"
          />
        </g>

        <defs>
          <radialGradient id="mutGrad">
            <stop offset="0%" stopColor="#e3c27a" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#e3c27a" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#e3c27a" stopOpacity="0.05" />
          </radialGradient>
          <radialGradient id="inyGrad">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#34d399" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.05" />
          </radialGradient>
        </defs>
      </svg>

      {/* Pointer-reactive caustics */}
      <div
        aria-hidden="true"
        className={cn("absolute -inset-40 opacity-40 transition-opacity", hover ? "opacity-60" : "opacity-30")}
        style={{
          background:
            "radial-gradient(600px 600px at calc(var(--mx) * 100%) calc(var(--my) * 100%), rgba(244,114,182,0.25), transparent 60%)",
          mixBlendMode: "screen",
        }}
      />
      {/* Frame lines */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-x-6 top-6 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div className="absolute inset-y-6 right-6 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
      </div>

      {/* Legend */}
      <div className="absolute left-4 top-4 flex items-center gap-2">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#e3c27a]" />
        <span className="text-xs text-white/80">Mut • critical investor</span>
      </div>
      <div className="absolute right-4 bottom-4 flex items-center gap-2">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#34d399]" />
        <span className="text-xs text-white/80">Iny • friendly CEO</span>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes float {
          0%, 100% { transform: translate3d(0,0,0) }
          50% { transform: translate3d(0,-10px,0) }
        }
        @keyframes orbit {
          0% { transform: rotate(0deg) translateX(10px) rotate(0deg) }
          100% { transform: rotate(360deg) translateX(10px) rotate(-360deg) }
        }
      `,
        }}
      />
    </div>
  )
}
