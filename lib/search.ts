import { knowledgeBase, type KnowledgeItem } from "./knowledge";

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
  "как",
]);

export type SearchResult = KnowledgeItem & {
  score: number;
  excerpt: string;
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
  if (!hit) return text.length > 180 ? `${text.slice(0, 180)}...` : text;
  const index = lower.indexOf(hit.toLowerCase());
  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + 140);
  const slice = text.slice(start, end);
  return `${start > 0 ? "..." : ""}${slice}${end < text.length ? "..." : ""}`;
}

export function searchKnowledge(query: string, limit = 5): SearchResult[] {
  const terms = tokenize(query);
  const scored = knowledgeBase
    .map((item) => {
      const haystack = `${item.title} ${item.topic} ${item.tags.join(" ")} ${item.answer}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (!term) continue;
        if (item.title.toLowerCase().includes(term)) score += 6;
        if (item.topic.toLowerCase().includes(term)) score += 4;
        if (item.tags.some((tag) => tag.toLowerCase().includes(term))) score += 5;
        if (haystack.includes(term)) score += 2;
      }
      if (score === 0) {
        for (const term of terms) {
          if (term.length >= 4 && haystack.includes(term)) score += 0.5;
        }
      }
      return {
        ...item,
        score,
        excerpt: excerpt(item.answer, terms),
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  return scored.slice(0, Math.max(1, Math.min(limit, 10)));
}
