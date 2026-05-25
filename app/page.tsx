"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Manga {
  id: string;
  title: string;
  pages: number;
  uploadedAt: string;
  coverPage: string;
}

interface History {
  [id: string]: { page: number; lastRead: string };
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
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [history, setHistory] = useState<History>({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>("pdf");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [titleInput, setTitleInput] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMangas();
    const h = localStorage.getItem("manga-history");
    if (h) setHistory(JSON.parse(h));
  }, []);

  async function fetchMangas() {
    const res = await fetch("/api/manga");
    const data = await res.json();
    setMangas(data);
  }

  async function handleUpload() {
    if (uploadMode === "pdf" && !selectedFile) return;
    if (uploadMode === "images" && !selectedFile && selectedImages.length === 0) return;
    setUploading(true);
    setUploadProgress(uploadMode === "pdf" ? "Enviando PDF..." : "Enviando imagens...");
    const formData = new FormData();
    formData.append("title", titleInput || selectedFile?.name.replace(/\.(pdf|zip)$/i, "") || "Sem titulo");

    if (uploadMode === "pdf" && selectedFile) {
      formData.append("pdf", selectedFile);
    } else if (selectedFile) {
      formData.append("archive", selectedFile);
    } else {
      selectedImages.forEach((file) => formData.append("images", file));
    }
    try {
      setUploadProgress("Convertendo páginas (pode demorar um pouco)...");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        setUploadProgress("Concluído!");
        await fetchMangas();
        setShowUploadModal(false);
        setSelectedFile(null);
        setSelectedImages([]);
        setTitleInput("");
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
        setTitleInput((entries.find((entry) => entry.isDirectory)?.name || "Capitulo"));
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

  const filtered = mangas.filter((m) =>
    m.title.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header className="home-header" style={{
        borderBottom: "1px solid var(--border)", padding: "0 2rem",
        height: "64px", display: "flex", alignItems: "center",
        justifyContent: "space-between", position: "sticky", top: 0,
        background: "rgba(13,13,15,0.95)", backdropFilter: "blur(10px)", zIndex: 100,
      }}>
        <div className="home-brand" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            width: 36, height: 36, background: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.2rem", color: "#fff",
            clipPath: "polygon(0 0, 85% 0, 100% 15%, 100% 100%, 15% 100%, 0 85%)",
          }}>M</div>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.5rem", letterSpacing: "0.1em" }}>
            MANGA<span style={{ color: "var(--accent)" }}>SHELF</span>
          </span>
        </div>
        <div className="home-actions" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <input className="search-input" type="text" placeholder="Buscar mangá..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: "var(--bg3)", border: "1px solid var(--border)",
              color: "var(--text)", padding: "0.5rem 1rem", borderRadius: "2px",
              fontFamily: "'Space Mono', monospace", fontSize: "0.8rem", width: "220px", outline: "none",
            }}
          />
          <button className="upload-button" onClick={() => setShowUploadModal(true)} style={{
            background: "var(--accent)", color: "#fff", border: "none",
            padding: "0.5rem 1.25rem", fontFamily: "'Bebas Neue', sans-serif",
            fontSize: "1rem", letterSpacing: "0.08em", cursor: "pointer",
            clipPath: "polygon(0 0, 90% 0, 100% 20%, 100% 100%, 10% 100%, 0 80%)",
          }}>+ UPLOAD</button>
        </div>
      </header>

      <main className="home-main" style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
        <div className="stats-strip" style={{
          display: "flex", gap: "2rem", marginBottom: "2rem",
          padding: "1rem 1.5rem", background: "var(--bg2)",
          borderLeft: "3px solid var(--accent)", borderRadius: "0 2px 2px 0",
        }}>
          {[
            { val: mangas.length, label: "Mangás" },
            { val: mangas.reduce((a, m) => a + m.pages, 0), label: "Páginas totais" },
            { val: Object.keys(history).length, label: "Em leitura" },
          ].map((s, i) => (
            <div className="stat-item" key={i} style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
              {i > 0 && <div className="stat-separator" style={{ width: 1, height: 40, background: "var(--border)" }} />}
              <div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.8rem", color: i === 0 ? "var(--accent)" : "var(--text)", lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "'Space Mono', monospace", textTransform: "uppercase" }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "6rem 2rem", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>📚</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.5rem", marginBottom: "0.5rem" }}>
              {search ? "Nenhum resultado" : "Biblioteca vazia"}
            </div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.8rem" }}>
              {search ? "Tente outra busca" : "Faça upload de um PDF para começar"}
            </div>
          </div>
        ) : (
          <div className="manga-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1.5rem" }}>
            {filtered.map((manga) => {
              const h = history[manga.id];
              const progress = h ? Math.round((h.page / manga.pages) * 100) : 0;
              return (
                <div key={manga.id} style={{ position: "relative" }} className="manga-card-wrapper">
                  <Link href={"/read/" + manga.id} style={{ textDecoration: "none" }}>
                    <div className="manga-card" style={{
                      background: "var(--card-bg)", border: "1px solid var(--border)",
                      overflow: "hidden", transition: "transform 0.15s, border-color 0.15s", cursor: "pointer",
                    }}>
                      <div style={{ aspectRatio: "2/3", background: "var(--bg3)", overflow: "hidden", position: "relative" }}>
                        <img src={manga.coverPage} alt={manga.title}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        {h && (
                          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "3px", background: "var(--border)" }}>
                            <div style={{ height: "100%", background: "var(--accent)", width: progress + "%" }} />
                          </div>
                        )}
                        {progress === 100 && (
                          <div style={{
                            position: "absolute", top: "8px", right: "8px",
                            background: "var(--accent)", color: "#fff",
                            fontFamily: "'Bebas Neue', sans-serif", fontSize: "0.65rem", padding: "2px 6px",
                          }}>LIDO</div>
                        )}
                      </div>
                      <div style={{ padding: "0.75rem" }}>
                        <div style={{
                          fontWeight: 700, fontSize: "0.85rem", color: "var(--text)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "0.25rem",
                        }}>{manga.title}</div>
                        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.65rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                          <span>{manga.pages}p</span>
                          <span>{h ? "p." + h.page : formatDate(manga.uploadedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                  <button onClick={(e) => { e.preventDefault(); setDeleteConfirm(manga.id); }} className="delete-btn"
                    style={{
                      position: "absolute", top: "8px", left: "8px",
                      background: "rgba(13,13,15,0.85)", border: "1px solid var(--border)",
                      color: "var(--text-muted)", width: "28px", height: "28px",
                      cursor: "pointer", fontSize: "0.75rem",
                    }}>✕</button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showUploadModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !uploading) setShowUploadModal(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)" }}>
          <div className="modal-panel" style={{ background: "var(--bg2)", border: "1px solid var(--border)", padding: "2rem", width: "100%", maxWidth: "480px", borderTop: "3px solid var(--accent)" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.5rem", letterSpacing: "0.1em", marginBottom: "1.5rem" }}>ADICIONAR MANGÁ</div>
            <div className="upload-tabs" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
              <button type="button" onClick={() => resetUploadSelection("pdf")} disabled={uploading}
                style={{
                  flex: 1, background: uploadMode === "pdf" ? "var(--accent)" : "var(--bg3)",
                  border: "1px solid " + (uploadMode === "pdf" ? "var(--accent)" : "var(--border)"),
                  color: "#fff", padding: "0.6rem", fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: "1rem", cursor: uploading ? "not-allowed" : "pointer", letterSpacing: "0.08em",
                }}>PDF</button>
              <button type="button" onClick={() => resetUploadSelection("images")} disabled={uploading}
                style={{
                  flex: 1, background: uploadMode === "images" ? "var(--accent)" : "var(--bg3)",
                  border: "1px solid " + (uploadMode === "images" ? "var(--accent)" : "var(--border)"),
                  color: "#fff", padding: "0.6rem", fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: "1rem", cursor: uploading ? "not-allowed" : "pointer", letterSpacing: "0.08em",
                }}>PASTA / ZIP</button>
            </div>
            <div onDrop={(e) => { void handleDrop(e); }} onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)} onClick={() => fileInputRef.current?.click()}
              style={{
                border: "2px dashed " + (dragOver ? "var(--accent)" : selectedFile || selectedImages.length > 0 ? "var(--accent2)" : "var(--border)"),
                padding: "2rem", textAlign: "center", cursor: "pointer", marginBottom: "1rem",
                background: dragOver ? "rgba(232,64,42,0.05)" : "var(--bg3)", transition: "all 0.2s",
              }}>
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
                  <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📄</div>
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.8rem", color: "var(--accent2)" }}>{selectedFile.name}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</div>
                </div>
              ) : selectedImages.length > 0 ? (
                <div>
                  <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📁</div>
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.8rem", color: "var(--accent2)" }}>{selectedImages.length} imagens selecionadas</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>Ordenadas pelo nome automaticamente</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>☁️</div>
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {uploadMode === "pdf" ? "Arraste um PDF aqui ou clique para selecionar" : "Arraste um ZIP ou uma pasta aqui"}
                  </div>
                </div>
              )}
            </div>
            {uploadMode === "images" && (
              <button type="button" onClick={() => folderInputRef.current?.click()} disabled={uploading}
                style={{
                  width: "100%", background: "var(--bg3)", border: "1px solid var(--border)",
                  color: "var(--text)", padding: "0.65rem", marginBottom: "1rem",
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: "1rem",
                  cursor: uploading ? "not-allowed" : "pointer", letterSpacing: "0.08em",
                }}>ABRIR SELETOR DE PASTA</button>
            )}
            <input type="text" placeholder="Título do mangá" value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              style={{
                width: "100%", background: "var(--bg3)", border: "1px solid var(--border)",
                color: "var(--text)", padding: "0.75rem 1rem", marginBottom: "1rem",
                fontFamily: "'Noto Sans JP', sans-serif", fontSize: "0.9rem", outline: "none",
              }} />
            {uploading && (
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.75rem", color: "var(--accent2)", marginBottom: "1rem", padding: "0.75rem", background: "rgba(232,64,42,0.08)", border: "1px solid rgba(232,64,42,0.2)" }}>
                ⟳ {uploadProgress}
              </div>
            )}
            <div className="modal-actions" style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={() => { setShowUploadModal(false); setSelectedFile(null); setSelectedImages([]); setTitleInput(""); }} disabled={uploading}
                style={{ flex: 1, background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text-muted)", padding: "0.75rem", fontFamily: "'Bebas Neue', sans-serif", fontSize: "1rem", cursor: "pointer" }}>CANCELAR</button>
              <button onClick={handleUpload} disabled={uploading || (uploadMode === "pdf" ? !selectedFile : !selectedFile && selectedImages.length === 0)}
                style={{ flex: 2, background: !uploading && (selectedFile || selectedImages.length > 0) ? "var(--accent)" : "var(--bg3)", border: "none", color: "#fff", padding: "0.75rem", fontFamily: "'Bebas Neue', sans-serif", fontSize: "1rem", cursor: !uploading && (selectedFile || selectedImages.length > 0) ? "pointer" : "not-allowed", opacity: !uploading && (selectedFile || selectedImages.length > 0) ? 1 : 0.5 }}>
                {uploading ? "PROCESSANDO..." : "FAZER UPLOAD"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
          <div className="modal-panel" style={{ background: "var(--bg2)", border: "1px solid var(--border)", padding: "2rem", width: "100%", maxWidth: "360px", borderTop: "3px solid #e84040" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.3rem", marginBottom: "0.75rem" }}>REMOVER MANGÁ?</div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>Isso irá deletar o PDF e todas as páginas permanentemente.</div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text)", padding: "0.6rem", fontFamily: "'Bebas Neue', sans-serif", fontSize: "1rem", cursor: "pointer" }}>NÃO</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ flex: 1, background: "#e84040", border: "none", color: "#fff", padding: "0.6rem", fontFamily: "'Bebas Neue', sans-serif", fontSize: "1rem", cursor: "pointer" }}>DELETAR</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .manga-card:hover { transform: translateY(-4px); border-color: var(--accent) !important; }
        .delete-btn { opacity: 0; transition: opacity 0.2s; }
        .manga-card-wrapper:hover .delete-btn { opacity: 1; }
      `}</style>
    </div>
  );
}
