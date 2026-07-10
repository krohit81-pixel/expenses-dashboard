# Supabase: Vitals finance schema

Apply the migrations in `supabase/migrations` to the existing **Vitals** Supabase project with the Supabase CLI:

```bash
npx supabase init
npx supabase link --project-ref <vitals-project-ref>
npx supabase db push
```

The migrations create and isolate all application data under the `finance` schema. They grant `service_role` full schema, table, sequence, and function access; server-only code can use the service-role key with `supabase.schema('finance')`. When using a service-role key, supply the target `user_id` explicitly because `auth.uid()` is not populated for service-role requests.

For browser or authenticated REST access, add `finance` to **Project Settings -> API -> Exposed schemas** in the Vitals dashboard. Do not expose `service_role` credentials to the browser. Row-level security permits authenticated people to access only rows whose `user_id` matches `auth.uid()`.

Create a private `finance-attachments` bucket in Supabase Storage before accepting attachment uploads. Storage object policies should constrain paths to each authenticated user, such as `<user-id>/<file-name>`.
