"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "reader";
  active: boolean;
}

interface Invite {
  id: string;
  code?: string;
  codePreview: string;
  role: "admin" | "reader";
  active: boolean;
  usedAt?: string;
  expiresAt?: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteRole, setInviteRole] = useState<"admin" | "reader">("reader");
  const [lastCode, setLastCode] = useState("");
  const [resetCode, setResetCode] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const [usersRes, invitesRes] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/admin/invites"),
    ]);
    if (!usersRes.ok) {
      router.replace("/");
      return;
    }
    setUsers((await usersRes.json()).users || []);
    setInvites((await invitesRes.json()).invites || []);
  }

  async function updateUser(user: User, patch: Partial<User>) {
    await fetch("/api/admin/users/" + user.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await load();
  }

  async function createInvite() {
    const res = await fetch("/api/admin/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: inviteRole }),
    });
    const data = await res.json();
    setLastCode(data.invite.code);
    await load();
  }

  async function createReset(user: User) {
    const res = await fetch("/api/admin/users/" + user.id + "/reset-password", { method: "POST" });
    const data = await res.json();
    setResetCode(data.reset.code);
  }

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
          <h1>Admin</h1>
          <p>Gerencie usuarios, roles, acesso e convites.</p>
        </section>

        <section className="admin-card">
          <h2>Novo convite</h2>
          <div className="admin-actions">
            <select className="title-input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "admin" | "reader")}>
              <option value="reader">Reader</option>
              <option value="admin">Admin</option>
            </select>
            <button className="auth-submit" onClick={createInvite}>Gerar codigo</button>
          </div>
          {lastCode && <div className="admin-code">Codigo: {lastCode}</div>}
        </section>

        <section className="admin-card">
          <h2>Usuarios</h2>
          <div className="admin-list">
            {users.map((user) => (
              <div key={user.id} className="admin-list-row">
                <div>
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                </div>
                <select value={user.role} onChange={(e) => updateUser(user, { role: e.target.value as "admin" | "reader" })}>
                  <option value="reader">reader</option>
                  <option value="admin">admin</option>
                </select>
                <button onClick={() => updateUser(user, { active: !user.active })}>{user.active ? "Desativar" : "Ativar"}</button>
                <button onClick={() => createReset(user)}>Reset senha</button>
              </div>
            ))}
          </div>
          {resetCode && <div className="admin-code">Codigo de reset: {resetCode}</div>}
        </section>

        <section className="admin-card">
          <h2>Convites</h2>
          <div className="admin-list">
            {invites.map((invite) => (
              <div key={invite.id} className="admin-list-row">
                <span>...{invite.codePreview}</span>
                <strong>{invite.role}</strong>
                <span>{invite.usedAt ? "usado" : invite.active ? "ativo" : "inativo"}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
