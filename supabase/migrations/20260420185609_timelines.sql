-- Timelines: user-defined lanes on the grid. The 3 original lanes
-- (Logos + Rhema, Prayer, Discipleship) are represented as built-in rows
-- keyed by `builtin_kind` so the UI can keep kind-specific behavior
-- (composer flow, rooms, logos_tag) while letting users also add their own
-- custom lanes with arbitrary names and drag-reorder them.

create table if not exists public.timelines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  -- Fractional so reorders only need to update the moved row (place it
  -- halfway between its new neighbours) rather than renumbering the whole
  -- list.
  sort_order double precision not null default 0,
  -- Non-null for the 3 built-ins (unique per user); null for custom lanes.
  builtin_kind dot_kind,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists timelines_owner_builtin_idx
  on public.timelines (owner_id, builtin_kind)
  where builtin_kind is not null;

create index if not exists timelines_owner_sort_idx
  on public.timelines (owner_id, sort_order);

drop trigger if exists timelines_set_updated_at on public.timelines;
create trigger timelines_set_updated_at
  before update on public.timelines
  for each row execute function public.set_updated_at();

alter table public.timelines enable row level security;

drop policy if exists timelines_owner_all on public.timelines;
create policy timelines_owner_all on public.timelines
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Dots gain an optional timeline_id. For built-in lanes, dots created before
-- this migration have timeline_id = null and are matched by (kind = builtin_kind)
-- at the query layer. Dots on custom lanes must have a timeline_id.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.dots
  add column if not exists timeline_id uuid references public.timelines(id) on delete cascade;

create index if not exists dots_timeline_idx on public.dots(timeline_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- ensure_builtin_timelines: idempotent seed for a single user. Called from
-- handle_new_user on signup and from the backfill below for existing users.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.ensure_builtin_timelines(p_user uuid)
returns void
security definer
set search_path = public
as $$
begin
  insert into public.timelines (owner_id, name, sort_order, builtin_kind)
  values
    (p_user, 'Logos + Rhema', 0, 'logos'),
    (p_user, 'Prayer',        1, 'prayer'),
    (p_user, 'Discipleship',  2, 'discipleship')
  on conflict (owner_id, builtin_kind) where builtin_kind is not null do nothing;
end;
$$ language plpgsql;

-- Extend the new-user trigger to also seed built-in timelines.
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email))
  on conflict (user_id) do nothing;

  insert into public.rooms (owner_id, kind, livekit_room_name)
  values (new.id, 'lounge', 'lounge_' || replace(new.id::text, '-', ''))
  on conflict do nothing;

  perform public.ensure_builtin_timelines(new.id);

  return new;
end;
$$ language plpgsql;

-- Backfill for existing users.
do $$
declare u record;
begin
  for u in select id from auth.users loop
    perform public.ensure_builtin_timelines(u.id);
  end loop;
end $$;

-- Enable realtime broadcasts so the `useTimelines` hook picks up changes
-- from other tabs / devices. Wrapped in a DO block so re-running the
-- migration (or running on a project where the table is already part of the
-- publication) doesn't error out.
do $$
begin
  alter publication supabase_realtime add table public.timelines;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
