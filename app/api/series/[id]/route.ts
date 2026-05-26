import { NextRequest, NextResponse } from "next/server";
import { getSeries, updateSeries } from "@/lib/store";
import { publicUrlForKey, uploadObject } from "@/lib/storage";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Sem permissao para editar series." }, { status: 403 });

  const { id } = await params;
  const series = await getSeries(id);
  if (!series) return NextResponse.json({ error: "Serie nao encontrada." }, { status: 404 });

  const formData = await req.formData();
  const title = String(formData.get("title") || series.title).trim();
  const cover = formData.get("cover") as File | null;

  if (title.length < 2) {
    return NextResponse.json({ error: "Informe o nome da serie." }, { status: 400 });
  }

  let coverPage = series.coverPage;
  if (cover && cover.size > 0) {
    const extension = cover.name.toLowerCase().match(/\.(png|jpe?g|webp)$/)?.[1] || "png";
    const coverKey = `mangas/series/${id}/cover-${Date.now()}.${extension}`;
    await uploadObject(coverKey, Buffer.from(await cover.arrayBuffer()), cover.type || "image/png");
    coverPage = publicUrlForKey(coverKey);
  }

  const updatedSeries = {
    ...series,
    title,
    coverPage,
    updatedAt: new Date().toISOString(),
  };
  await updateSeries(updatedSeries);

  return NextResponse.json({ success: true, series: updatedSeries });
}
