import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const [, , userId, role] = process.argv;
const validRoles = new Set(["admin", "reader"]);

if (!userId || !validRoles.has(role)) {
  console.error("Uso: node scripts/set-user-role.mjs <userId> <admin|reader>");
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

async function readAuthStore() {
  if (process.env.STORAGE_DRIVER === "s3") {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error("S3_BUCKET e obrigatorio quando STORAGE_DRIVER=s3.");

    const client = new S3Client({
      region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1",
    });
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: getS3Key("auth/data.json") }));
    return {
      store: JSON.parse(await streamToString(res.Body)),
      write: async (nextStore) => {
        await client.send(new PutObjectCommand({
          Bucket: bucket,
          Key: getS3Key("auth/data.json"),
          Body: JSON.stringify(nextStore, null, 2),
          ContentType: "application/json; charset=utf-8",
        }));
      },
    };
  }

  const filePath = path.join(rootDir, ".data", "auth", "data.json");
  if (!fs.existsSync(filePath)) throw new Error(`Arquivo de usuarios nao encontrado: ${filePath}`);
  return {
    store: JSON.parse(fs.readFileSync(filePath, "utf-8")),
    write: async (nextStore) => {
      fs.writeFileSync(filePath, JSON.stringify(nextStore, null, 2));
    },
  };
}

const { store, write } = await readAuthStore();
const user = store.users?.find((candidate) => candidate.id === userId);

if (!user) {
  console.error(`Usuario nao encontrado: ${userId}`);
  process.exit(1);
}

user.role = role;
await write(store);

console.log(`Role atualizada: ${user.email} (${user.id}) -> ${role}`);
