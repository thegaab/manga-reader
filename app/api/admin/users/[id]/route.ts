import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, updateUserAccess, type UserRole } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Sem permissao." }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const role = body.role === "admin" || body.role === "reader" ? body.role as UserRole : undefined;
  const active = typeof body.active === "boolean" ? body.active : undefined;
  const name = typeof body.name === "string" ? body.name : undefined;

  const user = await updateUserAccess(id, { role, active, name });
  if (!user) return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
  return NextResponse.json({ user });
}
