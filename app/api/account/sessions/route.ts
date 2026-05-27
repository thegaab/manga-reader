import { NextRequest, NextResponse } from "next/server";
import { listCurrentUserSessions, revokeCurrentUserSession, revokeOtherCurrentUserSessions } from "@/lib/auth";

export async function GET() {
  const sessions = await listCurrentUserSessions();
  return NextResponse.json({ sessions });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.mode === "others") {
    await revokeOtherCurrentUserSessions();
    return NextResponse.json({ success: true });
  }
  if (body.sessionId) {
    await revokeCurrentUserSession(String(body.sessionId));
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "Informe a sessao." }, { status: 400 });
}
