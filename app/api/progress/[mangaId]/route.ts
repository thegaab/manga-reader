import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getMangaProgress, saveMangaProgress } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ mangaId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  const { mangaId } = await params;
  const progress = await getMangaProgress(user.id, mangaId);
  return NextResponse.json({ progress: progress ? { page: progress.page, lastRead: progress.lastRead } : null });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ mangaId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  const { mangaId } = await params;
  const body = await req.json();
  const page = Number(body.page);
  if (!Number.isFinite(page) || page < 1) {
    return NextResponse.json({ error: "Pagina invalida." }, { status: 400 });
  }

  const progress = await saveMangaProgress(user.id, mangaId, page);
  return NextResponse.json({ progress: { page: progress.page, lastRead: progress.lastRead } });
}
