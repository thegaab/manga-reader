import fs from "fs";
import path from "path";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import type { Manga } from "./store";

const LOCAL_MANGAS_DIR = path.join(process.cwd(), "public", "mangas");
const LOCAL_DATA_FILE = path.join(LOCAL_MANGAS_DIR, "data.json");
const LOCAL_PRIVATE_DIR = path.join(process.cwd(), ".data");
const DATA_KEY = "mangas/data.json";

export type StorageDriver = "local" | "s3";

export function getStorageDriver(): StorageDriver {
  return process.env.STORAGE_DRIVER === "s3" ? "s3" : "local";
}

function getS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1",
  });
}

function getBucketName(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET is required when STORAGE_DRIVER=s3.");
  return bucket;
}

function normalizeS3Prefix(prefix = ""): string {
  return prefix.replace(/^\/+|\/+$/g, "");
}

function getS3Key(key: string): string {
  const prefix = normalizeS3Prefix(process.env.S3_PREFIX || "");
  const cleanKey = key.replace(/^\/+/g, "");
  return prefix ? `${prefix}/${cleanKey}` : cleanKey;
}

function getPublicBaseUrl(): string {
  if (process.env.S3_PUBLIC_BASE_URL) {
    return process.env.S3_PUBLIC_BASE_URL.replace(/\/+$/g, "");
  }

  const bucket = getBucketName();
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
  return region === "us-east-1"
    ? `https://${bucket}.s3.amazonaws.com`
    : `https://${bucket}.s3.${region}.amazonaws.com`;
}

async function streamToString(stream: unknown): Promise<string> {
  const readable = stream as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function naturalPageSort(a: string, b: string): number {
  const numA = Number(a.match(/page-(\d+)\.png$/)?.[1] || 0);
  const numB = Number(b.match(/page-(\d+)\.png$/)?.[1] || 0);
  return numA - numB;
}

export function publicUrlForKey(key: string): string {
  if (getStorageDriver() === "local") {
    return `/mangas/${key.replace(/^mangas\//, "")}`;
  }

  if (process.env.S3_PUBLIC_BASE_URL) {
    return `${getPublicBaseUrl()}/${getS3Key(key).split("/").map(encodeURIComponent).join("/")}`;
  }

  return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function readMangaCatalog(): Promise<Manga[]> {
  if (getStorageDriver() === "local") {
    if (!fs.existsSync(LOCAL_MANGAS_DIR)) fs.mkdirSync(LOCAL_MANGAS_DIR, { recursive: true });
    if (!fs.existsSync(LOCAL_DATA_FILE)) return [];
    try {
      return JSON.parse(fs.readFileSync(LOCAL_DATA_FILE, "utf-8"));
    } catch {
      return [];
    }
  }

  try {
    const res = await getS3Client().send(
      new GetObjectCommand({
        Bucket: getBucketName(),
        Key: getS3Key(DATA_KEY),
      })
    );
    return JSON.parse(await streamToString(res.Body));
  } catch (err) {
    const error = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) return [];
    throw err;
  }
}

export async function writeMangaCatalog(mangas: Manga[]): Promise<void> {
  const body = JSON.stringify(mangas, null, 2);

  if (getStorageDriver() === "local") {
    if (!fs.existsSync(LOCAL_MANGAS_DIR)) fs.mkdirSync(LOCAL_MANGAS_DIR, { recursive: true });
    fs.writeFileSync(LOCAL_DATA_FILE, body);
    return;
  }

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: getS3Key(DATA_KEY),
      Body: body,
      ContentType: "application/json; charset=utf-8",
    })
  );
}

export async function readPrivateJson<T>(key: string, fallback: T): Promise<T> {
  if (getStorageDriver() === "local") {
    const localPath = path.join(LOCAL_PRIVATE_DIR, key);
    if (!fs.existsSync(localPath)) return fallback;
    try {
      return JSON.parse(fs.readFileSync(localPath, "utf-8"));
    } catch {
      return fallback;
    }
  }

  try {
    const res = await getS3Client().send(
      new GetObjectCommand({
        Bucket: getBucketName(),
        Key: getS3Key(key),
      })
    );
    return JSON.parse(await streamToString(res.Body));
  } catch (err) {
    const error = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) return fallback;
    throw err;
  }
}

export async function writePrivateJson<T>(key: string, value: T): Promise<void> {
  const body = JSON.stringify(value, null, 2);

  if (getStorageDriver() === "local") {
    const localPath = path.join(LOCAL_PRIVATE_DIR, key);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, body);
    return;
  }

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: getS3Key(key),
      Body: body,
      ContentType: "application/json; charset=utf-8",
    })
  );
}

export async function uploadObject(key: string, body: Buffer, contentType: string): Promise<void> {
  if (getStorageDriver() === "local") {
    const outputPath = path.join(LOCAL_MANGAS_DIR, key.replace(/^mangas\//, ""));
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, body);
    return;
  }

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: getS3Key(key),
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function getObject(key: string): Promise<{ body: unknown; contentType?: string }> {
  if (getStorageDriver() === "local") {
    const localPath = path.join(LOCAL_MANGAS_DIR, key.replace(/^mangas\//, ""));
    if (!fs.existsSync(localPath)) throw new Error(`Local object not found: ${key}`);
    return {
      body: fs.createReadStream(localPath),
      contentType: key.endsWith(".png") ? "image/png" : "application/octet-stream",
    };
  }

  const res = await getS3Client().send(
    new GetObjectCommand({
      Bucket: getBucketName(),
      Key: getS3Key(key),
    })
  );

  return { body: res.Body, contentType: res.ContentType || undefined };
}

export async function uploadPagesFromDirectory(mangaId: string, pagesDir: string): Promise<string[]> {
  const files = fs
    .readdirSync(pagesDir)
    .filter((file) => /^page-\d+\.png$/.test(file))
    .sort(naturalPageSort);

  for (const file of files) {
    await uploadObject(
      `mangas/${mangaId}/pages/${file}`,
      fs.readFileSync(path.join(pagesDir, file)),
      "image/png"
    );
  }

  return files.map((file) => `mangas/${mangaId}/pages/${file}`);
}

export async function listPageKeys(mangaId: string): Promise<string[]> {
  if (getStorageDriver() === "local") {
    const pagesDir = path.join(LOCAL_MANGAS_DIR, mangaId, "pages");
    if (!fs.existsSync(pagesDir)) return [];
    return fs
      .readdirSync(pagesDir)
      .filter((file) => /^page-\d+\.png$/.test(file))
      .sort(naturalPageSort)
      .map((file) => `mangas/${mangaId}/pages/${file}`);
  }

  const client = getS3Client();
  const prefix = getS3Key(`mangas/${mangaId}/pages/`);
  const keys: string[] = [];
  let token: string | undefined;

  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: getBucketName(),
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    keys.push(
      ...(res.Contents || [])
        .map((item) => item.Key)
        .filter((key): key is string => Boolean(key))
    );
    token = res.NextContinuationToken;
  } while (token);

  const configuredPrefix = normalizeS3Prefix(process.env.S3_PREFIX || "");
  return keys
    .map((key) => configuredPrefix && key.startsWith(`${configuredPrefix}/`)
      ? key.slice(configuredPrefix.length + 1)
      : key)
    .filter((key) => /^mangas\/[^/]+\/pages\/page-\d+\.png$/.test(key))
    .sort(naturalPageSort);
}

export async function deleteMangaObjects(mangaId: string): Promise<void> {
  if (getStorageDriver() === "local") {
    const mangaDir = path.join(LOCAL_MANGAS_DIR, mangaId);
    if (fs.existsSync(mangaDir)) fs.rmSync(mangaDir, { recursive: true, force: true });
    return;
  }

  const client = getS3Client();
  const prefix = getS3Key(`mangas/${mangaId}/`);
  let token: string | undefined;

  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: getBucketName(),
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    const objects = (res.Contents || [])
      .map((item) => item.Key)
      .filter((key): key is string => Boolean(key))
      .map((Key) => ({ Key }));

    if (objects.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: getBucketName(),
          Delete: { Objects: objects },
        })
      );
    }

    token = res.NextContinuationToken;
  } while (token);
}
