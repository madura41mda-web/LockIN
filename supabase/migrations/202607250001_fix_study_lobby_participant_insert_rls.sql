begin;

alter table public.study_lobby_participants enable row level security;

drop policy if exists "Users can join active rooms as themselves"
  on public.study_lobby_participants;

create policy "Users can join active rooms as themselves"
  on public.study_lobby_participants
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.study_lobby_rooms rooms
      where rooms.id = study_lobby_participants.room_id
        and rooms.status = 'active'
    )
  );

commit;
