import { NextResponse } from "next/server";
import { listUsers, requireAdmin } from "@/lib/auth";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Sem permissao." }, { status: 403 });

  const users = await listUsers();
  return NextResponse.json({ users });
}
