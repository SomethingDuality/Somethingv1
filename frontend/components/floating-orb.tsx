"use client"

import React from "react"

export default function FloatingOrb({ className = "" }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <svg width="420" height="420" viewBox="0 0 420 420" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-100">
        <defs>
          <radialGradient id="fmut" cx="0" cy="0" r="1" gradientTransform="translate(0.35 0.55) scale(0.6)">
            <stop offset="0%" stopColor="#e3c27a" stopOpacity="1" />
            <stop offset="45%" stopColor="#e3c27a" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#e3c27a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="finy" cx="0" cy="0" r="1" gradientTransform="translate(0.65 0.45) scale(0.6)">
            <stop offset="0%" stopColor="#34d399" stopOpacity="1" />
            <stop offset="45%" stopColor="#34d399" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g className="animate-float">
          <circle cx="150" cy="210" r="140" fill="url(#fmut)" />
          <circle cx="270" cy="180" r="115" fill="url(#finy)" />
        </g>

        <g className="opacity-70 animate-orbit">
          <circle cx="60" cy="80" r="26" fill="#e3c27a" />
          <circle cx="360" cy="330" r="20" fill="#34d399" />
        </g>
      </svg>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes floatingOrbFloat { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-8px) } }
        @keyframes floatingOrbOrbit { 0%{ transform: rotate(0deg) } 100%{ transform: rotate(360deg) } }
        .animate-float { animation: floatingOrbFloat 6s ease-in-out infinite; transform-origin: center; }
        .animate-orbit { animation: floatingOrbOrbit 18s linear infinite; transform-origin: center; }
      `
      }} />
    </div>
  )
}
