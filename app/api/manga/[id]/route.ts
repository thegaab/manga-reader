import { NextRequest, NextResponse } from "next/server";
import { getManga, deleteManga, getSeries, updateManga } from "@/lib/store";
import { deleteMangaObjects, publicUrlForKey, uploadObject } from "@/lib/storage";
import { requireAdmin } from "@/lib/auth";

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
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Sem permissao para remover mangas." }, { status: 403 });

  const { id } = await params;
  const manga = await getManga(id);
  if (!manga) return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });

  await deleteMangaObjects(id);
  await deleteManga(id);
  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Sem permissao para editar mangas." }, { status: 403 });

  const { id } = await params;
  const manga = await getManga(id);
  if (!manga) return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });

  const formData = await req.formData();
  const title = String(formData.get("title") || manga.title).trim();
  const rawChapterNumber = String(formData.get("chapterNumber") || "").trim();
  const rawSortOrder = String(formData.get("sortOrder") || "").trim();
  const rawSeriesId = String(formData.get("seriesId") || "").trim();
  const cover = formData.get("cover") as File | null;

  if (title.length < 1) {
    return NextResponse.json({ error: "Informe o titulo." }, { status: 400 });
  }
  const chapterNumber = rawChapterNumber ? Number(rawChapterNumber) : undefined;
  const sortOrder = rawSortOrder ? Number(rawSortOrder) : undefined;
  if (typeof chapterNumber === "number" && !Number.isFinite(chapterNumber)) {
    return NextResponse.json({ error: "Numero do capitulo invalido." }, { status: 400 });
  }
  if (typeof sortOrder === "number" && !Number.isFinite(sortOrder)) {
    return NextResponse.json({ error: "Ordem invalida." }, { status: 400 });
  }

  if (rawSeriesId) {
    const series = await getSeries(rawSeriesId);
    if (!series) return NextResponse.json({ error: "Serie nao encontrada." }, { status: 400 });
  }

  let coverPage = manga.coverPage;
  if (cover && cover.size > 0) {
    const extension = cover.name.toLowerCase().match(/\.(png|jpe?g|webp)$/)?.[1] || "png";
    const coverKey = `mangas/${id}/cover-${Date.now()}.${extension}`;
    await uploadObject(coverKey, Buffer.from(await cover.arrayBuffer()), cover.type || "image/png");
    coverPage = publicUrlForKey(coverKey);
  }

  const updated = await updateManga(id, {
    title,
    seriesId: rawSeriesId || undefined,
    chapterNumber,
    sortOrder,
    coverPage,
  });

  return NextResponse.json({ manga: updated });
}
