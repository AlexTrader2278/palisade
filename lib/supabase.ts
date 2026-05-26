import { createClient } from "@supabase/supabase-js";

export type KnowledgeChunk = {
  id: string;
  title: string;
  topic: string;
  content: string;
  tags: string[];
  source: string;
  source_channel: string | null;
  source_url: string | null;
  posted_at: string | null;
  score: number;
};

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return { url, key };
}

export function hasSupabaseConfig() {
  return Boolean(getSupabaseConfig());
}

export function getSupabaseAdmin() {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  return createClient(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function searchSupabaseKnowledge(query: string, limit = 8): Promise<KnowledgeChunk[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("search_knowledge_chunks", {
    query_text: query,
    match_count: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as KnowledgeChunk[];
}
