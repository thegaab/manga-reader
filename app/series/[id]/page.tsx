"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Manga {
  id: string;
  title: string;
  pages: number;
  uploadedAt: string;
  coverPage: string;
}

interface MangaSeries {
  id: string;
  title: string;
  coverPage: string;
}

export default function SeriesPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [series, setSeries] = useState<MangaSeries | null>(null);
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.replace("/login");
        return;
      }

      const res = await fetch("/api/series/" + id + "/manga");
      if (!res.ok) {
        router.replace("/");
        return;
      }
      const data = await res.json();
      setSeries(data.series);
      setMangas(data.mangas || []);
      setLoading(false);
    }

    void load();
  }, [id, router]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  if (loading) {
    return (
      <div className="loading-screen">
        <div>CARREGANDO...</div>
      </div>
    );
  }

  if (!series) return null;

  return (
    <div className="home-shell">
      <header className="home-header">
        <Link href="/" className="home-brand" style={{ textDecoration: "none" }}>
          <img src="/mangakai-logo.png" alt="MangaKai" className="home-logo" />
          <span className="home-brand-text">MangaKai <span>漫画会</span></span>
        </Link>
      </header>

      <main className="home-main">
        <section className="series-hero">
          <div className="series-cover">
            {series.coverPage ? <img src={series.coverPage} alt={series.title} /> : <div className="cover-placeholder">{series.title.slice(0, 1)}</div>}
          </div>
          <div>
            <Link href="/" className="back-link">Voltar</Link>
            <h1>{series.title}</h1>
            <p>{mangas.length} capitulos</p>
          </div>
        </section>

        <div className="manga-grid">
          {mangas.map((manga) => (
            <div key={manga.id} className="manga-card-wrapper">
              <Link href={"/read/" + manga.id} style={{ textDecoration: "none" }}>
                <div className="manga-card">
                  <div className="manga-cover">
                    <img src={manga.coverPage} alt={manga.title} />
                  </div>
                  <div className="manga-info">
                    <div>{manga.title}</div>
                    <p>
                      <span>{manga.pages}p</span>
                      <span>{formatDate(manga.uploadedAt)}</span>
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
