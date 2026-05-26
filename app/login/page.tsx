"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Nao foi possivel entrar.");
      setLoading(false);
      return;
    }

    router.replace("/");
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", display: "grid", placeItems: "center", padding: "1.5rem" }}>
      <form onSubmit={handleSubmit} style={{
        width: "100%", maxWidth: 380, background: "var(--bg2)", border: "1px solid var(--border)",
        borderTop: "3px solid var(--accent)", padding: "2rem", display: "flex", flexDirection: "column", gap: "1rem",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.35rem" }}>
            <img src="/mangakai-logo.png" alt="MangaKai" style={{ width: 46, height: 46, objectFit: "contain" }} />
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2rem", letterSpacing: "0.04em" }}>
              MangaKai <span style={{ color: "var(--accent)" }}>漫画会</span>
            </div>
          </div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Entrar na sua conta
          </div>
        </div>

        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required
          style={inputStyle} />
        <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required
          style={inputStyle} />

        {error && (
          <div style={{ color: "#ff8a7a", fontFamily: "'Space Mono', monospace", fontSize: "0.75rem" }}>
            {error}
          </div>
        )}

        <button disabled={loading} style={{
          background: loading ? "var(--bg3)" : "var(--accent)", border: "none", color: "#fff",
          padding: "0.8rem", fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.1rem",
          letterSpacing: "0.08em", cursor: loading ? "not-allowed" : "pointer",
        }}>
          {loading ? "ENTRANDO..." : "ENTRAR"}
        </button>

        <Link href="/register" style={{ color: "var(--text-muted)", fontFamily: "'Space Mono', monospace", fontSize: "0.75rem", textAlign: "center" }}>
          Criar usuario
        </Link>
      </form>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  background: "var(--bg3)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  padding: "0.75rem 1rem",
  fontFamily: "'Noto Sans JP', sans-serif",
  fontSize: "0.9rem",
  outline: "none",
} as const;
