create table if not exists public.study_documents (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  file_type text not null,
  file_size integer not null default 0,
  subject text not null default 'Full Document',
  extracted_text text not null,
  chunk_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_document_chunks (
  id text primary key,
  document_id text not null references public.study_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  page_number text,
  chunk_order integer not null,
  subject text not null default 'Full Document',
  content text not null,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_order)
);

create table if not exists public.study_lobby_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'closed', 'expired')),
  timer_status text not null default 'idle' check (timer_status in ('idle', 'running', 'paused')),
  timer_duration_seconds integer not null default 1500,
  timer_remaining_seconds integer not null default 1500,
  timer_started_at timestamptz,
  timer_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_lobby_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_lobby_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null default 'Student',
  avatar text not null default '0',
  custom_status text not null default '',
  current_action text not null default 'Idle',
  is_host boolean not null default false,
  is_online boolean not null default true,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create table if not exists public.study_lobby_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_lobby_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null default 'Student',
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists study_document_chunks_document_order_idx
  on public.study_document_chunks(document_id, chunk_order);
create index if not exists study_documents_user_created_idx
  on public.study_documents(user_id, created_at desc);
create index if not exists study_lobby_rooms_code_idx
  on public.study_lobby_rooms(code);
create index if not exists study_lobby_participants_room_idx
  on public.study_lobby_participants(room_id, is_online);
create index if not exists study_lobby_messages_room_created_idx
  on public.study_lobby_messages(room_id, created_at);

alter table public.study_documents enable row level security;
alter table public.study_document_chunks enable row level security;
alter table public.study_lobby_rooms enable row level security;
alter table public.study_lobby_participants enable row level security;
alter table public.study_lobby_messages enable row level security;

create or replace function public.is_study_lobby_member(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.study_lobby_participants participants
    where participants.room_id = p_room_id
      and participants.user_id = auth.uid()
  );
$$;

create or replace function public.is_active_study_lobby(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.study_lobby_rooms rooms
    where rooms.id = p_room_id
      and rooms.status = 'active'
  );
$$;

create policy "Users manage their processed documents"
  on public.study_documents
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their processed document chunks"
  on public.study_document_chunks
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.study_documents documents
      where documents.id = document_id and documents.user_id = auth.uid()
    )
  );

create policy "Authenticated users can find active study rooms"
  on public.study_lobby_rooms
  for select
  using (
    auth.uid() is not null
    and (
      status = 'active'
      or host_user_id = auth.uid()
      or public.is_study_lobby_member(id)
    )
  );

create policy "Users create rooms hosted by themselves"
  on public.study_lobby_rooms
  for insert
  with check (auth.uid() = host_user_id);

create policy "Hosts can update their rooms"
  on public.study_lobby_rooms
  for update
  using (auth.uid() = host_user_id)
  with check (auth.uid() = host_user_id);

create policy "Hosts can delete their rooms"
  on public.study_lobby_rooms
  for delete
  using (auth.uid() = host_user_id);

create policy "Room members can read participants"
  on public.study_lobby_participants
  for select
  using (
    auth.uid() is not null
    and public.is_study_lobby_member(room_id)
  );

create policy "Users can join active rooms as themselves"
  on public.study_lobby_participants
  for insert
  with check (
    auth.uid() = user_id
    and public.is_active_study_lobby(room_id)
  );

create policy "Users can update their own participant state"
  on public.study_lobby_participants
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Room members can read messages"
  on public.study_lobby_messages
  for select
  using (
    public.is_study_lobby_member(room_id)
  );

create policy "Room members can send messages"
  on public.study_lobby_messages
  for insert
  with check (
    auth.uid() = user_id
    and public.is_study_lobby_member(room_id)
  );

create or replace function public.update_study_lobby_timer(
  p_room_id uuid,
  p_user_id uuid,
  p_status text,
  p_duration_seconds integer,
  p_remaining_seconds integer,
  p_started_at timestamptz,
  p_ends_at timestamptz
)
returns public.study_lobby_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_room public.study_lobby_rooms;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Not authenticated as requested user';
  end if;

  update public.study_lobby_rooms
  set
    timer_status = p_status,
    timer_duration_seconds = greatest(60, least(coalesce(p_duration_seconds, 1500), 14400)),
    timer_remaining_seconds = greatest(0, least(coalesce(p_remaining_seconds, p_duration_seconds, 1500), 14400)),
    timer_started_at = p_started_at,
    timer_ends_at = p_ends_at,
    updated_at = now()
  where id = p_room_id
    and host_user_id = p_user_id
    and status = 'active'
  returning * into updated_room;

  if updated_room.id is null then
    raise exception 'Only the active room host can update the timer';
  end if;

  return updated_room;
end;
$$;

grant execute on function public.update_study_lobby_timer(uuid, uuid, text, integer, integer, timestamptz, timestamptz)
  to authenticated;
grant execute on function public.is_study_lobby_member(uuid) to authenticated;
grant execute on function public.is_active_study_lobby(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'study_lobby_rooms'
  ) then
    alter publication supabase_realtime add table public.study_lobby_rooms;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'study_lobby_participants'
  ) then
    alter publication supabase_realtime add table public.study_lobby_participants;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'study_lobby_messages'
  ) then
    alter publication supabase_realtime add table public.study_lobby_messages;
  end if;
end $$;
