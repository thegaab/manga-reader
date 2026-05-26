import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { zipToImages, uploadedImagesToPages } from "@/lib/image-upload";
import { pdfToImages } from "@/lib/pdf";
import { addManga } from "@/lib/store";
import {
  getStorageDriver,
  publicUrlForKey,
  uploadObject,
  uploadPagesFromDirectory,
} from "@/lib/storage";
import { getCurrentUser } from "@/lib/auth";
import fs from "fs";

function createTempMangaDir(id: string): string {
  const baseDir = path.join(process.cwd(), ".tmp", "uploads");
  fs.mkdirSync(baseDir, { recursive: true });
  return fs.mkdtempSync(path.join(baseDir, `${id}-`));
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  const id = uuidv4();
  const tempDir = createTempMangaDir(id);

  try {
    const formData = await req.formData();
    const pdfFile = formData.get("pdf") as File | null;
    const archiveFile = formData.get("archive") as File | null;
    const imageFiles = formData
      .getAll("images")
      .filter((value): value is File => value instanceof File);
    const title = (formData.get("title") as string) || "Sem titulo";
    const pagesDir = path.join(tempDir, "pages");

    let pageCount = 0;
    let sourcePdfKey = "";

    if (pdfFile && pdfFile.type === "application/pdf") {
      const pdfPath = path.join(tempDir, "source.pdf");
      const buffer = Buffer.from(await pdfFile.arrayBuffer());
      await writeFile(pdfPath, buffer);
      pageCount = await pdfToImages(pdfPath, pagesDir);

      sourcePdfKey = `mangas/${id}/source.pdf`;
      await uploadObject(sourcePdfKey, buffer, "application/pdf");
    } else if (archiveFile && archiveFile.name.toLowerCase().endsWith(".zip")) {
      const buffer = Buffer.from(await archiveFile.arrayBuffer());
      pageCount = await zipToImages(buffer, pagesDir);
    } else if (imageFiles.length > 0) {
      pageCount = await uploadedImagesToPages(imageFiles, pagesDir);
    } else {
      return NextResponse.json(
        { error: "Envie um PDF, um ZIP com imagens ou uma pasta de imagens." },
        { status: 400 }
      );
    }

    if (pageCount === 0) {
      return NextResponse.json(
        { error: "Nao foi possivel encontrar paginas validas no arquivo enviado." },
        { status: 500 }
      );
    }

    const pageKeys = await uploadPagesFromDirectory(id, pagesDir);
    const manga = {
      id,
      title,
      pages: pageCount,
      uploadedAt: new Date().toISOString(),
      coverPage: publicUrlForKey(pageKeys[0]),
      pdfPath: sourcePdfKey ? publicUrlForKey(sourcePdfKey) : "",
      storage: getStorageDriver(),
    };

    await addManga(manga);

    return NextResponse.json({ success: true, manga });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
