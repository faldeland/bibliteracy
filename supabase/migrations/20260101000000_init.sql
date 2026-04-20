-- Bibliteracy initial schema
-- Run via `supabase db push` or paste into the Supabase SQL editor.

-- ─────────────────────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  create type dot_kind as enum ('logos', 'prayer', 'discipleship');
exception when duplicate_object then null; end $$;

do $$ begin
  create type dot_visibility as enum ('private', 'guests', 'public');
exception when duplicate_object then null; end $$;

do $$ begin
  create type logos_tag as enum ('logos', 'rhema', 'both');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Profiles (mirror of auth.users)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Guests (accepted invite relationships: owner ↔ guest)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.guests (
  owner_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, guest_id)
);
create index if not exists guests_guest_idx on public.guests(guest_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Invites (pending invitations by email + token)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  token text not null unique,
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invites_owner_idx on public.invites(owner_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Dots — the core unit on the timeline
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.dots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind dot_kind not null,
  occurred_on date not null,
  title text,
  body_md text,
  /* Bible references: [{ "book": "Jhn", "chapter": 3, "verseStart": 16, "verseEnd": 17 }, ...] */
  refs jsonb not null default '[]'::jsonb,
  /* For Logos lane: tag the entry as logos / rhema / both. Null for other lanes. */
  logos_tag logos_tag,
  visibility dot_visibility not null default 'private',
  /* Discipleship-only: live room metadata */
  livekit_room_name text,
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists dots_owner_kind_date_idx
  on public.dots(owner_id, kind, occurred_on);
create index if not exists dots_visibility_idx
  on public.dots(visibility);

-- ─────────────────────────────────────────────────────────────────────────────
-- Dot attachments (uploads in Supabase Storage or external links)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.dot_attachments (
  id uuid primary key default gen_random_uuid(),
  dot_id uuid not null references public.dots(id) on delete cascade,
  kind text not null check (kind in ('image','video','audio','link','pdf')),
  url text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists dot_attachments_dot_idx on public.dot_attachments(dot_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Live rooms (always-on lounge + per-dot rooms)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('lounge','dot')),
  dot_id uuid references public.dots(id) on delete cascade,
  livekit_room_name text not null unique,
  created_at timestamptz not null default now()
);
create unique index if not exists rooms_one_lounge_per_owner
  on public.rooms(owner_id) where kind = 'lounge';

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists dots_set_updated_at on public.dots;
create trigger dots_set_updated_at
  before update on public.dots
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-create a profile + lounge room on user signup
-- ─────────────────────────────────────────────────────────────────────────────
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

  return new;
end;
$$ language plpgsql;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- accept_invite: lets a signed-in user redeem an invite token. Marks the
-- invite as accepted and creates the matching guests row in one shot. Runs
-- with definer rights so the recipient can update an invite row they don't own.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.accept_invite(p_token text)
returns void
security definer
set search_path = public
as $$
declare
  v_invite invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;

  select * into v_invite from public.invites where token = p_token;
  if not found then
    raise exception 'invite not found';
  end if;
  if v_invite.accepted_by is not null and v_invite.accepted_by <> auth.uid() then
    raise exception 'invite already used';
  end if;
  if v_invite.owner_id = auth.uid() then
    raise exception 'cannot accept your own invite';
  end if;

  update public.invites
    set accepted_by = auth.uid(),
        accepted_at = now()
    where id = v_invite.id;

  insert into public.guests (owner_id, guest_id)
  values (v_invite.owner_id, auth.uid())
  on conflict do nothing;
end;
$$ language plpgsql;

grant execute on function public.accept_invite(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles        enable row level security;
alter table public.guests          enable row level security;
alter table public.invites         enable row level security;
alter table public.dots            enable row level security;
alter table public.dot_attachments enable row level security;
alter table public.rooms           enable row level security;

-- profiles: anyone authenticated can read; owner can update.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (true);

drop policy if exists profiles_upsert_self on public.profiles;
create policy profiles_upsert_self on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (auth.uid() = user_id);

-- guests: owner sees and manages their guests; the guest can see their own row.
drop policy if exists guests_select on public.guests;
create policy guests_select on public.guests
  for select using (auth.uid() = owner_id or auth.uid() = guest_id);

drop policy if exists guests_owner_write on public.guests;
create policy guests_owner_write on public.guests
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- invites: only the owner manages.
drop policy if exists invites_owner_all on public.invites;
create policy invites_owner_all on public.invites
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- dots: visibility-based read; owner full write.
drop policy if exists dots_select on public.dots;
create policy dots_select on public.dots
  for select using (
    auth.uid() = owner_id
    or visibility = 'public'
    or (
      visibility = 'guests'
      and exists (
        select 1 from public.guests g
        where g.owner_id = dots.owner_id and g.guest_id = auth.uid()
      )
    )
  );

drop policy if exists dots_owner_write on public.dots;
create policy dots_owner_write on public.dots
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- dot_attachments: piggyback on parent dot visibility.
drop policy if exists dot_attachments_select on public.dot_attachments;
create policy dot_attachments_select on public.dot_attachments
  for select using (
    exists (
      select 1 from public.dots d
      where d.id = dot_attachments.dot_id
        and (
          auth.uid() = d.owner_id
          or d.visibility = 'public'
          or (
            d.visibility = 'guests'
            and exists (
              select 1 from public.guests g
              where g.owner_id = d.owner_id and g.guest_id = auth.uid()
            )
          )
        )
    )
  );

drop policy if exists dot_attachments_owner_write on public.dot_attachments;
create policy dot_attachments_owner_write on public.dot_attachments
  for all using (
    exists (select 1 from public.dots d where d.id = dot_id and d.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.dots d where d.id = dot_id and d.owner_id = auth.uid())
  );

-- rooms: owner full; guests can read rooms tied to dots they can see.
drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms
  for select using (
    auth.uid() = owner_id
    or (
      kind = 'lounge'
      and exists (
        select 1 from public.guests g
        where g.owner_id = rooms.owner_id and g.guest_id = auth.uid()
      )
    )
    or (
      kind = 'dot'
      and exists (
        select 1 from public.dots d
        where d.id = rooms.dot_id
          and (
            d.visibility = 'public'
            or (
              d.visibility = 'guests'
              and exists (
                select 1 from public.guests g
                where g.owner_id = d.owner_id and g.guest_id = auth.uid()
              )
            )
          )
      )
    )
  );

drop policy if exists rooms_owner_write on public.rooms;
create policy rooms_owner_write on public.rooms
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
