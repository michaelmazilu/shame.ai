-- shame.ai multiplayer: rooms, players, rounds, deed templates
-- RLS on; no public policies — Edge Functions use service_role.

-- ---------------------------------------------------------------------------
-- deed_templates: server-fixed deck (weighted random choice in Edge later)
-- ---------------------------------------------------------------------------
create table if not exists public.deed_templates (
  id uuid primary key default gen_random_uuid(),
  deed_type text not null,
  params jsonb not null default '{}'::jsonb,
  weight integer not null default 1 check (weight > 0),
  created_at timestamptz not null default now()
);

comment on table public.deed_templates is 'Weighted deed pool; Edge Functions pick at random for start_round.';

-- ---------------------------------------------------------------------------
-- rooms
-- ---------------------------------------------------------------------------
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  short_code text not null unique,
  invite_token text not null unique,
  host_secret_hash text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists rooms_short_code_idx on public.rooms (short_code);
create index if not exists rooms_status_idx on public.rooms (status);

comment on table public.rooms is 'Game room; join via short_code or invite_token; host proves with host_secret (hash stored).';
comment on column public.rooms.host_secret_hash is 'SHA-256 hex of host_secret; verify in Edge before start_round.';

-- ---------------------------------------------------------------------------
-- room_players
-- ---------------------------------------------------------------------------
create table if not exists public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  player_token_hash text not null,
  role text not null default 'member' check (role in ('host', 'member')),
  display_name text,
  ig_username text,
  profile_pic_url text,
  last_seen_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  unique (room_id, player_token_hash)
);

create index if not exists room_players_room_id_idx on public.room_players (room_id);
create index if not exists room_players_last_seen_idx on public.room_players (room_id, last_seen_at desc);

comment on table public.room_players is 'Players in a room; player_token validated via hash; last_seen_at drives ready/repick.';

-- ---------------------------------------------------------------------------
-- rounds
-- ---------------------------------------------------------------------------
create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  round_index integer not null,
  victim_player_id uuid not null references public.room_players (id) on delete cascade,
  deed jsonb not null,
  status text not null default 'assigned' check (status in ('assigned', 'completed', 'failed', 'skipped')),
  result_status text,
  result_detail text,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (room_id, round_index)
);

create index if not exists rounds_room_id_idx on public.rounds (room_id, created_at desc);
create index if not exists rounds_victim_idx on public.rounds (victim_player_id);

comment on table public.rounds is 'One punishment round; deed JSON matches protocol ROUND_ASSIGNMENT.';

-- ---------------------------------------------------------------------------
-- RLS: enabled, no policies — only service_role (Edge Functions) bypasses
-- ---------------------------------------------------------------------------
alter table public.deed_templates enable row level security;
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.rounds enable row level security;

-- ---------------------------------------------------------------------------
-- Seed a minimal deed deck (DM / follow / unfollow placeholders)
-- ---------------------------------------------------------------------------
insert into public.deed_templates (id, deed_type, params, weight) values
  ('a0000001-0000-4000-8000-000000000001', 'dm_random', '{"hint": "Send a DM from server template v1"}'::jsonb, 3),
  ('a0000001-0000-4000-8000-000000000002', 'follow_user', '{"hint": "Follow target username from deed params"}'::jsonb, 2),
  ('a0000001-0000-4000-8000-000000000003', 'unfollow_user', '{"hint": "Unfollow target"}'::jsonb, 1)
on conflict (id) do nothing;
