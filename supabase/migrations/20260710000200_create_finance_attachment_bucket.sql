begin;

insert into storage.buckets (id, name, public)
values ('finance-attachments', 'finance-attachments', false)
on conflict (id) do update set public = excluded.public;

create policy finance_attachment_objects_select
on storage.objects for select to authenticated
using (bucket_id = 'finance-attachments' and owner_id = auth.uid());

create policy finance_attachment_objects_insert
on storage.objects for insert to authenticated
with check (bucket_id = 'finance-attachments' and owner_id = auth.uid());

create policy finance_attachment_objects_update
on storage.objects for update to authenticated
using (bucket_id = 'finance-attachments' and owner_id = auth.uid())
with check (bucket_id = 'finance-attachments' and owner_id = auth.uid());

create policy finance_attachment_objects_delete
on storage.objects for delete to authenticated
using (bucket_id = 'finance-attachments' and owner_id = auth.uid());

commit;
