import { useState } from "react";
import axios from "axios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

// Allowed email domains (moved outside so it's not recreated each render)
const allowedDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"];

// Email validation function (also moved outside)
const validateEmail = (value:string):boolean => {
  const trimmed = value.trim();
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailPattern.test(trimmed)) return false;
  const domain = trimmed.split("@")[1]?.toLowerCase();
  return allowedDomains.includes(domain);
};

export default function JoinForm() {
  const [email, setEmail] = useState("");
  const [valid, setValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lastSubmit, setLastSubmit] = useState(0);

const onChangeEmail = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
  setEmail(value);
  setValid(validateEmail(value));
  if (submitted) setSubmitted(false);
};

const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  if (!valid || loading) return;

  if (Date.now() - lastSubmit < 1000) return;
  setLastSubmit(Date.now());

  setLoading(true);
  try {
    const res = await axios.post("#", { email: email.trim() });
    console.log("Email submitted:", res.data);
    setEmail("");
    setValid(false);
    setSubmitted(true);

    setTimeout(() => setSubmitted(false), 5000);
  } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
    // now TypeScript knows error.response exists
    const message =
      error.response?.status === 409
        ? "Email already registered!"
        : error.response?.status && error.response.status >= 500
        ? "Server error. Please try again later."
        : "Something went wrong. Please try again.";
    alert(message);
  } else {
    console.error("Non-Axios error:", error);
    alert("Something went wrong. Please try again.");
  }
  } finally {
    setLoading(false);
  }
};


  // Success state with aesthetic animation
  if (submitted) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/30 backdrop-blur-sm animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
        <div className="flex-shrink-0">
          <CheckCircle className="w-5 h-5 text-green-400 animate-in zoom-in-0 duration-300 delay-100" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-green-100 font-medium text-sm">
            Welcome aboard! 
          </p>
          <p className="text-green-200/70 text-xs">
            Check your inbox for confirmation
          </p>
        </div>
        <button
          onClick={() => setSubmitted(false)}
          className="flex-shrink-0 text-green-200/70 hover:text-green-100 transition-colors text-xs"
        >
          Join another?
        </button>
      </div>
    );
  }

  return (
  <form onSubmit={onSubmit} className="flex gap-2">
  <label htmlFor="email" className="sr-only">
    Email
  </label>
  <div className="relative flex-1">
    <Input
      id="email"
      type="email"
      placeholder="you@domain.com"
      value={email}
      onChange={onChangeEmail}
      className="rounded-full bg-black/30 border-white/15 text-white placeholder:text-white/40 transition-all duration-200 focus:border-white/30 focus:bg-black/40"
      required
    />
  </div>
  <Button
    type="submit"
    disabled={!valid || loading}
    className="rounded-full bg-white text-black hover:bg-[#e3c27a] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px]"
  >
    {loading ? (
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-black/20 border-t-black animate-spin rounded-full" />
        Joining...
      </div>
    ) : (
      "Join"
    )}
  </Button>
</form>

  );
}