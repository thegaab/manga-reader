import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroyCurrentSession, sessionCookieName } from "@/lib/auth";

export async function POST() {
  await destroyCurrentSession();
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName());
  return NextResponse.json({ success: true });
}
