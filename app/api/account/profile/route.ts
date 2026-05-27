import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, updateCurrentUserProfile } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  return NextResponse.json({ user });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const user = await updateCurrentUserProfile(String(body.name || ""));
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  return NextResponse.json({ user });
}
