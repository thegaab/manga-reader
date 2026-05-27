"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, password }),
    });
    const data = await res.json();
    setMessage(res.ok ? "Senha redefinida. Voce ja pode entrar." : data.error || "Erro ao redefinir senha.");
    setLoading(false);
  }

  return (
    <main className="auth-screen">
      <form className="auth-panel" onSubmit={handleSubmit}>
        <div className="modal-title">Redefinir senha</div>
        <input className="title-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="title-input" type="text" placeholder="Codigo de reset" value={code} onChange={(e) => setCode(e.target.value)} required />
        <input className="title-input" type="password" placeholder="Nova senha" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {message && <div className="upload-status">{message}</div>}
        <button className="auth-submit" disabled={loading}>{loading ? "Salvando..." : "Redefinir"}</button>
        <Link href="/login" className="auth-link">Voltar ao login</Link>
      </form>
    </main>
  );
}
