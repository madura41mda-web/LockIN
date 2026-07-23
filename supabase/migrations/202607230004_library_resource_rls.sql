alter table public.flashcard_decks enable row level security;
alter table public.quiz_attempts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'flashcard_decks'
      and policyname = 'Users manage their own flashcard decks'
  ) then
    create policy "Users manage their own flashcard decks"
      on public.flashcard_decks
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'quiz_attempts'
      and policyname = 'Users manage their own quiz attempts'
  ) then
    create policy "Users manage their own quiz attempts"
      on public.quiz_attempts
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
