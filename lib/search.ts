import { searchThreads, type Thread } from "./supabase";

export type ThreadResult = Thread & { excerpt: string };

const stopwords = new Set([
  "и", "в", "на", "по", "что", "как", "когда", "ли", "а", "или", "не",
  "для", "про", "это", "то", "у", "из", "с", "со", "за", "от", "до",
]);

function terms(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-zа-я0-9\s-]/gi, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !stopwords.has(t));
}

function excerpt(text: string, query: string, len = 700): string {
  const lower = text.toLowerCase();
  const hit = terms(query).find((t) => lower.includes(t));
  if (!hit) return text.length > len ? `${text.slice(0, len)}…` : text;
  const idx = lower.indexOf(hit);
  const start = Math.max(0, idx - 100);
  const end = Math.min(text.length, idx + len - 100);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

export async function search(
  query: string,
  limit = 20,
  sourceChannel: string | null = null
): Promise<ThreadResult[]> {
  const threads = await searchThreads(query, limit, sourceChannel);
  return threads.map((t) => ({ ...t, excerpt: excerpt(t.text, query) }));
}
