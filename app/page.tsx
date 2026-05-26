"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Manga {
  id: string;
  seriesId?: string;
  title: string;
  pages: number;
  uploadedAt: string;
  coverPage: string;
}

interface MangaSeries {
  id: string;
  title: string;
  coverPage: string;
  createdAt: string;
  updatedAt: string;
}

interface History {
  [id: string]: { page: number; lastRead: string };
}

interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "reader";
}

type UploadMode = "pdf" | "images";

interface DroppedEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
}

interface DroppedFileEntry extends DroppedEntry {
  file: (successCallback: (file: File) => void, errorCallback?: (error: DOMException) => void) => void;
}

interface DroppedDirectoryEntry extends DroppedEntry {
  createReader: () => {
    readEntries: (
      successCallback: (entries: DroppedEntry[]) => void,
      errorCallback?: (error: DOMException) => void
    ) => void;
  };
}

export default function Home() {
  const router = useRouter();
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [series, setSeries] = useState<MangaSeries[]>([]);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [history, setHistory] = useState<History>({});
  const [user, setUser] = useState<PublicUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>("pdf");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [selectedSeriesCover, setSelectedSeriesCover] = useState<File | null>(null);
  const [titleInput, setTitleInput] = useState("");
  const [seriesMode, setSeriesMode] = useState<"existing" | "new">("existing");
  const [selectedSeriesId, setSelectedSeriesId] = useState("");
  const [seriesTitleInput, setSeriesTitleInput] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadInitialData() {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.replace("/login");
        return;
      }

      const meData = await meRes.json();
      setUser(meData.user);
      await Promise.all([fetchMangas(), fetchSeries(), fetchProgress()]);
      setAuthLoading(false);
    }

    void loadInitialData();
  }, [router]);

  async function fetchMangas() {
    const res = await fetch("/api/manga");
    const data = await res.json();
    setMangas(data);
  }

  async function fetchSeries() {
    const res = await fetch("/api/series");
    const data = await res.json();
    setSeries(data);
    setSelectedSeriesId((current) => current || data[0]?.id || "");
  }

  async function fetchProgress() {
    const res = await fetch("/api/progress");
    if (!res.ok) return;
    const data = await res.json();
    setHistory(data.progress || {});
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  async function handleUpload() {
    if (uploadMode === "pdf" && !selectedFile) return;
    if (uploadMode === "images" && !selectedFile && selectedImages.length === 0) return;
    setUploading(true);
    setUploadProgress(uploadMode === "pdf" ? "Enviando PDF..." : "Enviando imagens...");
    const formData = new FormData();
    formData.append("title", titleInput || selectedFile?.name.replace(/\.(pdf|zip)$/i, "") || "Sem titulo");
    if (seriesMode === "existing" && selectedSeriesId) {
      formData.append("seriesId", selectedSeriesId);
    }
    if (seriesMode === "new") {
      formData.append("seriesTitle", seriesTitleInput);
      if (selectedSeriesCover) formData.append("seriesCover", selectedSeriesCover);
    }

    if (uploadMode === "pdf" && selectedFile) {
      formData.append("pdf", selectedFile);
    } else if (selectedFile) {
      formData.append("archive", selectedFile);
    } else {
      selectedImages.forEach((file) => formData.append("images", file));
    }

    try {
      setUploadProgress("Convertendo paginas...");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        setUploadProgress("Concluido!");
        await Promise.all([fetchMangas(), fetchSeries()]);
        closeUploadModal();
      } else {
        setUploadProgress("Erro: " + data.error);
      }
    } catch {
      setUploadProgress("Erro ao enviar arquivo.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch("/api/manga/" + id, { method: "DELETE" });
    setDeleteConfirm(null);
    await fetchMangas();
  }

  function closeUploadModal() {
    setShowUploadModal(false);
    setSelectedFile(null);
    setSelectedImages([]);
    setSelectedSeriesCover(null);
    setTitleInput("");
    setSeriesTitleInput("");
    setUploadProgress("");
  }

  function readDroppedFile(entry: DroppedFileEntry): Promise<File> {
    return new Promise((resolve, reject) => entry.file(resolve, reject));
  }

  function readDirectoryEntries(entry: DroppedDirectoryEntry): Promise<DroppedEntry[]> {
    const reader = entry.createReader();
    const entries: DroppedEntry[] = [];

    return new Promise((resolve, reject) => {
      function readBatch() {
        reader.readEntries((batch) => {
          if (batch.length === 0) {
            resolve(entries);
            return;
          }
          entries.push(...batch);
          readBatch();
        }, reject);
      }

      readBatch();
    });
  }

  async function collectDroppedImages(entry: DroppedEntry): Promise<File[]> {
    if (entry.isFile) {
      const file = await readDroppedFile(entry as DroppedFileEntry);
      return /\.(jpe?g|png|webp)$/i.test(file.name) ? [file] : [];
    }

    if (!entry.isDirectory) return [];

    const entries = await readDirectoryEntries(entry as DroppedDirectoryEntry);
    const nested = await Promise.all(entries.map(collectDroppedImages));
    return nested.flat();
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (uploadMode === "pdf" && file?.type === "application/pdf") {
      setSelectedFile(file);
      setTitleInput(file.name.replace(".pdf", ""));
    } else if (uploadMode === "images" && file?.name.toLowerCase().endsWith(".zip")) {
      setSelectedFile(file);
      setSelectedImages([]);
      setTitleInput(file.name.replace(/\.zip$/i, ""));
    } else if (uploadMode === "images") {
      const entries = Array.from(e.dataTransfer.items)
        .map((item) => {
          const maybeEntry = item as DataTransferItem & {
            webkitGetAsEntry?: () => DroppedEntry | null;
          };
          return maybeEntry.webkitGetAsEntry?.();
        })
        .filter(Boolean) as DroppedEntry[];
      const images = entries.length > 0
        ? (await Promise.all(entries.map(collectDroppedImages))).flat()
        : Array.from(e.dataTransfer.files).filter((droppedFile) => /\.(jpe?g|png|webp)$/i.test(droppedFile.name));

      if (images.length > 0) {
        setSelectedImages(images);
        setSelectedFile(null);
        setTitleInput(entries.find((entry) => entry.isDirectory)?.name || "Capitulo");
      }
    }
  }

  function resetUploadSelection(mode = uploadMode) {
    setUploadMode(mode);
    setSelectedFile(null);
    setSelectedImages([]);
    setTitleInput("");
    setUploadProgress("");
  }

  const filteredSeries = series.filter((item) => item.title.toLowerCase().includes(search.toLowerCase()));
  const looseMangas = mangas.filter((manga) => !manga.seriesId);
  const filteredLooseMangas = looseMangas.filter((m) => m.title.toLowerCase().includes(search.toLowerCase()));
  const totalPages = mangas.reduce((a, m) => a + m.pages, 0);
  const activeReads = Object.keys(history).length;
  const canManageMangas = user?.role === "admin";

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  if (authLoading) {
    return (
      <div className="loading-screen">
        <div>CARREGANDO...</div>
      </div>
    );
  }

  return (
    <div className="home-shell">
      <header className="home-header">
        <div className="home-brand">
          <img src="/mangakai-logo.png" alt="MangaKai" className="home-logo" />
          <span className="home-brand-text">
            MangaKai <span>漫画会</span>
          </span>
        </div>

        <div className="home-actions">
          <input className="search-input" type="text" placeholder="Buscar manga..." value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="nav-user" type="button">{user?.name?.slice(0, 1).toUpperCase() || "U"}</button>
          <button className="nav-ghost" type="button" onClick={handleLogout}>Sair</button>
        </div>

        <button className="mobile-menu-button" type="button" onClick={() => setShowMobileMenu((open) => !open)} aria-label="Abrir menu">
          <span />
          <span />
          <span />
        </button>

        {showMobileMenu && (
          <div className="mobile-menu">
            <input className="search-input mobile-search" type="text" placeholder="Buscar manga..." value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {canManageMangas && (
              <button type="button" onClick={() => { setShowUploadModal(true); setShowMobileMenu(false); }}>Adicionar manga</button>
            )}
            <button type="button" onClick={handleLogout}>Sair</button>
          </div>
        )}
      </header>

      <main className="home-main">
        <section className="welcome-grid">
          <div className="welcome-card">
            <div>
              <p>Bem-vindo de volta</p>
              <h1>{user?.name || "Leitor"}</h1>
              <span>{activeReads > 0 ? `${activeReads} leitura${activeReads === 1 ? "" : "s"} em andamento` : "Sua biblioteca esta pronta para novas leituras"}</span>
            </div>
            <img src="/mangakai-logo.png" alt="" />
          </div>

          {canManageMangas && (
            <button className="quick-add-card" type="button" onClick={() => setShowUploadModal(true)}>
              <span>+</span>
              <strong>Adicionar manga</strong>
            </button>
          )}
        </section>

        <section className="stats-strip">
          {[
            { val: series.length, label: "Series", hint: "na sua colecao" },
            { val: totalPages, label: "Paginas totais", hint: "adicionadas" },
            { val: activeReads, label: "Em leitura", hint: "em progresso" },
          ].map((s) => (
            <div className="stat-card" key={s.label}>
              <span>{s.label}</span>
              <strong>{s.val}</strong>
              <p>{s.hint}</p>
            </div>
          ))}
        </section>

        {filteredSeries.length === 0 && filteredLooseMangas.length === 0 && search ? (
          <div className="empty-state">
            <div>Nenhum resultado</div>
            <span>Tente outra busca</span>
          </div>
        ) : (
          <div className="manga-grid">
            {filteredSeries.map((item) => {
              const chapters = mangas.filter((manga) => manga.seriesId === item.id);
              const pageCount = chapters.reduce((sum, manga) => sum + manga.pages, 0);
              return (
                <div key={item.id} className="manga-card-wrapper">
                  <Link href={"/series/" + item.id} style={{ textDecoration: "none" }}>
                    <div className="manga-card">
                      <div className="manga-cover">
                        {item.coverPage ? <img src={item.coverPage} alt={item.title} /> : <div className="cover-placeholder">{item.title.slice(0, 1)}</div>}
                      </div>
                      <div className="manga-info">
                        <div>{item.title}</div>
                        <p>
                          <span>{chapters.length} cap.</span>
                          <span>{pageCount}p</span>
                        </p>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
            {filteredLooseMangas.map((manga) => {
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
                          <span>{manga.pages}p</span>
                          <span>{h ? "p." + h.page : formatDate(manga.uploadedAt)}</span>
                        </p>
                      </div>
                    </div>
                  </Link>
                  {canManageMangas && (
                    <button onClick={(e) => { e.preventDefault(); setDeleteConfirm(manga.id); }} className="delete-btn">x</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showUploadModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !uploading) closeUploadModal(); }}>
          <div className="modal-panel upload-panel">
            <div className="modal-title">Adicionar manga</div>
            <div className="upload-tabs">
              <button type="button" onClick={() => resetUploadSelection("pdf")} disabled={uploading}
                className={uploadMode === "pdf" ? "active" : ""}>PDF</button>
              <button type="button" onClick={() => resetUploadSelection("images")} disabled={uploading}
                className={uploadMode === "images" ? "active" : ""}>Pasta / ZIP</button>
            </div>
            <div className={"upload-dropzone" + (dragOver ? " drag-over" : "")}
              onDrop={(e) => { void handleDrop(e); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" accept={uploadMode === "pdf" ? ".pdf,application/pdf" : ".zip,application/zip,application/x-zip-compressed"} style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setSelectedFile(f);
                  setSelectedImages([]);
                  setTitleInput(f.name.replace(/\.(pdf|zip)$/i, ""));
                }} />
              <input ref={(input) => {
                folderInputRef.current = input;
                input?.setAttribute("webkitdirectory", "");
                input?.setAttribute("directory", "");
              }} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple style={{ display: "none" }}
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setSelectedImages(files);
                  setSelectedFile(null);
                  if (files[0]) {
                    const folderName = files[0].webkitRelativePath?.split("/")[0];
                    setTitleInput(folderName || "Capitulo");
                  }
                }} />
              {selectedFile ? (
                <div>
                  <strong>{selectedFile.name}</strong>
                  <span>{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</span>
                </div>
              ) : selectedImages.length > 0 ? (
                <div>
                  <strong>{selectedImages.length} imagens selecionadas</strong>
                  <span>Ordenadas pelo nome automaticamente</span>
                </div>
              ) : (
                <div>
                  <strong>{uploadMode === "pdf" ? "Arraste um PDF aqui" : "Arraste um ZIP ou uma pasta"}</strong>
                  <span>ou clique para selecionar</span>
                </div>
              )}
            </div>
            {uploadMode === "images" && (
              <button type="button" className="folder-button" onClick={() => folderInputRef.current?.click()} disabled={uploading}>
                Abrir seletor de pasta
              </button>
            )}
            <input className="title-input" type="text" placeholder="Titulo do manga" value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
            />
            <div className="series-picker">
              <div className="upload-tabs">
                <button type="button" onClick={() => setSeriesMode("existing")} className={seriesMode === "existing" ? "active" : ""}>
                  Serie existente
                </button>
                <button type="button" onClick={() => setSeriesMode("new")} className={seriesMode === "new" ? "active" : ""}>
                  Nova serie
                </button>
              </div>
              {seriesMode === "existing" ? (
                <select className="title-input" value={selectedSeriesId} onChange={(e) => setSelectedSeriesId(e.target.value)}>
                  <option value="">Sem serie</option>
                  {series.map((item) => (
                    <option key={item.id} value={item.id}>{item.title}</option>
                  ))}
                </select>
              ) : (
                <div className="new-series-fields">
                  <input className="title-input" type="text" placeholder="Nome da serie" value={seriesTitleInput}
                    onChange={(e) => setSeriesTitleInput(e.target.value)}
                  />
                  <label className="cover-input">
                    <span>{selectedSeriesCover ? selectedSeriesCover.name : "Selecionar capa da serie"}</span>
                    <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      onChange={(e) => setSelectedSeriesCover(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              )}
            </div>
            {uploading && <div className="upload-status">{uploadProgress}</div>}
            <div className="modal-actions">
              <button onClick={closeUploadModal} disabled={uploading}>Cancelar</button>
              <button onClick={handleUpload} disabled={uploading || (uploadMode === "pdf" ? !selectedFile : !selectedFile && selectedImages.length === 0)}>
                {uploading ? "Processando..." : "Fazer upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-backdrop">
          <div className="modal-panel confirm-panel">
            <div className="modal-title">Remover manga?</div>
            <p>Isso ira deletar o PDF e todas as paginas permanentemente.</p>
            <div className="modal-actions">
              <button onClick={() => setDeleteConfirm(null)}>Nao</button>
              <button onClick={() => handleDelete(deleteConfirm)}>Deletar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
