import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

const [, , seriesTitleArg, coverPageArg = ""] = process.argv;
const seriesTitle = (seriesTitleArg || "").trim();

if (!seriesTitle) {
  console.error("Uso: node scripts/move-loose-mangas-to-series.mjs \"Nome da Serie\" [coverPageUrl]");
  process.exit(1);
}

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

for (const envFile of [".env.local", ".env.production", ".env"]) {
  const envPath = path.join(rootDir, envFile);
  if (!fs.existsSync(envPath)) continue;

  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function normalizeS3Prefix(prefix = "") {
  return prefix.replace(/^\/+|\/+$/g, "");
}

function getS3Key(key) {
  const prefix = normalizeS3Prefix(process.env.S3_PREFIX || "");
  return prefix ? `${prefix}/${key}` : key;
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function readJson(client, bucket, key, fallback) {
  if (process.env.STORAGE_DRIVER === "s3") {
    try {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: getS3Key(key) }));
      return JSON.parse(await streamToString(res.Body));
    } catch (err) {
      if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) return fallback;
      throw err;
    }
  }

  const filePath = path.join(rootDir, "public", key);
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

async function writeJson(client, bucket, key, value) {
  const body = JSON.stringify(value, null, 2);
  if (process.env.STORAGE_DRIVER === "s3") {
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: getS3Key(key),
      Body: body,
      ContentType: "application/json; charset=utf-8",
    }));
    return;
  }

  const filePath = path.join(rootDir, "public", key);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body);
}

const bucket = process.env.S3_BUCKET;
const client = process.env.STORAGE_DRIVER === "s3"
  ? new S3Client({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1" })
  : null;

if (process.env.STORAGE_DRIVER === "s3" && !bucket) {
  console.error("S3_BUCKET e obrigatorio quando STORAGE_DRIVER=s3.");
  process.exit(1);
}

const mangas = await readJson(client, bucket, "mangas/data.json", []);
const seriesList = await readJson(client, bucket, "mangas/series.json", []);
const looseMangas = mangas.filter((manga) => !manga.seriesId);

if (looseMangas.length === 0) {
  console.log("Nenhum capitulo sem serie encontrado.");
  process.exit(0);
}

let series = seriesList.find((item) => item.title.toLowerCase() === seriesTitle.toLowerCase());
const now = new Date().toISOString();

if (!series) {
  series = {
    id: randomUUID(),
    title: seriesTitle,
    coverPage: coverPageArg || looseMangas[0]?.coverPage || "",
    createdAt: now,
    updatedAt: now,
  };
  seriesList.push(series);
} else if (!series.coverPage) {
  series.coverPage = coverPageArg || looseMangas[0]?.coverPage || "";
  series.updatedAt = now;
}

for (const manga of looseMangas) {
  manga.seriesId = series.id;
}

await writeJson(client, bucket, "mangas/data.json", mangas);
await writeJson(client, bucket, "mangas/series.json", seriesList);

console.log(`Serie: ${series.title} (${series.id})`);
console.log(`Capitulos movidos: ${looseMangas.length}`);
