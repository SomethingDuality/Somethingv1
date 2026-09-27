"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Question } from "@/lib/questions"

type Props = {
  question: Question
  saving: boolean
  onSubmit: (value: string | string[]) => void
}

// The reply area of the conversation: most answers are one tap on a chip; typed answers use the
// same composer as the Something page.
const chip = (on: boolean) =>
  cn(
    "rounded-full border px-4 py-2 text-[15px] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default",
    on ? "border-foreground bg-foreground text-background" : "border-line text-foreground/90 hover:border-muted-foreground hover:text-foreground",
  )

const sendClass =
  "grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-background transition-opacity disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed"

/** One reply control per question type: tap a chip, pick several, answer yes/no, or type a line. */
export function QuestionInput({ question: q, saving, onSubmit }: Props) {
  const [picked, setPicked] = useState<string[]>([])
  const [text, setText] = useState("")
  const [custom, setCustom] = useState("")
  const firstRef = useRef<HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement | null>(null)
  const areaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    setPicked([])
    setText("")
    setCustom("")
    firstRef.current?.focus()
  }, [q.id, q.entityId])

  // A long answer grows with the text, up to a limit.
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [text])

  const max = q.select?.max ?? 1
  const min = q.select?.min ?? 1
  const setFirst = (i: number) => (i === 0 ? (el: HTMLButtonElement | null) => { firstRef.current = el } : undefined)

  if (q.type === "yes_no") {
    return (
      // One row of equal buttons (yes/no, or yes/depends/no).
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(q.options?.length || 2, 3)}, minmax(0, 1fr))` }} role="group" aria-label={q.prompt}>
        {(q.options ?? []).map((o, i) => (
          <button key={o.value} ref={setFirst(i)} type="button" disabled={saving} onClick={() => onSubmit(o.value)} className={cn(chip(false), "h-12")}>
            {o.label}
          </button>
        ))}
      </div>
    )
  }

  // One choice: a tap answers.
  if (q.type === "chips" && max === 1) {
    return (
      <div className="flex flex-wrap gap-2" role="group" aria-label={q.prompt}>
        {(q.options ?? []).map((o, i) => (
          <button key={o.value} ref={setFirst(i)} type="button" disabled={saving} onClick={() => onSubmit(o.value)} className={chip(false)}>
            {o.label}
          </button>
        ))}
      </div>
    )
  }

  if (q.type === "chips") {
    const toggle = (v: string) =>
      setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : p.length < max ? [...p, v] : p))
    const addCustom = () => {
      const v = custom.trim()
      if (v && !picked.includes(v) && picked.length < max) setPicked((p) => [...p, v])
      setCustom("")
    }
    const customPicked = picked.filter((v) => !(q.options ?? []).some((o) => o.value === v))
    const ready = !saving && picked.length >= min
    return (
      <div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={q.prompt}>
          {(q.options ?? []).map((o, i) => (
            <button
              key={o.value}
              ref={setFirst(i)}
              type="button"
              disabled={saving}
              aria-pressed={picked.includes(o.value)}
              onClick={() => toggle(o.value)}
              className={chip(picked.includes(o.value))}
            >
              {o.label}
            </button>
          ))}
          {customPicked.map((v) => (
            <button key={v} type="button" onClick={() => toggle(v)} className={chip(true)} aria-label={`Remove ${v}`}>
              {v} ×
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-full border border-line py-1 pl-4 pr-1 focus-within:border-muted-foreground/60">
          {q.allowCustom ? (
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  if (custom.trim()) addCustom()
                  else if (ready) onSubmit(picked)
                }
              }}
              aria-label="Add your own"
              placeholder="Something else? Type and press Enter"
              className="h-9 min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none sm:text-[15px]"
            />
          ) : (
            <span className="flex-1 text-[13px] text-muted-foreground">
              {picked.length ? `${picked.length} picked` : max > 1 ? `Pick up to ${max}` : "Pick one"}
            </span>
          )}
          <button type="button" disabled={!ready} onClick={() => onSubmit(picked)} aria-label={saving ? "Saving" : "Send"} className={sendClass}>
            <ArrowUp className="size-4" />
          </button>
        </div>
      </div>
    )
  }

  const long = q.format === "long"
  const value = text.trim()
  const submitText = () => {
    if (value && !saving) onSubmit(value)
  }
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submitText() }}
      className="flex items-end gap-2 rounded-[24px] border border-line bg-surface py-1.5 pl-4 pr-1.5 transition-colors focus-within:border-muted-foreground/60"
    >
      {long ? (
        <textarea
          ref={(el) => { firstRef.current = el; areaRef.current = el }}
          value={text}
          maxLength={q.maxLength}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitText() } }}
          placeholder={q.placeholder || "Type your answer"}
          aria-label={q.prompt}
          rows={1}
          className="block min-h-9 flex-1 resize-none bg-transparent py-1.5 text-base leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none sm:text-[15px]"
        />
      ) : (
        <input
          ref={(el) => { firstRef.current = el }}
          value={text}
          maxLength={q.maxLength}
          list={q.suggestions ? `sugg-${q.id}` : undefined}
          onChange={(e) => setText(e.target.value)}
          placeholder={q.placeholder || "Type your answer"}
          aria-label={q.prompt}
          inputMode={q.format === "url" ? "url" : undefined}
          className="h-9 min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none sm:text-[15px]"
        />
      )}
      {q.suggestions && (
        <datalist id={`sugg-${q.id}`}>
          {q.suggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
      <button type="submit" disabled={saving || !value} aria-label={saving ? "Saving" : "Send"} className={sendClass}>
        <ArrowUp className="size-4" />
      </button>
    </form>
  )
}
