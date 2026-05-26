"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface Manga {
  id: string;
  title: string;
  pages: number;
}

type ReadMode = "single" | "double" | "scroll";

export default function ReaderPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [manga, setManga] = useState<Manga | null>(null);
  const [pageUrls, setPageUrls] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [readMode, setReadMode] = useState<ReadMode>("single");
  const [showUI, setShowUI] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const uiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function load() {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.replace("/login");
        return;
      }

      const [mangaRes, pagesRes, progressRes] = await Promise.all([
        fetch("/api/manga/" + id),
        fetch("/api/manga/" + id + "/pages"),
        fetch("/api/progress/" + id),
      ]);
      const mangaData = await mangaRes.json();
      const pagesData = await pagesRes.json();
      setManga(mangaData);
      setPageUrls(pagesData.pages || []);

      if (progressRes.ok) {
        const progressData = await progressRes.json();
        if (progressData.progress) {
          setCurrentPage(Math.min(progressData.progress.page - 1, (pagesData.pages?.length || 1) - 1));
        }
      }
      setLoading(false);
    }
    load();
  }, [id, router]);

  // Save history
  useEffect(() => {
    if (!manga || pageUrls.length === 0) return;
    void fetch("/api/progress/" + id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: currentPage + 1 }),
    });
  }, [currentPage, manga, id, pageUrls.length]);

  const goNext = useCallback(() => {
    const step = readMode === "double" ? 2 : 1;
    setCurrentPage((p) => Math.min(p + step, pageUrls.length - 1));
  }, [readMode, pageUrls.length]);

  const goPrev = useCallback(() => {
    const step = readMode === "double" ? 2 : 1;
    setCurrentPage((p) => Math.max(p - step, 0));
  }, [readMode]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goNext();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goPrev();
      if (e.key === "Escape") window.history.back();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev]);

  function resetUITimer() {
    setShowUI(true);
    if (uiTimerRef.current) clearTimeout(uiTimerRef.current);
    uiTimerRef.current = setTimeout(() => setShowUI(false), 3000);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.5rem", color: "var(--text-muted)", letterSpacing: "0.2em" }}>
          CARREGANDO...
        </div>
      </div>
    );
  }

  if (!manga || pageUrls.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.5rem" }}>Mangá não encontrado</div>
        <Link href="/" style={{ color: "var(--accent)", fontFamily: "'Space Mono', monospace", fontSize: "0.8rem" }}>← Voltar</Link>
      </div>
    );
  }

  const totalPages = pageUrls.length;
  const progress = ((currentPage + 1) / totalPages) * 100;

  return (
    <div className="reader-root" style={{ minHeight: "100vh", background: "#000", position: "relative", cursor: "none" }}
      onMouseMove={resetUITimer} onClick={resetUITimer}>

      {/* Top Bar */}
      <div className="reader-topbar" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, transparent 100%)",
        padding: "0 1.5rem", height: "60px", display: "flex",
        alignItems: "center", justifyContent: "space-between",
        transition: "opacity 0.3s", opacity: showUI ? 1 : 0, pointerEvents: showUI ? "auto" : "none",
      }}>
        <div className="reader-title-area" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link href="/" style={{
            color: "var(--text-muted)", textDecoration: "none",
            fontFamily: "'Space Mono', monospace", fontSize: "0.8rem",
            display: "flex", alignItems: "center", gap: "0.5rem",
          }}>← BIBLIOTECA</Link>
          <div style={{ width: 1, height: 16, background: "var(--border)" }} />
          <span className="reader-title" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.1rem", letterSpacing: "0.08em" }}>
            {manga.title}
          </span>
        </div>

        <div className="reader-modes" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {(["single", "double", "scroll"] as ReadMode[]).map((mode) => (
            <button key={mode} onClick={() => setReadMode(mode)}
              style={{
                background: readMode === mode ? "var(--accent)" : "rgba(255,255,255,0.08)",
                border: "none", color: "#fff", padding: "0.35rem 0.7rem",
                fontFamily: "'Space Mono', monospace", fontSize: "0.65rem",
                cursor: "pointer", textTransform: "uppercase",
                opacity: readMode === mode ? 1 : 0.6,
              }}>
              {mode === "single" ? "1P" : mode === "double" ? "2P" : "↕"}
            </button>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "2px",
        background: "rgba(255,255,255,0.1)", zIndex: 101,
      }}>
        <div style={{ height: "100%", background: "var(--accent)", width: progress + "%", transition: "width 0.3s" }} />
      </div>

      {/* Reader Area */}
      {readMode === "scroll" ? (
        <div className="reader-scroll" style={{ paddingTop: "60px", maxWidth: "800px", margin: "0 auto" }}>
          {pageUrls.map((url, i) => (
            <img key={i} src={url} alt={"Página " + (i + 1)}
              style={{ width: "100%", display: "block" }} />
          ))}
        </div>
      ) : (
        <div className="reader-stage" style={{
          height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
          gap: readMode === "double" ? "2px" : 0,
        }}>
          {/* Left click zone */}
          <div onClick={goPrev} style={{
            position: "absolute", left: 0, top: 0, width: "30%", height: "100%",
            cursor: "w-resize", zIndex: 50,
          }} />
          {/* Right click zone */}
          <div onClick={goNext} style={{
            position: "absolute", right: 0, top: 0, width: "30%", height: "100%",
            cursor: "e-resize", zIndex: 50,
          }} />

          <img className="reader-page-img" src={pageUrls[currentPage]} alt={"Página " + (currentPage + 1)}
            style={{
              maxHeight: "100vh", maxWidth: readMode === "double" ? "50vw" : "100vw",
              objectFit: "contain", userSelect: "none",
            }} />
          {readMode === "double" && pageUrls[currentPage + 1] && (
            <img className="reader-page-img reader-page-img-double" src={pageUrls[currentPage + 1]} alt={"Página " + (currentPage + 2)}
              style={{ maxHeight: "100vh", maxWidth: "50vw", objectFit: "contain", userSelect: "none" }} />
          )}
        </div>
      )}

      {/* Bottom Bar */}
      <div className="reader-bottombar" style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)",
        padding: "1rem 1.5rem 1.5rem", display: "flex",
        alignItems: "center", justifyContent: "space-between",
        transition: "opacity 0.3s", opacity: showUI ? 1 : 0, pointerEvents: showUI ? "auto" : "none",
      }}>
        <button className="reader-nav-btn" onClick={goPrev} disabled={currentPage === 0}
          style={{
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)",
            color: "#fff", padding: "0.5rem 1.25rem", fontFamily: "'Bebas Neue', sans-serif",
            fontSize: "1rem", cursor: currentPage === 0 ? "not-allowed" : "pointer",
            opacity: currentPage === 0 ? 0.3 : 1, letterSpacing: "0.08em",
          }}>← ANTERIOR</button>

        <div className="reader-controls" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.75rem", color: "rgba(255,255,255,0.6)" }}>
            {currentPage + 1} {readMode === "double" && pageUrls[currentPage + 1] ? "— " + (currentPage + 2) : ""} / {totalPages}
          </div>
          <input className="reader-slider" type="range" min={0} max={totalPages - 1} value={currentPage}
            onChange={(e) => setCurrentPage(Number(e.target.value))}
            style={{ width: "200px", accentColor: "var(--accent)", cursor: "pointer" }} />
        </div>

        <button className="reader-nav-btn" onClick={goNext} disabled={currentPage >= totalPages - 1}
          style={{
            background: currentPage >= totalPages - 1 ? "rgba(255,255,255,0.1)" : "var(--accent)",
            border: "none", color: "#fff", padding: "0.5rem 1.25rem",
            fontFamily: "'Bebas Neue', sans-serif", fontSize: "1rem",
            cursor: currentPage >= totalPages - 1 ? "not-allowed" : "pointer",
            opacity: currentPage >= totalPages - 1 ? 0.3 : 1, letterSpacing: "0.08em",
          }}>PRÓXIMA →</button>
      </div>
    </div>
  );
}
