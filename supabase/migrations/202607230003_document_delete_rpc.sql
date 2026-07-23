alter table public.flashcard_decks
  add column if not exists document_id text references public.study_documents(id) on delete set null;

alter table public.quiz_attempts
  add column if not exists document_id text references public.study_documents(id) on delete set null;

create index if not exists flashcard_decks_user_document_idx
  on public.flashcard_decks(user_id, document_id);

create index if not exists quiz_attempts_user_document_idx
  on public.quiz_attempts(user_id, document_id);

create or replace function public.delete_study_document(
  p_document_id text,
  p_delete_generated boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  deleted_decks integer := 0;
  deleted_attempts integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select user_id into owner_id
  from public.study_documents
  where id = p_document_id;

  if owner_id is null then
    raise exception 'Document not found';
  end if;

  if owner_id <> auth.uid() then
    raise exception 'Not authorized to delete this document';
  end if;

  if p_delete_generated then
    delete from public.flashcard_decks
    where user_id = auth.uid()
      and document_id = p_document_id;
    get diagnostics deleted_decks = row_count;

    delete from public.quiz_attempts
    where user_id = auth.uid()
      and document_id = p_document_id;
    get diagnostics deleted_attempts = row_count;
  end if;

  delete from public.study_documents
  where id = p_document_id
    and user_id = auth.uid();

  return jsonb_build_object(
    'document_id', p_document_id,
    'deleted_generated', p_delete_generated,
    'deleted_flashcard_decks', deleted_decks,
    'deleted_quiz_attempts', deleted_attempts
  );
end;
$$;

grant execute on function public.delete_study_document(text, boolean) to authenticated;
