import { NextRequest, NextResponse } from "next/server";
import { createInvite, listInvites, requireAdmin, type UserRole } from "@/lib/auth";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Sem permissao." }, { status: 403 });

  const invites = await listInvites();
  return NextResponse.json({ invites });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Sem permissao." }, { status: 403 });

  const body = await req.json();
  const role: UserRole = body.role === "admin" ? "admin" : "reader";
  const expiresInDays = Number(body.expiresInDays || 14);
  const invite = await createInvite(role, Number.isFinite(expiresInDays) ? expiresInDays : 14);
  return NextResponse.json({ invite });
}
