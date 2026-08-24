-- v3.4.12: proof-of-concept Microsoft Graph mailbox connection for
-- Ahaana's school Outlook account (cns.ac.in) — a parent-facing
-- feature on /ahaana-progress ("Connect School Email"), NOT reachable
-- from her own /ahaana/* section. This milestone only proves Atlas can
-- connect, retain the connection, and read her Inbox — no daily
-- automation, no AI analysis, no task/event extraction yet.
--
-- Stores ONLY the refresh token, encrypted at rest (see
-- src/lib/crypto/token-encryption.ts) — this is the first genuinely
-- sensitive external secret this app has ever needed to persist (every
-- other stored "secret" so far — the Telegram chat ID, a web push
-- subscription's own auth keys — is plain JSON in
-- finance.notification_channels, relying only on the service-role
-- client's own access control). Access tokens are deliberately NOT
-- stored: they're short-lived (~1h) and this is a manual,
-- click-a-button-to-test flow, so a fresh one is minted from the
-- refresh token on every use instead of tracking expiry for a cached
-- one.
--
-- Same single-owner convention as every other table: user_id =
-- OWNER_USER_ID, RLS present but not the real enforcement boundary
-- (the service-role client bypasses it — see src/lib/owner.ts).
-- unique(user_id, provider) — one connection per provider, since this
-- app has no concept of multiple mailboxes yet.
create table finance.ahaana_ms_email_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider text not null default 'microsoft'
    check (provider in ('microsoft')),
  email_address text not null check (char_length(email_address) between 1 and 320),
  encrypted_refresh_token text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, provider)
);

comment on table finance.ahaana_ms_email_connections is
  'A single Microsoft OAuth mailbox connection (delegated, Mail.Read only) for the school-email POC. One row per provider per owner. encrypted_refresh_token is AES-256-GCM-encrypted (see src/lib/crypto/token-encryption.ts) -- the access token itself is never stored, only ever minted fresh from this refresh token on demand.';
comment on column finance.ahaana_ms_email_connections.email_address is
  'The connected mailbox address, shown as-is on the parent-facing progress page ("Connected -- ahaana.kohli@cns.ac.in"). Not used for any access-control decision.';
comment on column finance.ahaana_ms_email_connections.encrypted_refresh_token is
  'Microsoft rotates the refresh token on most refresh grants -- this column is overwritten with the newest one on every successful refresh call (see MicrosoftEmailConnectionService.getValidAccessToken). Never sent to the browser; only ever decrypted server-side.';

create trigger set_ahaana_ms_email_connections_updated_at
  before update on finance.ahaana_ms_email_connections
  for each row execute function finance.set_updated_at();

alter table finance.ahaana_ms_email_connections enable row level security;
create policy user_isolation on finance.ahaana_ms_email_connections
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
grant select, insert, update, delete on finance.ahaana_ms_email_connections to authenticated;
grant all privileges on finance.ahaana_ms_email_connections to service_role;
