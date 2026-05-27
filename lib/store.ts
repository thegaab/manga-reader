import { readMangaCatalog, readSeriesCatalog, writeMangaCatalog, writeSeriesCatalog } from "./storage";

export interface Manga {
  id: string;
  seriesId?: string;
  title: string;
  chapterNumber?: number;
  sortOrder?: number;
  pages: number;
  uploadedAt: string;
  coverPage: string;
  pdfPath: string;
  storage?: "local" | "s3";
}

export interface MangaSeries {
  id: string;
  title: string;
  coverPage: string;
  createdAt: string;
  updatedAt: string;
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

export async function updateManga(id: string, updates: Partial<Manga>): Promise<Manga | null> {
  const mangas = await readMangas();
  const index = mangas.findIndex((manga) => manga.id === id);
  if (index === -1) return null;

  mangas[index] = { ...mangas[index], ...updates, id };
  await writeMangas(mangas);
  return mangas[index];
}

export async function readSeries(): Promise<MangaSeries[]> {
  return readSeriesCatalog();
}

export async function getSeries(id: string): Promise<MangaSeries | null> {
  return (await readSeries()).find((series) => series.id === id) ?? null;
}

export async function addSeries(series: MangaSeries): Promise<void> {
  const allSeries = await readSeries();
  allSeries.push(series);
  await writeSeriesCatalog(allSeries);
}

export async function updateSeries(series: MangaSeries): Promise<void> {
  const allSeries = await readSeries();
  await writeSeriesCatalog(allSeries.map((item) => item.id === series.id ? series : item));
}

export async function getMangasBySeries(seriesId: string): Promise<Manga[]> {
  return sortMangas((await readMangas()).filter((manga) => manga.seriesId === seriesId));
}

export async function reorderSeriesMangas(seriesId: string, mangaIds: string[]): Promise<Manga[]> {
  const mangas = await readMangas();
  const order = new Map(mangaIds.map((id, index) => [id, index + 1]));
  const updated = mangas.map((manga) => (
    manga.seriesId === seriesId && order.has(manga.id)
      ? { ...manga, sortOrder: order.get(manga.id) }
      : manga
  ));
  await writeMangas(updated);
  return sortMangas(updated.filter((manga) => manga.seriesId === seriesId));
}

export function sortMangas(mangas: Manga[]): Manga[] {
  return [...mangas].sort((a, b) => {
    const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;

    const chapterA = a.chapterNumber ?? Number.MAX_SAFE_INTEGER;
    const chapterB = b.chapterNumber ?? Number.MAX_SAFE_INTEGER;
    if (chapterA !== chapterB) return chapterA - chapterB;

    return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
  });
}
