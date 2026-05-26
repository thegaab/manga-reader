import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { addSeries, readSeries } from "@/lib/store";
import { publicUrlForKey, uploadObject } from "@/lib/storage";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const series = await readSeries();
  return NextResponse.json(series);
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Sem permissao para criar series." }, { status: 403 });

  const formData = await req.formData();
  const title = String(formData.get("title") || "").trim();
  const cover = formData.get("cover") as File | null;

  if (title.length < 2) {
    return NextResponse.json({ error: "Informe o nome da serie." }, { status: 400 });
  }

  const id = uuidv4();
  let coverPage = "";

  if (cover && cover.size > 0) {
    const extension = cover.name.toLowerCase().match(/\.(png|jpe?g|webp)$/)?.[1] || "png";
    const contentType = cover.type || "image/png";
    const coverKey = `mangas/series/${id}/cover.${extension}`;
    await uploadObject(coverKey, Buffer.from(await cover.arrayBuffer()), contentType);
    coverPage = publicUrlForKey(coverKey);
  }

  const now = new Date().toISOString();
  const series = {
    id,
    title,
    coverPage,
    createdAt: now,
    updatedAt: now,
  };
  await addSeries(series);

  return NextResponse.json({ success: true, series });
}
