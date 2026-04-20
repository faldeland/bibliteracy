-- Free-form user tags on dots. Orthogonal to `logos_tag` (which is a fixed
-- enum for the Logos lane) — `tags` is an arbitrary set of short labels the
-- user attaches for filtering, search, and cross-linking across lanes.
alter table public.dots
  add column if not exists tags text[] not null default '{}'::text[];

-- GIN index enables fast containment queries, e.g. `tags @> array['gospel']`.
create index if not exists dots_tags_gin_idx
  on public.dots using gin (tags);
