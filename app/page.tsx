"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ThreadResult = {
  id: string;
  text: string;
  excerpt: string;
  source_channel: string | null;
  start_date: string;
  end_date: string;
  message_count: number;
  participants_count: number;
  reactions_total: number;
  rrf_score: number;
};

type SearchResponse = {
  query: string;
  results: ThreadResult[];
  error?: string;
};

type AnswerResponse = {
  question: string;
  answer: string;
  model: string;
  usedAi: boolean;
  sources: ThreadResult[];
  error?: string;
};

const DAILY_AI_LIMIT = 5;
const AI_STORAGE_KEY = "palisade-search:ai-usage";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function readUsage() {
  if (typeof window === "undefined") return { day: todayKey(), count: 0 };
  try {
    const raw = localStorage.getItem(AI_STORAGE_KEY);
    if (!raw) return { day: todayKey(), count: 0 };
    const parsed = JSON.parse(raw) as { day?: string; count?: number };
    if (parsed.day !== todayKey()) return { day: todayKey(), count: 0 };
    return { day: parsed.day ?? todayKey(), count: Number(parsed.count ?? 0) };
  } catch {
    return { day: todayKey(), count: 0 };
  }
}

function writeUsage(count: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(AI_STORAGE_KEY, JSON.stringify({ day: todayKey(), count }));
}

function fmtDate(iso: string) {
  return iso?.slice(0, 10) ?? "";
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [searchData, setSearchData] = useState<SearchResponse | null>(null);
  const [answerData, setAnswerData] = useState<AnswerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiCount, setAiCount] = useState<number>(() => readUsage().count);
  const canAskAi = aiCount < DAILY_AI_LIMIT;

  const featured = useMemo(
    () => [
      "масло и интервалы",
      "тормозные диски",
      "AWD / HTRAC",
      "дизель 2.2 CRDi",
      "камера и мультимедиа",
    ],
    []
  );

  async function runSearch(q: string) {
    if (q.trim().length < 2) return;
    setSearching(true);
    setError(null);
    setAnswerData(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q.trim(), limit: 25 }),
      });
      const json = (await res.json()) as SearchResponse;
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setSearchData(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  async function summarize(q: string) {
    if (!canAskAi) {
      setError("Лимит AI-суммаризаций на сегодня исчерпан. Попробуй завтра.");
      return;
    }
    if (q.trim().length < 2) return;
    setSummarizing(true);
    setError(null);
    try {
      const res = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q.trim() }),
      });
      const json = (await res.json()) as AnswerResponse;
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setAnswerData(json);
      setSearchData({ query: q.trim(), results: json.sources, error: undefined });
      if (json.usedAi) {
        const nextCount = aiCount + 1;
        setAiCount(nextCount);
        writeUsage(nextCount);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSummarizing(false);
    }
  }

  const busy = searching || summarizing;

  return (
    <main className="mx-auto min-h-screen max-w-6xl overflow-x-hidden px-4 py-6 md:px-6 md:py-10">
      <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-[linear-gradient(135deg,#132036_0%,#1f355d_58%,#2c5cff_100%)] px-5 py-6 text-white shadow-neu md:px-8 md:py-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-blue-100">
              🔎 Поиск по сообществу Palisade
            </div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
              Поиск по обсуждениям владельцев Palisade
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100/90 md:text-base">
              Один вопрос — и находим реальные обсуждения из Telegram-сообщества владельцев
              Hyundai Palisade. Без Telegram, без VPN, без листания тысяч сообщений.
              По желанию AI коротко суммирует найденное.
            </p>
          </div>

          <div className="grid gap-3 rounded-3xl bg-white/10 p-4 backdrop-blur md:min-w-72">
            <div className="text-sm text-blue-100">AI-суммаризаций сегодня</div>
            <div className="text-3xl font-semibold">
              {aiCount}/{DAILY_AI_LIMIT}
            </div>
            <div className="text-xs text-blue-100/80">в этом браузере. Поиск — без лимита</div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 md:grid-cols-[1.35fr_0.9fr]">
        <div className="min-w-0 rounded-[2rem] bg-soft p-5 shadow-neu md:p-7">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Что ищем
            </span>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Например: что владельцы пишут про тормозные диски?"
              rows={4}
              className="w-full resize-none rounded-[1.5rem] bg-bg px-4 py-4 text-[15px] outline-none shadow-inset placeholder:text-muted/70"
            />
          </label>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => runSearch(query)}
              disabled={busy || query.trim().length < 2}
              className="flex-1 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-neuSm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {searching ? "Ищем..." : "Найти обсуждения"}
            </button>
            <button
              type="button"
              onClick={() => summarize(query)}
              disabled={busy || query.trim().length < 2 || !canAskAi}
              className="flex-1 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-neuSm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {summarizing ? "Суммирую..." : canAskAi ? "Суммировать находки (AI)" : "Лимит на сегодня"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {featured.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setQuery(item);
                  runSearch(item);
                }}
                className="rounded-full bg-bg px-3 py-1.5 text-xs font-medium text-ink shadow-neuSm transition hover:text-accent"
              >
                {item}
              </button>
            ))}
          </div>

          {error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">⚠ {error}</p>}

          {answerData && (
            <div className="mt-5 rounded-[1.5rem] bg-bg p-4 shadow-inset">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">AI-сводка</h2>
                <span className="text-[11px] text-muted">по обсуждениям сообщества</span>
              </div>
              <div className="space-y-2 break-words [overflow-wrap:anywhere] text-[15px] leading-7 text-ink">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="mb-2">{children}</p>,
                    ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5">{children}</ol>,
                    li: ({ children }) => <li className="leading-6">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
                    h1: ({ children }) => <h3 className="mt-3 mb-1 text-base font-semibold text-ink">{children}</h3>,
                    h2: ({ children }) => <h3 className="mt-3 mb-1 text-base font-semibold text-ink">{children}</h3>,
                    h3: ({ children }) => <h3 className="mt-3 mb-1 text-base font-semibold text-ink">{children}</h3>,
                  }}
                >
                  {answerData.answer}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        <aside className="min-w-0 rounded-[2rem] bg-soft p-5 shadow-neu md:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">Как это работает</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-ink/90">
            <p>1. Пишешь вопрос по Palisade обычными словами.</p>
            <p>2. Ищем семантически + по словам в базе обсуждений сообщества.</p>
            <p>3. Получаешь реальные треды: дата, активность, реакции.</p>
            <p>4. По кнопке AI коротко суммирует, что пишут люди.</p>
          </div>
          <div className="mt-5 rounded-[1.5rem] bg-bg p-4 shadow-inset">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Частые темы</div>
            <ul className="mt-3 space-y-2 text-sm text-ink/90">
              <li>• тормоза и расходники</li>
              <li>• масло и интервалы обслуживания</li>
              <li>• HTRAC / AWD</li>
              <li>• дизель и бензин</li>
              <li>• электроника и мультимедиа</li>
            </ul>
          </div>
          <p className="mt-5 text-xs leading-5 text-muted">
            Поиск идёт по архиву обсуждений владельцев. AI отвечает только по найденным
            тредам и не выдумывает фактов.
          </p>
        </aside>
      </section>

      <section className="mt-5 rounded-[2rem] bg-soft p-5 shadow-neu md:p-7">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">Обсуждения</h2>
          <div className="text-xs text-muted">
            {searchData?.results?.length ? `${searchData.results.length} найдено` : "пока пусто"}
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {(searchData?.results ?? []).map((item) => (
            <article key={item.id} className="rounded-[1.5rem] bg-bg p-4 shadow-inset">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium uppercase tracking-[0.15em] text-muted">
                <span>{fmtDate(item.start_date)}</span>
                <span>💬 {item.message_count} сообщ.</span>
                <span>👥 {item.participants_count}</span>
                {item.reactions_total > 0 && <span>❤ {item.reactions_total}</span>}
                {item.source_channel && <span className="normal-case tracking-normal">{item.source_channel}</span>}
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-6 text-ink/90">{item.excerpt}</p>
            </article>
          ))}
          {(searchData?.results?.length ?? 0) === 0 && !error && (
            <div className="rounded-[1.5rem] border border-dashed border-line bg-bg p-5 text-sm text-muted">
              Пока нет результатов. Попробуй один из готовых запросов выше.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
