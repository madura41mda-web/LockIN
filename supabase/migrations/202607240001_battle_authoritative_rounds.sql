alter table public.battle_rooms
  add column if not exists round_phase text not null default 'question';

alter table public.battle_rooms
  drop constraint if exists battle_rooms_round_phase_check;

alter table public.battle_rooms
  add constraint battle_rooms_round_phase_check
  check (round_phase in ('question', 'reveal'));

alter table public.battle_rooms
  add column if not exists round_started_at timestamptz,
  add column if not exists round_ends_at timestamptz,
  add column if not exists reveal_ends_at timestamptz;

update public.battle_rooms
set
  round_started_at = coalesce(round_started_at, current_question_started_at),
  round_ends_at = coalesce(
    round_ends_at,
    case
      when current_question_started_at is not null
      then current_question_started_at + ((time_per_question || ' seconds')::interval)
      else null
    end
  )
where status = 'in_progress';

drop function if exists public.start_battle(uuid);

create or replace function public.start_battle(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.battle_rooms%rowtype;
  v_player_count integer;
  v_ready_count integer;
  v_now timestamptz := now();
begin
  select *
  into v_room
  from public.battle_rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'Battle room not found';
  end if;

  if v_room.host_id <> auth.uid() then
    raise exception 'Only the battle host can start this battle' using errcode = '42501';
  end if;

  select
    count(*),
    count(*) filter (where is_ready)
  into v_player_count, v_ready_count
  from public.battle_players
  where room_id = p_room_id;

  if v_player_count < 2 or v_ready_count < 2 then
    raise exception 'Both battle players must be ready before starting';
  end if;

  update public.battle_rooms
  set
    status = 'in_progress',
    current_question_index = 0,
    current_question_started_at = v_now,
    round_phase = 'question',
    round_started_at = v_now,
    round_ends_at = v_now + ((time_per_question || ' seconds')::interval),
    reveal_ends_at = null,
    updated_at = v_now
  where id = p_room_id
    and status = 'waiting';
end;
$$;

drop function if exists public.advance_question(uuid, integer);

create or replace function public.advance_question(p_room_id uuid, p_expected_index integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.battle_rooms%rowtype;
  v_now timestamptz := now();
  v_player_count integer;
  v_answer_count integer;
  v_question_ends_at timestamptz;
begin
  select *
  into v_room
  from public.battle_rooms
  where id = p_room_id
  for update;

  if not found then
    raise exception 'Battle room not found';
  end if;

  if v_room.host_id <> auth.uid() then
    raise exception 'Only the battle host can advance this battle' using errcode = '42501';
  end if;

  if v_room.status <> 'in_progress' or v_room.current_question_index <> p_expected_index then
    return false;
  end if;

  select count(*)
  into v_player_count
  from public.battle_players
  where room_id = p_room_id;

  select count(distinct player_id)
  into v_answer_count
  from public.battle_answers
  where room_id = p_room_id
    and question_index = p_expected_index;

  v_question_ends_at := coalesce(
    v_room.round_ends_at,
    v_room.current_question_started_at + ((v_room.time_per_question || ' seconds')::interval),
    v_now
  );

  if v_room.round_phase = 'question' then
    if v_now < v_question_ends_at and v_answer_count < v_player_count then
      return false;
    end if;

    insert into public.battle_answers (
      room_id,
      player_id,
      question_index,
      selected_answer,
      is_correct,
      response_time_ms,
      points_earned,
      answered_at
    )
    select
      p_room_id,
      player.id,
      p_expected_index,
      '-1',
      false,
      greatest(0, v_room.time_per_question * 1000),
      0,
      v_now
    from public.battle_players player
    where player.room_id = p_room_id
      and not exists (
        select 1
        from public.battle_answers answer
        where answer.room_id = p_room_id
          and answer.question_index = p_expected_index
          and answer.player_id = player.id
      );

    update public.battle_players player
    set streak = 0
    where player.room_id = p_room_id
      and exists (
        select 1
        from public.battle_answers answer
        where answer.room_id = p_room_id
          and answer.question_index = p_expected_index
          and answer.player_id = player.id
          and answer.selected_answer = '-1'
      );

    update public.battle_rooms
    set
      round_phase = 'reveal',
      reveal_ends_at = v_now + interval '3 seconds',
      updated_at = v_now
    where id = p_room_id
      and current_question_index = p_expected_index
      and status = 'in_progress'
      and round_phase = 'question';

    return found;
  end if;

  if v_room.round_phase = 'reveal' then
    if v_room.reveal_ends_at is not null and v_now < v_room.reveal_ends_at then
      return false;
    end if;

    if p_expected_index >= v_room.question_count - 1 then
      with stats as (
        select
          player.id as player_id,
          player.user_id,
          player.score as final_score,
          count(answer.id) filter (where answer.is_correct) as correct_count,
          greatest(0, v_room.question_count - count(answer.id) filter (where answer.is_correct)) as wrong_count,
          round((count(answer.id) filter (where answer.is_correct))::numeric * 100 / greatest(1, v_room.question_count))::integer as accuracy_pct,
          coalesce(round(avg(answer.response_time_ms) filter (where answer.selected_answer <> '-1'))::integer, 0) as avg_response_time_ms,
          coalesce(min(answer.response_time_ms) filter (where answer.selected_answer <> '-1'), 0) as fastest_answer_ms
        from public.battle_players player
        left join public.battle_answers answer
          on answer.player_id = player.id
          and answer.room_id = p_room_id
        where player.room_id = p_room_id
        group by player.id, player.user_id, player.score
      ),
      ranked as (
        select
          stats.*,
          dense_rank() over (order by stats.final_score desc) as placement
        from stats
      )
      insert into public.battle_results (
        room_id,
        player_id,
        user_id,
        final_score,
        placement,
        correct_count,
        wrong_count,
        accuracy_pct,
        avg_response_time_ms,
        fastest_answer_ms
      )
      select
        p_room_id,
        ranked.player_id,
        ranked.user_id,
        ranked.final_score,
        ranked.placement,
        ranked.correct_count,
        ranked.wrong_count,
        ranked.accuracy_pct,
        ranked.avg_response_time_ms,
        ranked.fastest_answer_ms
      from ranked
      where not exists (
        select 1
        from public.battle_results existing
        where existing.room_id = p_room_id
          and existing.player_id = ranked.player_id
      );

      update public.battle_rooms
      set
        status = 'completed',
        updated_at = v_now
      where id = p_room_id
        and current_question_index = p_expected_index
        and status = 'in_progress'
        and round_phase = 'reveal';

      return found;
    end if;

    update public.battle_rooms
    set
      current_question_index = current_question_index + 1,
      current_question_started_at = v_now,
      round_phase = 'question',
      round_started_at = v_now,
      round_ends_at = v_now + ((time_per_question || ' seconds')::interval),
      reveal_ends_at = null,
      updated_at = v_now
    where id = p_room_id
      and current_question_index = p_expected_index
      and status = 'in_progress'
      and round_phase = 'reveal';

    return found;
  end if;

  return false;
end;
$$;

grant execute on function public.start_battle(uuid) to authenticated;
grant execute on function public.advance_question(uuid, integer) to authenticated;
