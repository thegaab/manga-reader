import { NextResponse } from "next/server";
import { getCurrentUser, getUserProgress } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  const progress = await getUserProgress(user.id);
  return NextResponse.json({
    progress: Object.fromEntries(
      progress.map((item) => [item.mangaId, { page: item.page, lastRead: item.lastRead }])
    ),
  });
}
