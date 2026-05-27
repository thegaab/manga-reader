import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import crypto from "crypto";
import { readPrivateJson, writePrivateJson } from "./storage";

const AUTH_STORE_KEY = "auth/data.json";
const SESSION_COOKIE = "manga_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const PASSWORD_ITERATIONS = 210000;
const PASSWORD_KEY_LENGTH = 32;

export type UserRole = "admin" | "reader";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  role?: UserRole;
  active?: boolean;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

export interface ReadingProgress {
  userId: string;
  mangaId: string;
  page: number;
  lastRead: string;
  updatedAt: string;
}

interface Session {
  id?: string;
  tokenHash: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
}

export interface PublicSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

export interface InviteCode {
  id: string;
  codeHash: string;
  codePreview: string;
  role: UserRole;
  usedBy?: string;
  usedAt?: string;
  active: boolean;
  createdAt: string;
  expiresAt?: string;
}

interface PasswordResetCode {
  id: string;
  userId: string;
  codeHash: string;
  codePreview: string;
  usedAt?: string;
  createdAt: string;
  expiresAt: string;
}

interface AuthStore {
  users: User[];
  sessions: Session[];
  progress: ReadingProgress[];
  invites?: InviteCode[];
  passwordResets?: PasswordResetCode[];
}

const emptyStore: AuthStore = {
  users: [],
  sessions: [],
  progress: [],
  invites: [],
  passwordResets: [],
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || "reader",
    active: user.active !== false,
  };
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateHumanCode(): string {
  return crypto.randomBytes(18).toString("base64url");
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, "hex");
  const bBuffer = Buffer.from(b, "hex");
  return aBuffer.length === bBuffer.length && crypto.timingSafeEqual(aBuffer, bBuffer);
}

function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")): string {
  const hash = crypto
    .pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, "sha256")
    .toString("hex");
  return `pbkdf2_sha256$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [algorithm, iterations, salt, hash] = storedHash.split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterations || !salt || !hash) return false;
  const candidate = crypto
    .pbkdf2Sync(password, salt, Number(iterations), PASSWORD_KEY_LENGTH, "sha256")
    .toString("hex");
  return timingSafeEqual(candidate, hash);
}

async function readAuthStore(): Promise<AuthStore> {
  const store = await readPrivateJson<AuthStore>(AUTH_STORE_KEY, emptyStore);
  return {
    users: Array.isArray(store.users)
      ? store.users.map((user) => ({ ...user, role: user.role || "reader", active: user.active !== false }))
      : [],
    sessions: Array.isArray(store.sessions)
      ? store.sessions.map((session) => ({ ...session, id: session.id || session.tokenHash.slice(0, 16) }))
      : [],
    progress: Array.isArray(store.progress) ? store.progress : [],
    invites: Array.isArray(store.invites) ? store.invites : [],
    passwordResets: Array.isArray(store.passwordResets) ? store.passwordResets : [],
  };
}

async function writeAuthStore(store: AuthStore): Promise<void> {
  await writePrivateJson(AUTH_STORE_KEY, store);
}

export async function registerUser(name: string, email: string, password: string, inviteCode: string): Promise<PublicUser> {
  const cleanName = name.trim();
  const cleanEmail = normalizeEmail(email);
  if (cleanName.length < 2) throw new Error("Nome invalido.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error("Email invalido.");
  if (password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  if (!inviteCode.trim()) throw new Error("Informe o codigo de convite.");

  const store = await readAuthStore();
  if (store.users.some((user) => user.email === cleanEmail)) {
    throw new Error("Este email ja esta cadastrado.");
  }
  const invite = (store.invites || []).find((item) => item.codeHash === hashToken(inviteCode.trim()));
  if (!invite || !invite.active || invite.usedAt || (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now())) {
    throw new Error("Codigo de convite invalido ou expirado.");
  }

  const user: User = {
    id: crypto.randomUUID(),
    name: cleanName,
    email: cleanEmail,
    passwordHash: hashPassword(password),
    role: invite.role,
    active: true,
    createdAt: new Date().toISOString(),
  };

  store.users.push(user);
  invite.usedBy = user.id;
  invite.usedAt = new Date().toISOString();
  invite.active = false;
  await writeAuthStore(store);
  return toPublicUser(user);
}

export async function authenticateUser(email: string, password: string): Promise<PublicUser | null> {
  const store = await readAuthStore();
  const user = store.users.find((candidate) => candidate.email === normalizeEmail(email));
  if (!user || user.active === false || !verifyPassword(password, user.passwordHash)) return null;
  return toPublicUser(user);
}

export async function createSession(userId: string): Promise<string> {
  const store = await readAuthStore();
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  store.sessions = store.sessions.filter((session) => new Date(session.expiresAt).getTime() > now);
  store.sessions.push({
    id: crypto.randomUUID(),
    tokenHash: hashToken(token),
    userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  });
  await writeAuthStore(store);
  return token;
}

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return;

  const store = await readAuthStore();
  const tokenHash = hashToken(token);
  store.sessions = store.sessions.filter((session) => session.tokenHash !== tokenHash);
  await writeAuthStore(store);
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const store = await readAuthStore();
  const tokenHash = hashToken(token);
  const session = store.sessions.find((candidate) => candidate.tokenHash === tokenHash);
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null;

  const user = store.users.find((candidate) => candidate.id === session.userId);
  if (user?.active === false) return null;
  return user ? toPublicUser(user) : null;
}

export function canWrite(user: PublicUser | null): boolean {
  return user?.role === "admin";
}

export async function requireAdmin(): Promise<PublicUser | null> {
  const user = await getCurrentUser();
  return canWrite(user) ? user : null;
}

export async function updateUserRole(userId: string, role: UserRole): Promise<PublicUser | null> {
  const store = await readAuthStore();
  const user = store.users.find((candidate) => candidate.id === userId);
  if (!user) return null;

  user.role = role;
  await writeAuthStore(store);
  return toPublicUser(user);
}

export async function listUsers(): Promise<PublicUser[]> {
  const store = await readAuthStore();
  return store.users.map(toPublicUser);
}

export async function updateUserAccess(userId: string, updates: { role?: UserRole; active?: boolean; name?: string }): Promise<PublicUser | null> {
  const store = await readAuthStore();
  const user = store.users.find((candidate) => candidate.id === userId);
  if (!user) return null;

  if (updates.role) user.role = updates.role;
  if (typeof updates.active === "boolean") user.active = updates.active;
  if (updates.name?.trim()) user.name = updates.name.trim();
  if (updates.active === false) {
    store.sessions = store.sessions.filter((session) => session.userId !== userId);
  }
  await writeAuthStore(store);
  return toPublicUser(user);
}

export async function updateCurrentUserProfile(name: string): Promise<PublicUser | null> {
  const current = await getCurrentUser();
  if (!current) return null;
  return updateUserAccess(current.id, { name });
}

export async function changeCurrentUserPassword(currentPassword: string, nextPassword: string): Promise<boolean> {
  if (nextPassword.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  const current = await getCurrentUser();
  if (!current) return false;

  const store = await readAuthStore();
  const user = store.users.find((candidate) => candidate.id === current.id);
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) return false;

  user.passwordHash = hashPassword(nextPassword);
  store.sessions = store.sessions.filter((session) => session.userId !== user.id);
  await writeAuthStore(store);
  return true;
}

export async function createInvite(role: UserRole, expiresInDays = 14): Promise<InviteCode & { code: string }> {
  const code = generateHumanCode();
  const now = Date.now();
  const invite: InviteCode = {
    id: crypto.randomUUID(),
    codeHash: hashToken(code),
    codePreview: code.slice(-6),
    role,
    active: true,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
  };
  const store = await readAuthStore();
  store.invites = [...(store.invites || []), invite];
  await writeAuthStore(store);
  return { ...invite, code };
}

export async function listInvites(): Promise<InviteCode[]> {
  const store = await readAuthStore();
  return store.invites || [];
}

export async function createPasswordReset(userId: string): Promise<(PasswordResetCode & { code: string }) | null> {
  const code = generateHumanCode();
  const store = await readAuthStore();
  const user = store.users.find((candidate) => candidate.id === userId);
  if (!user) return null;

  const now = Date.now();
  const reset: PasswordResetCode = {
    id: crypto.randomUUID(),
    userId,
    codeHash: hashToken(code),
    codePreview: code.slice(-6),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 60 * 60 * 1000).toISOString(),
  };
  store.passwordResets = [...(store.passwordResets || []).filter((item) => !item.usedAt), reset];
  await writeAuthStore(store);
  return { ...reset, code };
}

export async function resetPassword(email: string, code: string, nextPassword: string): Promise<boolean> {
  if (nextPassword.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  const store = await readAuthStore();
  const user = store.users.find((candidate) => candidate.email === normalizeEmail(email));
  if (!user || user.active === false) return false;

  const reset = (store.passwordResets || []).find((item) =>
    item.userId === user.id &&
    item.codeHash === hashToken(code.trim()) &&
    !item.usedAt &&
    new Date(item.expiresAt).getTime() > Date.now()
  );
  if (!reset) return false;

  user.passwordHash = hashPassword(nextPassword);
  reset.usedAt = new Date().toISOString();
  store.sessions = store.sessions.filter((session) => session.userId !== user.id);
  await writeAuthStore(store);
  return true;
}

export async function listCurrentUserSessions(): Promise<PublicSession[]> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const currentHash = token ? hashToken(token) : "";
  const current = await getCurrentUser();
  if (!current) return [];

  const store = await readAuthStore();
  return store.sessions
    .filter((session) => session.userId === current.id && new Date(session.expiresAt).getTime() > Date.now())
    .map((session) => ({
      id: session.id || session.tokenHash,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      current: session.tokenHash === currentHash,
    }));
}

export async function revokeCurrentUserSession(sessionId: string): Promise<void> {
  const current = await getCurrentUser();
  if (!current) return;

  const store = await readAuthStore();
  store.sessions = store.sessions.filter((session) => !(session.userId === current.id && (session.id || session.tokenHash) === sessionId));
  await writeAuthStore(store);
}

export async function revokeOtherCurrentUserSessions(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const currentHash = token ? hashToken(token) : "";
  const current = await getCurrentUser();
  if (!current) return;

  const store = await readAuthStore();
  store.sessions = store.sessions.filter((session) => session.userId !== current.id || session.tokenHash === currentHash);
  await writeAuthStore(store);
}

export function sessionCookieName(): string {
  return SESSION_COOKIE;
}

export function sessionMaxAgeSeconds(): number {
  return SESSION_TTL_MS / 1000;
}

export function shouldUseSecureSessionCookie(req: NextRequest): boolean {
  return req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
}

export async function getUserProgress(userId: string): Promise<ReadingProgress[]> {
  const store = await readAuthStore();
  return store.progress.filter((item) => item.userId === userId);
}

export async function getMangaProgress(userId: string, mangaId: string): Promise<ReadingProgress | null> {
  const store = await readAuthStore();
  return store.progress.find((item) => item.userId === userId && item.mangaId === mangaId) ?? null;
}

export async function saveMangaProgress(userId: string, mangaId: string, page: number): Promise<ReadingProgress> {
  const store = await readAuthStore();
  const now = new Date().toISOString();
  const safePage = Math.max(1, Math.floor(page));
  const existing = store.progress.find((item) => item.userId === userId && item.mangaId === mangaId);

  if (existing) {
    existing.page = safePage;
    existing.lastRead = now;
    existing.updatedAt = now;
    await writeAuthStore(store);
    return existing;
  }

  const progress: ReadingProgress = {
    userId,
    mangaId,
    page: safePage,
    lastRead: now,
    updatedAt: now,
  };
  store.progress.push(progress);
  await writeAuthStore(store);
  return progress;
}
