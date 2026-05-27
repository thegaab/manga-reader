import { NextRequest, NextResponse } from "next/server";
import { changeCurrentUserPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ok = await changeCurrentUserPassword(String(body.currentPassword || ""), String(body.password || ""));
    if (!ok) return NextResponse.json({ error: "Senha atual invalida." }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Nao foi possivel trocar a senha.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
