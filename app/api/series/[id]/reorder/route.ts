import { NextRequest, NextResponse } from "next/server";
import { getSeries, reorderSeriesMangas } from "@/lib/store";
import { requireAdmin } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Sem permissao para reordenar capitulos." }, { status: 403 });

  const { id } = await params;
  const series = await getSeries(id);
  if (!series) return NextResponse.json({ error: "Serie nao encontrada." }, { status: 404 });

  const body = await req.json();
  const mangaIds = Array.isArray(body.mangaIds) ? body.mangaIds.map(String) : [];
  if (mangaIds.length === 0) {
    return NextResponse.json({ error: "Informe a ordem dos capitulos." }, { status: 400 });
  }

  const mangas = await reorderSeriesMangas(id, mangaIds);
  return NextResponse.json({ mangas });
}
