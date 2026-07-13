"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight } from "lucide-react"
import { SomethingLogo } from "@/components/something-logo"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { login } = useAuth()
  const valid = email.trim().length > 3 && password.length >= 6

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || loading) return
    setLoading(true)
    setError(null)
    try {
      await login(email.trim(), password)
      const targetRole = localStorage.getItem("demo_role") || "founder"
      router.push(targetRole === "investor" ? "/investor" : "/founder")
    } catch (err: unknown) {
      setError("Invalid credentials or server error")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[450px_1fr] bg-[#0a0a0c] text-white">
      {/* Left Column: Brand Column (Editorial pitch) */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden border-r border-white/5 bg-[#070709]">
        {/* Soft background glow */}
        <div
          className="absolute top-1/4 -left-1/4 w-96 h-96 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(227,194,122,0.04) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-1/4 -right-1/4 w-96 h-96 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(52,211,153,0.03) 0%, transparent 70%)",
          }}
        />

        {/* Logo */}
        <Link href="/" className="relative z-10 flex items-center gap-3">
          <SomethingLogo />
        </Link>

        {/* Dynamic editorial text */}
        <div className="relative z-10 space-y-6 my-auto">
          <h2 className="text-4xl font-bold tracking-tight leading-[1.1]" style={{ fontFamily: "var(--font-outfit)" }}>
            somewhere between <br />
            <span className="text-[#E3C27A]">conviction</span> and <span className="text-[#34D399]">doubt</span>.
          </h2>
          <p className="text-sm text-white/30 leading-relaxed max-w-sm">
            Two AI minds co-pilot your startup. <span className="text-white/50">Nothing</span> stress-tests viability. <span className="text-white/50">Something</span> maps emotional user fit.
          </p>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex justify-between text-[11px] text-white/20 font-mono">
          <span>Mutual NDAs standard</span>
          <span>something.to</span>
        </div>
      </div>

      {/* Right Column: Interactive Login Form */}
      <div className="flex items-center justify-center p-6 sm:p-12 relative">
        {/* Mobile Logo Header */}
        <div className="absolute top-6 left-6 lg:hidden">
          <Link href="/">
            <SomethingLogo />
          </Link>
        </div>

        <div className="w-full max-w-md p-8 sm:p-10 rounded-2xl border border-white/5 bg-white/[0.01] backdrop-blur-xl shadow-2xl space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500 relative overflow-hidden">
          {/* Subtle top border illumination */}
          <div aria-hidden className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white" style={{ fontFamily: "var(--font-outfit)" }}>
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-white/40">
              Access your founder/investor dashboard.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35">
                  <Mail className="h-4 w-4" />
                </span>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  required
                  className="pl-10 bg-white/[0.01] border-white/5 hover:border-white/15 focus:border-[#E3C27A]/50 focus:ring-1 focus:ring-[#E3C27A]/15 text-white placeholder:text-white/20 h-11 rounded-lg transition-all"
                  style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)" }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                  Password
                </label>
                <Link href="/forgot" className="text-xs text-[#E3C27A]/80 hover:text-[#E3C27A] transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35">
                  <Lock className="h-4 w-4" />
                </span>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pl-10 pr-10 bg-white/[0.01] border-white/5 hover:border-white/15 focus:border-[#E3C27A]/50 focus:ring-1 focus:ring-[#E3C27A]/15 text-white placeholder:text-white/20 h-11 rounded-lg transition-all"
                  style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/60 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-rose-400 font-medium bg-rose-500/5 border border-rose-500/10 rounded-lg p-3">
                {error}
              </p>
            )}

            <div className="pt-2 space-y-4">
              <Button
                type="submit"
                disabled={!valid || loading}
                className="w-full h-11 bg-white text-black hover:bg-[#E3C27A] hover:text-[#0a0a0c] font-semibold transition-all rounded-lg flex items-center justify-center gap-2 cursor-pointer"
                style={{ boxShadow: "0 4px 20px rgba(255,255,255,0.03)" }}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Sign In <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>

          <div className="border-t border-white/5 pt-6 text-center text-xs text-white/40">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-white font-medium hover:underline">
              Create one
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
