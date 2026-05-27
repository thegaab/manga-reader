import { NextRequest, NextResponse } from "next/server";
import { createPasswordReset, requireAdmin } from "@/lib/auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Sem permissao." }, { status: 403 });

  const { id } = await params;
  const reset = await createPasswordReset(id);
  if (!reset) return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
  return NextResponse.json({ reset });
}
