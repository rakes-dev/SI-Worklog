"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import AppLogo from "@/components/ui/AppLogo";
import { Loader2, ArrowLeft } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { status, role, authorized, accessError, signInGoogle, signInEmail } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (status === "authenticated" && authorized !== null) {
      router.replace(role === "admin" ? "/admin" : "/");
    }
  }, [status, authorized, role, router]);

  const busy = status === "loading";
  const canSubmit = email.trim() !== "" && password !== "";

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    signInEmail(email, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <AppLogo size={48} />
          <h1 className="text-xl font-semibold text-foreground mt-3">
            SI WorkLog
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sign in to continue
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-xl p-6 fade-in">
          <button
            type="button"
            onClick={signInGoogle}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-md border border-border text-sm font-medium text-foreground hover:bg-secondary transition-colors scale-press disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  fill="#FFC107"
                  d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
                />
                <path
                  fill="#FF3D00"
                  d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
                />
                <path
                  fill="#4CAF50"
                  d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
                />
                <path
                  fill="#1976D2"
                  d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
                />
              </svg>
            )}
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={busy || !canSubmit}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              Sign in
            </button>
          </form>

          {accessError && (
            <p className="mt-3 text-xs text-red-500 leading-relaxed">
              {accessError}
            </p>
          )}

          <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
            Note: only emails added by an admin can sign in. Google and
            Email/Password must be enabled in Firebase Authentication, with{" "}
            <span className="font-mono">localhost:4028</span> authorized.
          </p>
        </div>

        <Link
          href="/"
          className="mt-5 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} />
          Back to app
        </Link>
      </div>
    </div>
  );
}
