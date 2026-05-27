"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "admin" | "reader" | "inactive">("all");

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

  const activeInvites = invites.filter((invite) => invite.active && !invite.usedAt).length;
  const roles = new Set(users.map((user) => user.role)).size;
  const filteredUsers = useMemo(() => users.filter((user) => {
    const matchesSearch = `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === "inactive") return !user.active;
    if (filter === "admin" || filter === "reader") return user.role === filter;
    return true;
  }), [users, search, filter]);

  return (
    <div className="home-shell admin-screen">
      <header className="admin-topbar">
        <Link href="/" className="home-brand" style={{ textDecoration: "none" }}>
          <img src="/mangakai-logo.png" alt="MangaKai" className="home-logo" />
          <span className="home-brand-text">MangaKai <span>漫画会</span></span>
        </Link>
        <nav className="admin-tabs">
          <a href="#usuarios">Usuarios</a>
          <a href="#convites">Convites</a>
        </nav>
      </header>

      <main className="admin-main">
        <section className="admin-summary-grid">
          <div className="admin-summary-card"><strong>{users.length}</strong><span>Usuarios</span></div>
          <div className="admin-summary-card"><strong>{activeInvites}</strong><span>Convites ativos</span></div>
          <div className="admin-summary-card"><strong>{roles}</strong><span>Roles</span></div>
        </section>

        <section className="admin-panel" id="usuarios">
          <div className="admin-panel-head">
            <div>
              <h1>Usuarios</h1>
              <p>{users.length} usuario{users.length === 1 ? "" : "s"} cadastrado{users.length === 1 ? "" : "s"}</p>
            </div>
            <button className="admin-primary-button" onClick={createInvite}>+ Convite</button>
          </div>
          <div className="admin-toolbar">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar usuario..." />
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="all">Todos</option>
              <option value="admin">Admins</option>
              <option value="reader">Readers</option>
              <option value="inactive">Inativos</option>
            </select>
          </div>
          <div className="admin-user-list">
            {filteredUsers.map((user) => (
              <div key={user.id} className="admin-user-row">
                <div className="admin-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
                <div className="admin-user-info">
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                </div>
                <select value={user.role} onChange={(e) => updateUser(user, { role: e.target.value as "admin" | "reader" })}>
                  <option value="reader">reader</option>
                  <option value="admin">admin</option>
                </select>
                <span className={"admin-pill " + (user.active ? "green" : "red")}>{user.active ? "ativo" : "inativo"}</span>
                <button onClick={() => updateUser(user, { active: !user.active })}>{user.active ? "Desativar" : "Ativar"}</button>
                <button onClick={() => createReset(user)}>Reset</button>
              </div>
            ))}
          </div>
          {resetCode && <div className="admin-code">Codigo de reset: {resetCode}</div>}
        </section>

        <section className="admin-panel" id="convites">
          <div className="admin-panel-head">
            <div>
              <h2>Convites pendentes</h2>
              <p>{activeInvites} convite{activeInvites === 1 ? "" : "s"} ativo{activeInvites === 1 ? "" : "s"}</p>
            </div>
            <div className="admin-invite-actions">
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "admin" | "reader")}>
                <option value="reader">reader</option>
                <option value="admin">admin</option>
              </select>
              <button className="admin-primary-button" onClick={createInvite}>+ Novo</button>
            </div>
          </div>
          {lastCode && <div className="admin-code">Codigo: {lastCode}</div>}
          <div className="admin-invite-list">
            {invites.map((invite) => (
              <div key={invite.id} className="admin-invite-row">
                <div>
                  <strong>{invite.code ? invite.code : "..." + invite.codePreview}</strong>
                  <span>{invite.expiresAt ? "expira em " + new Date(invite.expiresAt).toLocaleDateString("pt-BR") : "sem expiracao"}</span>
                </div>
                <span className="admin-pill">{invite.role}</span>
                <span className={"admin-pill " + (invite.usedAt ? "" : invite.active ? "green" : "red")}>{invite.usedAt ? "usado" : invite.active ? "ativo" : "inativo"}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
