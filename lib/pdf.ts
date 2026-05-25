import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execFileAsync = promisify(execFile);

function getPdfToPpmPath(): string {
  const executable = process.platform === "win32" ? "pdftoppm.exe" : "pdftoppm";
  const platformDir = process.platform === "win32" ? "win" : "osx";
  const popplerVersion = process.platform === "win32" ? "poppler-0.51" : "poppler-0.66";
  const bundledPath = path.join(
    process.cwd(),
    "node_modules",
    "pdf-poppler",
    "lib",
    platformDir,
    popplerVersion,
    "bin",
    executable
  );

  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  if (process.platform === "win32") {
    throw new Error(`Poppler binary not found at ${bundledPath}`);
  }

  return "pdftoppm";
}

/**
 * Converts a PDF to PNG images using the bundled Poppler binary when available.
 * Returns the number of pages generated.
 */
export async function pdfToImages(
  pdfPath: string,
  outputDir: string,
  prefix = "page"
): Promise<number> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPrefix = path.join(outputDir, prefix);

  await execFileAsync(getPdfToPpmPath(), [
    "-r",
    "150",
    "-png",
    pdfPath,
    outputPrefix,
  ]);

  // Count generated files
  const files = fs
    .readdirSync(outputDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".png"));

  return files.length;
}

/**
 * Returns sorted list of page image filenames in a manga's output dir.
 */
export function getPageFiles(outputDir: string, prefix = "page"): string[] {
  if (!fs.existsSync(outputDir)) return [];
  return fs
    .readdirSync(outputDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".png"))
    .sort((a, b) => {
      // Natural sort by page number
      const numA = parseInt(a.replace(/[^0-9]/g, ""), 10);
      const numB = parseInt(b.replace(/[^0-9]/g, ""), 10);
      return numA - numB;
    });
}
