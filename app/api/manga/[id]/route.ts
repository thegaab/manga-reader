import { NextRequest, NextResponse } from "next/server";
import { getManga, deleteManga } from "@/lib/store";
import { deleteMangaObjects } from "@/lib/storage";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const manga = await getManga(id);
  if (!manga) return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });
  return NextResponse.json(manga);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const manga = await getManga(id);
  if (!manga) return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });

  await deleteMangaObjects(id);
  await deleteManga(id);
  return NextResponse.json({ success: true });
}
