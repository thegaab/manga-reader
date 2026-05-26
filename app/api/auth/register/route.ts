import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createSession,
  registerUser,
  sessionCookieName,
  sessionMaxAgeSeconds,
  shouldUseSecureSessionCookie,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await registerUser(String(body.name || ""), String(body.email || ""), String(body.password || ""));
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao criar usuario.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
