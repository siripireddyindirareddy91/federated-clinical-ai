"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Activity, ArrowRight, ShieldCheck, LoaderCircle } from "lucide-react";
import { api, post, human } from "@/lib/api";
export default function Auth({ mode }: { mode: string }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [demo, setDemo] = useState(false);
  useEffect(() => {
    api("/health")
      .then((h) => setDemo(h.demo_mode))
      .catch(() => {});
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (mode === "login") {
        await post("/auth/login", { email, password });
        location.href = "/dashboard";
      } else if (mode === "register") {
        await post("/auth/register", { email, password, name });
        await post("/auth/login", { email, password });
        location.href = "/dashboard";
      } else if (mode === "forgot-password") {
        const r = await post("/auth/forgot-password", { email });
        setMessage(
          r.message +
            (r.demo_reset_token ? " DEMO token: " + r.demo_reset_token : ""),
        );
      } else {
        const r = await post("/auth/reset-password", { token, password });
        setMessage(r.message);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function demoLogin() {
    setBusy(true);
    setError("");
    try {
      await post("/auth/login", {
        email: "super_admin@medifed.demo",
        password: "MediFed-Demo-2026!",
      });
      location.href = "/dashboard";
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <Link className="brand" href="/">
          <span className="brand-icon">
            <Activity />
          </span>
          MediFed AI
        </Link>
        <div>
          <span className="eyebrow">BETTER TOGETHER. PRIVATE BY DESIGN.</span>
          <h1>
            Research without
            <br />
            boundaries.
            <br />
            <em>Data with them.</em>
          </h1>
          <p>
            A shared workspace for privacy-preserving federated learning and
            responsible healthcare AI research.
          </p>
          <div className="auth-trust">
            <ShieldCheck /> Synthetic data. Transparent methods. Human review.
          </div>
        </div>
        <small>Experimental research platform · No clinical use</small>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <span className="eyebrow">WELCOME TO MEDIFED AI</span>
          <h2>
            {mode === "login"
              ? "Your research starts here."
              : mode === "register"
                ? "Create your research workspace."
                : human(mode)}
          </h2>
          <p className="muted">
            {mode === "login"
              ? "Sign in to your collaborative research environment."
              : "Use synthetic data only in this research environment."}
          </p>
          <form onSubmit={submit}>
            {mode === "register" && (
              <label>
                Full name
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            )}
            {mode !== "reset-password" && (
              <label>
                Email address
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@institution.org"
                />
              </label>
            )}
            {mode === "reset-password" && (
              <label>
                Reset token
                <input
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
              </label>
            )}
            {mode !== "forgot-password" && (
              <label>
                Password
                <input
                  type="password"
                  minLength={mode === "login" ? 1 : 12}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === "login"
                      ? "Enter your password"
                      : "At least 12 characters"
                  }
                />
              </label>
            )}
            {mode === "login" && (
              <Link className="text-link forgot" href="/forgot-password">
                Forgot password?
              </Link>
            )}
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
            {message && (
              <div className="alert info" role="status">
                {message}
              </div>
            )}
            <button className="btn primary full" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : mode === "login" ? (
                "Sign in"
              ) : mode === "register" ? (
                "Create account"
              ) : mode === "forgot-password" ? (
                "Request reset"
              ) : (
                "Update password"
              )}
              <ArrowRight size={17} />
            </button>
          </form>
          {mode === "login" && demo && (
            <>
              <div className="divider">OR EXPLORE WITH SYNTHETIC DATA</div>
              <button
                onClick={demoLogin}
                className="btn secondary full"
                disabled={busy}
              >
                Enter research demo <ArrowRight size={16} />
              </button>
              <p className="tiny muted">
                Public demo · Temporary storage on Vercel · No real patient data
              </p>
            </>
          )}
          <p className="auth-bottom">
            {mode === "login" ? (
              <>
                New to MediFed? <Link href="/register">Create an account</Link>
              </>
            ) : (
              <Link href="/login">Back to sign in</Link>
            )}
            {mode === "forgot-password" && (
              <>
                {" "}
                · <Link href="/reset-password">Use reset token</Link>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
