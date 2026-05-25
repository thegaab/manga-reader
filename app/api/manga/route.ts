import { NextResponse } from "next/server";
import { readMangas } from "@/lib/store";

export async function GET() {
  const mangas = await readMangas();
  return NextResponse.json(mangas);
}
