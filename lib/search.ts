import { knowledgeBase, type KnowledgeItem } from "./knowledge";
import { hasSupabaseConfig, searchSupabaseKnowledge } from "./supabase";

const stopwords = new Set([
  "и",
  "в",
  "на",
  "по",
  "что",
  "как",
  "когда",
  "ли",
  "а",
  "или",
  "не",
  "для",
  "про",
  "это",
  "то",
  "у",
  "из",
  "с",
  "со",
  "за",
  "от",
  "до",
]);

export type SearchResult = KnowledgeItem & {
  score: number;
  excerpt: string;
  source_channel?: string | null;
  source_url?: string | null;
  posted_at?: string | null;
  backend: "supabase" | "local";
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zа-я0-9\s-]/gi, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !stopwords.has(t));
}

function excerpt(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  const hit = terms.find((term) => lower.includes(term.toLowerCase()));
  if (!hit) return text.length > 220 ? `${text.slice(0, 220)}...` : text;
  const index = lower.indexOf(hit.toLowerCase());
  const start = Math.max(0, index - 80);
  const end = Math.min(text.length, index + 180);
  const slice = text.slice(start, end);
  return `${start > 0 ? "..." : ""}${slice}${end < text.length ? "..." : ""}`;
}

export function searchLocalKnowledge(query: string, limit = 5): SearchResult[] {
  const terms = tokenize(query);
  const scored = knowledgeBase
    .map((item) => {
      const haystack = `${item.title} ${item.topic} ${item.tags.join(" ")} ${item.answer}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (item.title.toLowerCase().includes(term)) score += 6;
        if (item.topic.toLowerCase().includes(term)) score += 4;
        if (item.tags.some((tag) => tag.toLowerCase().includes(term))) score += 5;
        if (haystack.includes(term)) score += 2;
      }
      return {
        ...item,
        score,
        excerpt: excerpt(item.answer, terms),
        source_channel: null,
        source_url: null,
        posted_at: null,
        backend: "local" as const,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  return scored.slice(0, Math.max(1, Math.min(limit, 10)));
}

export async function searchKnowledge(query: string, limit = 8): Promise<SearchResult[]> {
  if (hasSupabaseConfig()) {
    const rows = await searchSupabaseKnowledge(query, limit);
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      topic: row.topic,
      tags: row.tags ?? [],
      answer: row.content,
      source: row.source_channel ?? row.source,
      score: row.score ?? 0,
      excerpt: excerpt(row.content, tokenize(query)),
      source_channel: row.source_channel,
      source_url: row.source_url,
      posted_at: row.posted_at,
      backend: "supabase" as const,
    }));
  }

  return searchLocalKnowledge(query, limit);
}
