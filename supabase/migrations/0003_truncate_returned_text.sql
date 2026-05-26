-- ============================================================
-- Снижение egress: search_threads возвращает усечённый текст (1500 симв.).
-- ВЫПОЛНИТЬ в Supabase SQL Editor проекта palisade-sergey (fqzasnqpqxmrsssmcnuy).
--
-- Поиск (вектор + FTS) по-прежнему идёт по ПОЛНОМУ тексту в БД — режется
-- только то, что уходит по сети клиенту. Под массовым тестом это заметно
-- экономит трафик Supabase Free.
--
-- create or replace сохраняет grant execute для anon, но security definer
-- надо указать заново — иначе сбросится на invoker.
-- ============================================================

create or replace function search_threads(
  query_embedding  halfvec(1024),
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
language plpgsql
security definer
set search_path = public
as $$
declare
  k constant int := 60;
begin
  return query
  with
  vec as (
    select t.id, row_number() over (order by t.embedding <=> query_embedding) as rnk
    from threads t
    where t.embedding is not null
      and (p_source_channel is null or t.source_channel = p_source_channel)
    order by t.embedding <=> query_embedding
    limit match_count * 3
  ),
  fts as (
    select t.id, row_number() over (order by ts_rank(t.fts, plainto_tsquery('russian', query_text)) desc) as rnk
    from threads t
    where t.fts @@ plainto_tsquery('russian', query_text)
      and (p_source_channel is null or t.source_channel = p_source_channel)
    limit match_count * 3
  ),
  fused as (
    select coalesce(v.id, f.id) as id,
           (case when v.rnk is null then 0.0::float8 else (1.0::float8 / (k + v.rnk)) end)
         + (case when f.rnk is null then 0.0::float8 else (1.0::float8 / (k + f.rnk)) end) as rrf
    from vec v
    full outer join fts f on f.id = v.id
  )
  select t.id,
         left(t.text, 1500) as text,   -- усечение только для передачи по сети
         t.source_channel, t.start_date, t.end_date,
         t.message_count, t.participants_count, t.reactions_total, fused.rrf
  from fused
  join threads t on t.id = fused.id
  order by fused.rrf desc
  limit match_count;
end;
$$;

grant execute on function search_threads(halfvec(1024), text, int, text) to anon;
