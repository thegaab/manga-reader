import fs from "fs";
import path from "path";
import zlib from "zlib";
import sharp from "sharp";

interface ImageEntry {
  name: string;
  data: Buffer;
}

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function isImageFile(name: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase());
}

function compareNatural(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function readUInt64AsNumber(buffer: Buffer, offset: number): number {
  const low = buffer.readUInt32LE(offset);
  const high = buffer.readUInt32LE(offset + 4);
  return high * 0x100000000 + low;
}

function findEndOfCentralDirectory(zip: Buffer): number {
  const minOffset = Math.max(0, zip.length - 0xffff - 22);
  for (let i = zip.length - 22; i >= minOffset; i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error("ZIP invalido: diretorio central nao encontrado.");
}

function decodeFileName(buffer: Buffer, isUtf8: boolean): string {
  return buffer.toString(isUtf8 ? "utf8" : "latin1").replace(/\\/g, "/");
}

function parseZipImages(zip: Buffer): ImageEntry[] {
  const eocdOffset = findEndOfCentralDirectory(zip);
  let entryCount = zip.readUInt16LE(eocdOffset + 10);
  let centralDirOffset = zip.readUInt32LE(eocdOffset + 16);

  if (entryCount === 0xffff || centralDirOffset === 0xffffffff) {
    const locatorOffset = eocdOffset - 20;
    if (locatorOffset < 0 || zip.readUInt32LE(locatorOffset) !== 0x07064b50) {
      throw new Error("ZIP64 nao suportado.");
    }
    const zip64EocdOffset = readUInt64AsNumber(zip, locatorOffset + 8);
    entryCount = Number(readUInt64AsNumber(zip, zip64EocdOffset + 32));
    centralDirOffset = Number(readUInt64AsNumber(zip, zip64EocdOffset + 48));
  }

  const images: ImageEntry[] = [];
  let offset = centralDirOffset;

  for (let i = 0; i < entryCount; i++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("ZIP invalido: entrada do diretorio central corrompida.");
    }

    const flags = zip.readUInt16LE(offset + 8);
    const compression = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const fileNameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localHeaderOffset = zip.readUInt32LE(offset + 42);
    const nameStart = offset + 46;
    const name = decodeFileName(zip.subarray(nameStart, nameStart + fileNameLength), Boolean(flags & 0x0800));

    offset = nameStart + fileNameLength + extraLength + commentLength;

    if (name.endsWith("/") || name.startsWith("__MACOSX/") || !isImageFile(name)) {
      continue;
    }

    if (zip.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(`ZIP invalido: cabecalho local nao encontrado para ${name}.`);
    }

    const localNameLength = zip.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = zip.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressedData = zip.subarray(dataStart, dataStart + compressedSize);

    let data: Buffer;
    if (compression === 0) {
      data = Buffer.from(compressedData);
    } else if (compression === 8) {
      data = zlib.inflateRawSync(compressedData);
    } else {
      throw new Error(`ZIP usa compressao nao suportada em ${name}.`);
    }

    images.push({ name, data });
  }

  return images.sort((a, b) => compareNatural(path.posix.basename(a.name), path.posix.basename(b.name)));
}

async function writeImages(images: ImageEntry[], outputDir: string): Promise<number> {
  fs.mkdirSync(outputDir, { recursive: true });

  for (const [index, image] of images.entries()) {
    const outputPath = path.join(outputDir, `page-${index + 1}.png`);
    await sharp(image.data, { failOn: "none" }).png().toFile(outputPath);
  }

  return images.length;
}

export async function zipToImages(zipBuffer: Buffer, outputDir: string): Promise<number> {
  const images = parseZipImages(zipBuffer);
  if (images.length === 0) return 0;
  return writeImages(images, outputDir);
}

export async function uploadedImagesToPages(files: File[], outputDir: string): Promise<number> {
  const images = await Promise.all(
    files
      .filter((file) => isImageFile(file.name))
      .map(async (file) => ({
        name: file.name,
        data: Buffer.from(await file.arrayBuffer()),
      }))
  );

  images.sort((a, b) => compareNatural(path.posix.basename(a.name), path.posix.basename(b.name)));
  if (images.length === 0) return 0;
  return writeImages(images, outputDir);
}
