alter table public.study_documents
  add column if not exists file_hash text,
  add column if not exists extraction_method text not null default 'text',
  add column if not exists ocr_confidence numeric;

create index if not exists study_documents_user_file_hash_idx
  on public.study_documents(user_id, file_hash);
