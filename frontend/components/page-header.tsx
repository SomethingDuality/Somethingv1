import type React from "react"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"

export type PageHeaderAccentColor = "emerald" | "amber" | "indigo" | "pink" | "violet" | "blue"

interface PageHeaderProps {
  category: string
  title: string
  description: string
  icon?: React.ComponentType<{ className?: string }>
  accentColor?: PageHeaderAccentColor
  action?: React.ReactNode
  className?: string
}

export function PageHeader({
  category,
  title,
  description,
  icon: Icon,
  accentColor = "emerald",
  action,
  className,
}: PageHeaderProps) {
  const { theme } = useTheme()
  const isDark = theme !== "light"
  
  // Custom Premium Theme color mappings (Chalk Bone, Console Mint, Silicon Copper, Industrial Cobalt)
  const themeColors = {
    emerald: {
      bulletBg: isDark ? "bg-[#8EA38E]/60" : "bg-[#5C725E]/60",
      textAccent: isDark ? "text-[#8EA38E]" : "text-[#5C725E]",
    },
    amber: {
      bulletBg: isDark ? "bg-[#C88E72]/60" : "bg-[#A56B4E]/60",
      textAccent: isDark ? "text-[#C88E72]" : "text-[#A56B4E]",
    },
    indigo: {
      bulletBg: isDark ? "bg-[#E2DFD5]/60" : "bg-[#7C7A72]/60",
      textAccent: isDark ? "text-[#E2DFD5]" : "text-[#7C7A72]",
    },
    pink: {
      bulletBg: isDark ? "bg-[#8293A4]/60" : "bg-[#5C6C7C]/60",
      textAccent: isDark ? "text-[#8293A4]" : "text-[#5C6C7C]",
    },
    violet: {
      bulletBg: isDark ? "bg-[#8293A4]/60" : "bg-[#5C6C7C]/60",
      textAccent: isDark ? "text-[#8293A4]" : "text-[#5C6C7C]",
    },
    blue: {
      bulletBg: isDark ? "bg-[#8293A4]/60" : "bg-[#5C6C7C]/60",
      textAccent: isDark ? "text-[#8293A4]" : "text-[#5C6C7C]",
    },
  }[accentColor]

  return (
    <div 
      className={cn(
        "relative pb-8 mb-10 border-b border-border/30",
        className
      )}
    >
      {/* Content wrapper */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 flex-1">
          {/* Tag Category */}
          <div className="flex items-center gap-2">
            <span className={cn("h-1 w-1 rounded-full", themeColors.bulletBg)} />
            <span className={cn("text-[9px] uppercase tracking-[0.2em] font-mono font-semibold", themeColors.textAccent)}>
              {category}
            </span>
          </div>

          {/* Title Header */}
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2.5 rounded-xl border border-border bg-foreground/[0.01] text-foreground shrink-0 hidden sm:block">
                <Icon className="h-[18px] w-[18px]" />
              </div>
            )}
            <h1 className="text-3xl sm:text-4xl font-serif font-light tracking-tight text-foreground">
              {title}
            </h1>
          </div>

          {/* Description */}
          <p className="text-foreground/60 font-light text-xs sm:text-[13px] leading-relaxed max-w-2xl font-sans pt-0.5">
            {description}
          </p>
        </div>

        {/* Action button container */}
        {action && (
          <div className="flex flex-wrap gap-2 shrink-0 md:ml-auto items-center">
            {action}
          </div>
        )}
      </div>
    </div>
  )
}
