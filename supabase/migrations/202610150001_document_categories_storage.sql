begin;
alter table public.documents add column if not exists category varchar(80) not null default 'other';
create index if not exists documents_owner_category_idx on public.documents(auth_user_id, category);
insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;
create policy documents_storage_select_own on storage.objects for select to authenticated using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy documents_storage_insert_own on storage.objects for insert to authenticated with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy documents_storage_update_own on storage.objects for update to authenticated using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid()::text)) with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy documents_storage_delete_own on storage.objects for delete to authenticated using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid()::text));
commit;
