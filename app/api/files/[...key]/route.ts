import { NextRequest, NextResponse } from "next/server";
import { getObject } from "@/lib/storage";
import { Readable } from "stream";

function nodeStreamToWebStream(stream: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      stream.on("end", () => controller.close());
      stream.on("error", (error) => controller.error(error));
    },
    cancel() {
      stream.destroy();
    },
  });
}

function toWebBody(body: unknown): BodyInit {
  const maybeWebStream = body as { transformToWebStream?: () => ReadableStream<Uint8Array> };
  if (maybeWebStream?.transformToWebStream) {
    return maybeWebStream.transformToWebStream();
  }

  if (body instanceof Readable) {
    return nodeStreamToWebStream(body);
  }

  return body as BodyInit;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    const { key } = await params;
    const storageKey = key.map(decodeURIComponent).join("/");

    if (!storageKey.startsWith("mangas/")) {
      return NextResponse.json({ error: "Invalid key" }, { status: 400 });
    }

    const object = await getObject(storageKey);
    return new Response(toWebBody(object.body), {
      headers: {
        "Content-Type": object.contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("File proxy error:", err);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
