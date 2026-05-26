"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

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

interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "reader";
}

type UploadMode = "pdf" | "images";

interface History {
  [id: string]: { page: number; lastRead: string };
}

export default function SeriesPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [series, setSeries] = useState<MangaSeries | null>(null);
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [history, setHistory] = useState<History>({});
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCover, setEditCover] = useState<File | null>(null);
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>("pdf");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [chapterTitle, setChapterTitle] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function load() {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.replace("/login");
        return;
      }

      const meData = await meRes.json();
      setUser(meData.user);
      await Promise.all([fetchSeries(), fetchProgress()]);
      setLoading(false);
    }

    void load();
  }, [id, router]);

  async function fetchSeries() {
    const res = await fetch("/api/series/" + id + "/manga");
    if (!res.ok) {
      router.replace("/");
      return;
    }

    const data = await res.json();
    setSeries(data.series);
    setMangas(data.mangas || []);
    setEditTitle(data.series.title);
  }

  async function fetchProgress() {
    const res = await fetch("/api/progress");
    if (!res.ok) return;
    const data = await res.json();
    setHistory(data.progress || {});
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    setEditError("");
    setSaving(true);

    const formData = new FormData();
    formData.append("title", editTitle);
    if (editCover) formData.append("cover", editCover);

    const res = await fetch("/api/series/" + id, {
      method: "PATCH",
      body: formData,
    });
    const data = await res.json();

    if (!res.ok) {
      setEditError(data.error || "Nao foi possivel editar a serie.");
      setSaving(false);
      return;
    }

    setSeries(data.series);
    setEditCover(null);
    setShowEditModal(false);
    setSaving(false);
  }

  async function handleChapterUpload(e: FormEvent) {
    e.preventDefault();
    if (uploadMode === "pdf" && !selectedFile) return;
    if (uploadMode === "images" && !selectedFile && selectedImages.length === 0) return;

    setUploading(true);
    setUploadStatus("Enviando capitulo...");

    const formData = new FormData();
    formData.append("seriesId", id);
    formData.append("title", chapterTitle || selectedFile?.name.replace(/\.(pdf|zip)$/i, "") || "Sem titulo");
    if (uploadMode === "pdf" && selectedFile) {
      formData.append("pdf", selectedFile);
    } else if (selectedFile) {
      formData.append("archive", selectedFile);
    } else {
      selectedImages.forEach((file) => formData.append("images", file));
    }

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();

    if (!res.ok || !data.success) {
      setUploadStatus(data.error || "Nao foi possivel enviar o capitulo.");
      setUploading(false);
      return;
    }

    setSelectedFile(null);
    setSelectedImages([]);
    setChapterTitle("");
    setShowUploadModal(false);
    setUploading(false);
    await fetchSeries();
  }

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

  const canEdit = user?.role === "admin";

  return (
    <div className="home-shell">
      <header className="home-header">
        <Link href="/" className="home-brand" style={{ textDecoration: "none" }}>
          <img src="/mangakai-logo.png" alt="MangaKai" className="home-logo" />
          <span className="home-brand-text">MangaKai <span>漫画会</span></span>
        </Link>
      </header>

      <main className="home-main">
        <Link href="/" className="series-back-link">Voltar</Link>
        <section className="series-banner">
          <div className="series-banner-main">
            {series.coverPage && <img src={series.coverPage} alt="" />}
            <div className="series-banner-content">
              <h1>{series.title}</h1>
              <p>{mangas.length} capitulos</p>
              {canEdit && (
                <div className="series-actions">
                  <button type="button" className="series-edit-button" onClick={() => setShowUploadModal(true)}>
                    Adicionar capitulo
                  </button>
                  <button type="button" className="series-edit-button" onClick={() => setShowEditModal(true)}>
                    Editar serie
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="manga-grid">
          {mangas.map((manga) => {
            const h = history[manga.id];
            const progress = h ? Math.round((h.page / manga.pages) * 100) : 0;
            return (
              <div key={manga.id} className="manga-card-wrapper">
                <Link href={"/read/" + manga.id} style={{ textDecoration: "none" }}>
                  <div className="manga-card">
                    <div className="manga-cover">
                      <img src={manga.coverPage} alt={manga.title} />
                      {h && (
                        <div className="manga-progress">
                          <div style={{ width: progress + "%" }} />
                        </div>
                      )}
                      {progress === 100 && <div className="read-badge">LIDO</div>}
                    </div>
                    <div className="manga-info">
                      <div>{manga.title}</div>
                      <p>
                        <span>{h ? "p." + h.page : `${manga.pages}p`}</span>
                        <span>{h ? `${progress}%` : formatDate(manga.uploadedAt)}</span>
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </main>

      {showEditModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !saving) setShowEditModal(false); }}>
          <form className="modal-panel" onSubmit={handleEditSubmit}>
            <div className="modal-title">Editar serie</div>
            <input className="title-input" type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            <label className="cover-input">
              <span>{editCover ? editCover.name : "Trocar imagem de capa"}</span>
              <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={(e) => setEditCover(e.target.files?.[0] || null)}
              />
            </label>
            {editError && <div className="upload-status">{editError}</div>}
            <div className="modal-actions">
              <button type="button" onClick={() => setShowEditModal(false)} disabled={saving}>Cancelar</button>
              <button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
            </div>
          </form>
        </div>
      )}

      {showUploadModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !uploading) setShowUploadModal(false); }}>
          <form className="modal-panel upload-panel" onSubmit={handleChapterUpload}>
            <div className="modal-title">Adicionar capitulo</div>
            <div className="upload-tabs">
              <button type="button" onClick={() => setUploadMode("pdf")} disabled={uploading}
                className={uploadMode === "pdf" ? "active" : ""}>PDF</button>
              <button type="button" onClick={() => setUploadMode("images")} disabled={uploading}
                className={uploadMode === "images" ? "active" : ""}>Pasta / ZIP</button>
            </div>
            <input className="title-input" type="text" placeholder="Titulo do capitulo" value={chapterTitle}
              onChange={(e) => setChapterTitle(e.target.value)}
            />
            <label className="cover-input">
              <span>{selectedFile ? selectedFile.name : selectedImages.length > 0 ? `${selectedImages.length} imagens selecionadas` : uploadMode === "pdf" ? "Selecionar PDF" : "Selecionar ZIP"}</span>
              <input type="file" accept={uploadMode === "pdf" ? ".pdf,application/pdf" : ".zip,application/zip,application/x-zip-compressed"}
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setSelectedFile(file);
                  setSelectedImages([]);
                  if (file && !chapterTitle) setChapterTitle(file.name.replace(/\.(pdf|zip)$/i, ""));
                }}
              />
            </label>
            {uploadStatus && <div className="upload-status">{uploadStatus}</div>}
            <div className="modal-actions">
              <button type="button" onClick={() => setShowUploadModal(false)} disabled={uploading}>Cancelar</button>
              <button type="submit" disabled={uploading || (uploadMode === "pdf" ? !selectedFile : !selectedFile && selectedImages.length === 0)}>
                {uploading ? "Processando..." : "Fazer upload"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
