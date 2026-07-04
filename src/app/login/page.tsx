"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand } from "@/components/layout/brand";
import { Loader2, ShieldCheck, Sparkles, Target } from "lucide-react";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        if (data.session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setNotice(
            "Account created. Check your inbox to confirm your email, then sign in.",
          );
          setMode("signin");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function useDemo() {
    setEmail("ceo@lightsummit.io");
    setPassword("ExecutiveOS!2026");
    setMode("signin");
  }

  return (
    <div className="app-canvas grid min-h-screen lg:grid-cols-2">
      {/* Brand / value panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-border p-12 lg:flex">
        <Brand />
        <div className="max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            Turn scattered information into{" "}
            <span className="text-electric-400">daily decisions.</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            One command centre for a CEO — priorities, meetings, tasks,
            decisions, pipeline, and a team of AI agents working alongside you.
          </p>
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-electric-400" />
              AI daily brief every morning
            </li>
            <li className="flex items-center gap-3">
              <Target className="h-5 w-5 text-electric-400" />
              Pipeline, decisions & risks at a glance
            </li>
            <li className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-electric-400" />
              Private by default — row-level security
            </li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Executive OS
        </p>
      </div>

      {/* Auth form */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>

          <h1 className="text-2xl font-bold tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to your command centre."
              : "Start running your day from one place."}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Elena Marsh"
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>

            {error && (
              <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}
            {notice && (
              <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                {notice}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="mt-6 space-y-3 text-center text-sm">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setNotice(null);
                setMode(mode === "signin" ? "signup" : "signin");
              }}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {mode === "signin"
                ? "No account? Create one"
                : "Already have an account? Sign in"}
            </button>
            <div>
              <button
                type="button"
                onClick={useDemo}
                className="text-electric-400 transition-colors hover:text-electric-500"
              >
                Use demo CEO credentials →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
