create extension if not exists pg_trgm;

create table if not exists knowledge_chunks (
  id text primary key,
  source text not null default 'unknown',
  source_channel text,
  source_url text,
  message_id text,
  author text,
  posted_at timestamptz,
  topic text not null default 'Palisade',
  title text not null,
  content text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('russian', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('russian', coalesce(topic, '')), 'B') ||
    setweight(to_tsvector('russian', coalesce(content, '')), 'C')
  ) stored
);

create index if not exists knowledge_chunks_search_idx on knowledge_chunks using gin (search_vector);
create index if not exists knowledge_chunks_trgm_idx on knowledge_chunks using gin (content gin_trgm_ops);
create index if not exists knowledge_chunks_channel_idx on knowledge_chunks (source_channel);
create index if not exists knowledge_chunks_posted_at_idx on knowledge_chunks (posted_at desc);

create or replace function search_knowledge_chunks(
  query_text text,
  match_count int default 8
)
returns table (
  id text,
  title text,
  topic text,
  content text,
  tags text[],
  source text,
  source_channel text,
  source_url text,
  posted_at timestamptz,
  score real
)
language sql
stable
as $$
  with q as (
    select websearch_to_tsquery('russian', query_text) as tsq
  ),
  ranked as (
    select
      k.id,
      k.title,
      k.topic,
      k.content,
      k.tags,
      k.source,
      k.source_channel,
      k.source_url,
      k.posted_at,
      (
        ts_rank_cd(k.search_vector, q.tsq) * 10
        + similarity(k.content, query_text)
        + similarity(k.title, query_text) * 2
      )::real as score
    from knowledge_chunks k, q
    where k.search_vector @@ q.tsq
       or k.content % query_text
       or k.title % query_text
  )
  select *
  from ranked
  order by score desc, posted_at desc nulls last
  limit greatest(1, least(match_count, 20));
$$;
