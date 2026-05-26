import { readMangaCatalog, readSeriesCatalog, writeMangaCatalog, writeSeriesCatalog } from "./storage";

export interface Manga {
  id: string;
  seriesId?: string;
  title: string;
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
  return (await readMangas()).filter((manga) => manga.seriesId === seriesId);
}
