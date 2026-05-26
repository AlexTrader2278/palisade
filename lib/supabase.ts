import { httpPost } from "./http";
import { embed } from "./mistral";

export type Thread = {
  id: string;
  text: string;
  source_channel: string | null;
  start_date: string;
  end_date: string;
  message_count: number;
  participants_count: number;
  reactions_total: number;
  rrf_score: number;
};

function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  // Только anon/publishable ключ — публичный сервис не должен иметь service_role.
  const key =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  return { url, key };
}

export function hasSupabaseConfig(): boolean {
  return Boolean(supabaseConfig()) && Boolean(process.env.MISTRAL_API_KEY?.trim());
}

/** Гибридный поиск тредов: embed запроса (Mistral) + RPC search_threads (вектор + FTS, RRF). */
export async function searchThreads(
  query: string,
  matchCount = 20,
  sourceChannel: string | null = null
): Promise<Thread[]> {
  const config = supabaseConfig();
  if (!config) throw new Error("SUPABASE_URL и SUPABASE_ANON_KEY обязательны");
  const mistralKey = process.env.MISTRAL_API_KEY?.trim();
  if (!mistralKey) throw new Error("MISTRAL_API_KEY обязателен для поиска");

  const { embeddings } = await embed([query], mistralKey);
  const queryEmbedding = embeddings[0];
  if (!queryEmbedding) throw new Error("Не удалось получить embedding запроса");

  const res = await httpPost(
    `${config.url}/rest/v1/rpc/search_threads`,
    {
      // Postgres приводит строку "[...]" к halfvec(1024)
      query_embedding: `[${queryEmbedding.join(",")}]`,
      query_text: query,
      match_count: matchCount,
      p_source_channel: sourceChannel,
    },
    { apikey: config.key, Authorization: `Bearer ${config.key}` },
    30_000
  );

  if (res.status >= 400) {
    throw new Error(`Supabase rpc ${res.status}: ${res.body.slice(0, 300)}`);
  }
  return JSON.parse(res.body) as Thread[];
}
