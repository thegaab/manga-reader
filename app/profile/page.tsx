"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
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

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  }, [password]);

  if (!user) return <div className="loading-screen"><div>CARREGANDO...</div></div>;

  return (
    <div className="home-shell admin-screen">
      <header className="admin-topbar">
        <Link href="/" className="home-brand" style={{ textDecoration: "none" }}>
          <img src="/mangakai-logo.png" alt="MangaKai" className="home-logo" />
          <span className="home-brand-text">MangaKai <span>漫画会</span></span>
        </Link>
        <nav className="admin-tabs">
          <a href="#perfil">Perfil</a>
          <a href="#seguranca">Seguranca</a>
          <a href="#sessoes">Sessoes</a>
        </nav>
        <div className="nav-user">{user.name.slice(0, 1).toUpperCase()}</div>
      </header>
      <main className="admin-main profile-main">
        <section className="profile-panel" id="perfil">
          <div className="profile-identity">
            <div className="profile-avatar">{user.name.slice(0, 2).toUpperCase()}<span /></div>
            <div>
              <h1>{user.name}</h1>
              <p>{user.email}</p>
              <span className="admin-pill red">{user.role}</span>
            </div>
          </div>
          <form onSubmit={saveProfile} className="profile-form">
            <label>Nome de exibicao</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
            <label>E-mail</label>
            <input value={user.email} disabled />
            <button>Salvar alteracoes</button>
          </form>
        </section>

        <section className="profile-panel" id="seguranca">
          <h2>Seguranca</h2>
          <p>Troque sua senha regularmente</p>
          <form onSubmit={changePassword} className="profile-form">
            <label>Senha atual</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            <label>Nova senha</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <div className="password-meter">
              {[0, 1, 2, 3].map((item) => <span key={item} className={passwordStrength > item ? "active" : ""} />)}
            </div>
            <small>{passwordStrength >= 3 ? "Senha forte" : "Use 8+ caracteres, numeros e variacao"}</small>
            <button>Atualizar senha</button>
          </form>
        </section>

        <section className="profile-panel" id="sessoes">
          <h2>Sessoes ativas</h2>
          <p>Dispositivos conectados a sua conta</p>
          <div className="session-list">
            {sessions.map((session) => (
              <div key={session.id} className="session-row">
                <div className="session-icon" />
                <div>
                  <strong>{session.current ? "Este dispositivo" : "Outra sessao"}</strong>
                  <span>{new Date(session.createdAt).toLocaleString("pt-BR")}</span>
                </div>
                {session.current && <span className="session-dot" />}
              </div>
            ))}
          </div>
          <button className="danger-outline" onClick={revokeOthers}>Encerrar todas as outras sessoes</button>
        </section>
        {message && <div className="admin-code">{message}</div>}
      </main>
    </div>
  );
}
