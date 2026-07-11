-- Contengine: multi-client social scheduling
-- Run in the Supabase SQL editor (or `supabase db push`).

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type post_status as enum (
  'draft',
  'ready',
  'awaiting_approval',
  'approved',
  'scheduled',
  'publishing',
  'published',
  'failed'
);

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------
create table clients (
  id                    uuid primary key default uuid_generate_v4(),
  name                  text not null,
  -- Meta connections
  fb_page_id            text,
  fb_page_access_token  text,          -- long-lived Page access token
  ig_user_id            text,          -- Instagram professional account ID
  -- Scheduling preferences
  preferred_days        int[]  not null default '{1,3,5}',      -- 0=Sun .. 6=Sat
  preferred_times       text[] not null default '{09:00}',      -- 24h HH:MM, client TZ
  weekly_frequency      int    not null default 3,              -- max posts per week
  timezone              text   not null default 'Australia/Sydney',
  default_platforms     text[] not null default '{facebook,instagram}',
  -- Content strategy
  brand_instructions    text,
  pillar_rotation       text[] not null default '{}',           -- e.g. {education,social_proof,offer}
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Posts
-- ---------------------------------------------------------------------------
create table posts (
  id                uuid primary key default uuid_generate_v4(),
  client_id         uuid not null references clients(id) on delete cascade,
  title             text,
  caption           text not null default '',
  category          text,                                 -- content pillar
  platforms         text[] not null default '{}',         -- subset of {facebook,instagram}
  campaign          jsonb  not null default '{}',         -- arbitrary campaign metadata
  status            post_status not null default 'draft',
  -- Content
  slides            jsonb not null default '[]',          -- [{ "html": "<!doctype html>..." }]
  rendered_media    jsonb not null default '[]',          -- [{ "url": "...", "path": "...", "width":1080, "height":1350 }]
  -- Lifecycle
  scheduled_at      timestamptz,
  approved_at       timestamptz,
  approved_by       text,
  published_at      timestamptz,
  -- Publish results per platform: { "facebook": {"post_id":"...","url":"...","error":null}, ... }
  platform_results  jsonb not null default '{}',
  error_message     text,
  retry_count       int not null default 0,
  source            text not null default 'manual',       -- manual | ingest_api
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index posts_status_idx        on posts (status);
create index posts_client_idx        on posts (client_id);
create index posts_scheduled_at_idx  on posts (scheduled_at) where status in ('scheduled','publishing');

-- updated_at trigger
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clients_updated_at before update on clients
  for each row execute function set_updated_at();
create trigger posts_updated_at before update on posts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- The dashboard talks to the DB through the service-role key (server only),
-- so RLS locks the anon key out entirely. Authenticated users get read access
-- for any future client-side queries.
-- ---------------------------------------------------------------------------
alter table clients enable row level security;
alter table posts   enable row level security;

create policy "authenticated read clients" on clients
  for select to authenticated using (true);
create policy "authenticated read posts" on posts
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Storage bucket for rendered PNGs (public read so Meta can fetch image URLs)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('renders', 'renders', true)
on conflict (id) do nothing;

create policy "public read renders" on storage.objects
  for select using (bucket_id = 'renders');
