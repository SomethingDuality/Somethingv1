"use client"

import React, { useState } from "react"
import ModeToggle from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"


export default function IdeaComposer({ onRun, loading = false }: { onRun: (idea: string, mode: 'mut'|'iny'|'mutiny') => void; loading?: boolean }) {
  const [mode, setMode] = useState<'mut'|'iny'|'mutiny'>('mutiny')
  const [idea, setIdea] = useState('')
  const [strictness, setStrictness] = useState(5)

  return (
    <div className="bg-white/3 border border-white/6 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold">Run Mutiny</h3>
          <ModeToggle value={mode} onChange={(m) => setMode(m)} />
        </div>
        <div className="text-xs text-white/60">Model: <span className="font-medium text-white">{mode.toUpperCase()}</span></div>
      </div>

      <textarea
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        placeholder="Describe your idea in 1-3 sentences..."
        className="w-full min-h-[120px] rounded-md bg-transparent border border-white/6 p-3 text-white resize-none"
      />

      <div className="mt-3">
        <div className="text-xs text-white/60 mb-1">Prompt preview</div>
        <div className="rounded-md bg-white/2 p-3 text-sm text-white/70">
          {`Mode: ${mode.toUpperCase()} — Strictness: ${strictness}/10. Prompt: "${idea || 'Describe your idea here'}"`}
        </div>
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="ghost" onClick={async () => { await navigator.clipboard.writeText(`Mode: ${mode}\nStrictness: ${strictness}\n${idea}`) }}>Copy prompt</Button>
          <Button size="sm" onClick={() => onRun(idea, mode)} disabled={!idea.trim()}>Run with prompt</Button>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3">
        <div className="flex items-center gap-3 text-sm text-white/70">
          <div className="flex flex-col">
            <label className="text-xs">Strictness</label>
            <div className="flex items-center gap-2">
              <input aria-label="Strictness" type="range" min={1} max={10} value={strictness} onChange={(e) => setStrictness(Number(e.target.value))} />
              <div className="text-xs text-white/60 w-8 text-right">{strictness}</div>
            </div>
            <div className="text-xxs text-white/50 mt-1">Higher = more conservative • you choose</div>
          </div>
        </div>

        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setIdea('') }}>Clear</Button>
          <Button size="sm" onClick={() => onRun(idea, mode)} disabled={!idea.trim() || loading}>
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-white/80 animate-pulse inline-block"></span>
                Running...
              </span>
            ) : (
              'Run'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
