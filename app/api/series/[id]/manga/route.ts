import { NextRequest, NextResponse } from "next/server";
import { getMangasBySeries, getSeries } from "@/lib/store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const series = await getSeries(id);
  if (!series) return NextResponse.json({ error: "Serie nao encontrada." }, { status: 404 });

  const mangas = await getMangasBySeries(id);
  return NextResponse.json({ series, mangas });
}
