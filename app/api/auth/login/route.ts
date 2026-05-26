import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  authenticateUser,
  createSession,
  sessionCookieName,
  sessionMaxAgeSeconds,
  shouldUseSecureSessionCookie,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const user = await authenticateUser(String(body.email || ""), String(body.password || ""));
  if (!user) {
    return NextResponse.json({ error: "Email ou senha invalidos." }, { status: 401 });
  }

  const token = await createSession(user.id);
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureSessionCookie(req),
    path: "/",
    maxAge: sessionMaxAgeSeconds(),
  });

  return NextResponse.json({ user });
}
