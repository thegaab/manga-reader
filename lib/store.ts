import { readMangaCatalog, writeMangaCatalog } from "./storage";

export interface Manga {
  id: string;
  title: string;
  pages: number;
  uploadedAt: string;
  coverPage: string;
  pdfPath: string;
  storage?: "local" | "s3";
}

export async function readMangas(): Promise<Manga[]> {
  return readMangaCatalog();
}

export async function writeMangas(mangas: Manga[]): Promise<void> {
  await writeMangaCatalog(mangas);
}

export async function getManga(id: string): Promise<Manga | null> {
  return (await readMangas()).find((m) => m.id === id) ?? null;
}

export async function addManga(manga: Manga): Promise<void> {
  const mangas = await readMangas();
  mangas.push(manga);
  await writeMangas(mangas);
}

export async function deleteManga(id: string): Promise<void> {
  const mangas = (await readMangas()).filter((m) => m.id !== id);
  await writeMangas(mangas);
}
