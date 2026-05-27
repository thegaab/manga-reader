"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "reader";
}

interface Session {
  id: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const res = await fetch("/api/account/profile");
    if (!res.ok) {
      router.replace("/login");
      return;
    }
    const data = await res.json();
    setUser(data.user);
    setName(data.user.name);
    const sessionsRes = await fetch("/api/account/sessions");
    const sessionsData = await sessionsRes.json();
    setSessions(sessionsData.sessions || []);
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setMessage(res.ok ? "Perfil atualizado." : "Nao foi possivel atualizar.");
    await load();
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, password }),
    });
    const data = await res.json();
    setMessage(res.ok ? "Senha alterada. Entre novamente nos outros dispositivos." : data.error);
    setCurrentPassword("");
    setPassword("");
    await load();
  }

  async function revokeOthers() {
    await fetch("/api/account/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "others" }),
    });
    await load();
  }

  if (!user) return <div className="loading-screen"><div>CARREGANDO...</div></div>;

  return (
    <div className="home-shell">
      <header className="home-header">
        <Link href="/" className="home-brand" style={{ textDecoration: "none" }}>
          <img src="/mangakai-logo.png" alt="MangaKai" className="home-logo" />
          <span className="home-brand-text">MangaKai <span>漫画会</span></span>
        </Link>
      </header>
      <main className="home-main admin-layout">
        <section className="admin-card">
          <h1>Perfil</h1>
          <p>{user.email} · {user.role}</p>
          <form onSubmit={saveProfile} className="admin-form">
            <input className="title-input" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="auth-submit">Salvar perfil</button>
          </form>
        </section>

        <section className="admin-card">
          <h2>Trocar senha</h2>
          <form onSubmit={changePassword} className="admin-form">
            <input className="title-input" type="password" placeholder="Senha atual" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            <input className="title-input" type="password" placeholder="Nova senha" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="auth-submit">Trocar senha</button>
          </form>
        </section>

        <section className="admin-card">
          <h2>Sessoes ativas</h2>
          <button className="nav-ghost" onClick={revokeOthers}>Sair dos outros dispositivos</button>
          <div className="admin-list">
            {sessions.map((session) => (
              <div key={session.id} className="admin-list-row">
                <span>{new Date(session.createdAt).toLocaleString("pt-BR")}</span>
                <strong>{session.current ? "Atual" : "Outra sessao"}</strong>
              </div>
            ))}
          </div>
        </section>
        {message && <div className="upload-status">{message}</div>}
      </main>
    </div>
  );
}
