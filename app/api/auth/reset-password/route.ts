import { NextRequest, NextResponse } from "next/server";
import { resetPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ok = await resetPassword(String(body.email || ""), String(body.code || ""), String(body.password || ""));
    if (!ok) return NextResponse.json({ error: "Codigo invalido ou expirado." }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Nao foi possivel redefinir a senha.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
