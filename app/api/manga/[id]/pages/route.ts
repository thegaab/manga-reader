import { NextRequest, NextResponse } from "next/server";
import { getManga } from "@/lib/store";
import { listPageKeys, publicUrlForKey } from "@/lib/storage";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const manga = await getManga(id);
  if (!manga) return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });

  const keys = await listPageKeys(id);
  const urls = keys.map(publicUrlForKey);

  return NextResponse.json({ pages: urls, total: urls.length });
}
