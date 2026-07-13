"use client"

import React from "react"

export default function ResultsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-4 bg-white/4 rounded-lg animate-pulse h-36" />
      ))}
    </div>
  )
}
