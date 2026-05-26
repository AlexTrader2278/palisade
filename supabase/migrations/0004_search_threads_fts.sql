-- ============================================================
-- FTS-only поиск — резерв, когда Mistral недоступен (429 capacity).
-- ВЫПОЛНИТЬ в Supabase SQL Editor проекта palisade-sergey (fqzasnqpqxmrsssmcnuy).
--
-- Если эмбеддинг запроса не удалось получить, приложение зовёт эту функцию
-- вместо search_threads — поиск деградирует до keyword (русский FTS),
-- но НЕ падает с ошибкой. Текст усечён до 1500 симв. (срез egress).
-- ============================================================

create or replace function search_threads_fts(
  query_text       text,
  match_count      int default 30,
  p_source_channel text default null
)
returns table (
  id                 text,
  text               text,
  source_channel     text,
  start_date         timestamptz,
  end_date           timestamptz,
  message_count      int,
  participants_count int,
  reactions_total    int,
  rrf_score          float
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id,
         left(t.text, 1500) as text,
         t.source_channel, t.start_date, t.end_date,
         t.message_count, t.participants_count, t.reactions_total,
         ts_rank(t.fts, plainto_tsquery('russian', query_text))::float as rrf_score
  from threads t
  where t.fts @@ plainto_tsquery('russian', query_text)
    and (p_source_channel is null or t.source_channel = p_source_channel)
  order by rrf_score desc
  limit match_count;
$$;

grant execute on function search_threads_fts(text, int, text) to anon;
