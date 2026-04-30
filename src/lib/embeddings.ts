import { VECTOR_DIM } from "@/lib/sqlite-vec";

const DEFAULT_EMBED_MODEL = "nomic-embed-text-v1.5";

function resolveEmbedUrl(): string | null {
  const explicit = process.env.LOCAL_LLM_EMBED_URL;
  if (explicit) return explicit;
  const chat = process.env.LOCAL_LLM_URL;
  if (!chat) return null;
  return chat.replace(/\/(chat\/)?completions\/?$/i, "/embeddings");
}

export async function embed(text: string): Promise<Float32Array> {
  const url = resolveEmbedUrl();
  const key = process.env.LOCAL_LLM_CLIENT_KEY;
  const model = process.env.LOCAL_LLM_EMBED_MODEL || DEFAULT_EMBED_MODEL;
  if (!url || !key) throw new Error("LLM embedding configuration missing");

  const trimmed = text.length > 8000 ? text.slice(0, 8000) : text;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model, input: trimmed }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Embedding API error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const vec = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec)) throw new Error("Embedding response malformed");

  const out = Float32Array.from(vec);
  if (out.length !== VECTOR_DIM) {
    if (out.length < VECTOR_DIM) {
      const padded = new Float32Array(VECTOR_DIM);
      padded.set(out);
      return padded;
    }
    return out.slice(0, VECTOR_DIM);
  }
  return out;
}

export async function embedSafe(text: string): Promise<Float32Array | null> {
  try {
    return await embed(text);
  } catch (e) {
    console.warn("[embeddings] embed failed:", (e as Error).message);
    return null;
  }
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function distanceToSimilarity(distance: number): number {
  return Math.max(0, 1 - distance / 2);
}
