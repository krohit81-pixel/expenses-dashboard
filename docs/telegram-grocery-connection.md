# Separate grocery Telegram bot: connection-only phase

Uses @Atlas_Grocery_bot independently of the reminder bot. No dependency install or database migration is required. This phase checks connectivity, accepts permitted messages and replies only to an explicit connection-test command. It does not parse/persist grocery lists, call models/Swiggy, change carts or place orders.

## Deployment configuration

Keep existing reminder credentials and webhook unchanged. Set these server-side variables in the intended Vercel environment before deploying the reviewed code:

- TELEGRAM_GROCERY_BOT_TOKEN: new grocery bot token, stored as a Secret (already provisioned by the owner).
- TELEGRAM_GROCERY_WEBHOOK_SECRET: independent random Secret, e.g. `openssl rand -hex 32`.
- TELEGRAM_GROCERY_CHAT_ID: `-5318544889` for Kohli Kitchen. Confirm it again if Telegram upgrades the group to a supergroup.
- TELEGRAM_GROCERY_ALLOWED_USER_IDS: comma-separated Telegram user IDs. Owner's previously observed ID is `8260412227`; explicitly include the chef's ID when authorized. Bot messages and unlisted senders are ignored.

Leave all grocery variables unset to keep the feature disabled. Adding env variables requires deployment approval and a new deployment. Credentials are never returned in diagnostics; Telegram error bodies and network exception URLs are deliberately not logged.

## Connect and verify

1. Add the grocery bot to Kohli Kitchen, as an administrator with minimal rights, or disable its group privacy mode through BotFather. Leave the reminder bot unchanged.
2. After the approved deployment, sign into Atlas using the existing app access gate and open `/settings/grocery` on `https://expdash.vercel.app`.
3. The page performs read-only `getMe`, `getWebhookInfo`, `getChat` and `getChatMember` checks. Check that the identity is @Atlas_Grocery_bot, the group is Kohli Kitchen and ordinary-message reception is permitted.
4. Click **Register grocery webhook**. This explicit same-origin POST points only the grocery bot at `https://expdash.vercel.app/api/telegram/grocery/webhook`, with its own secret. Pending updates are retained. It never uses the reminder token; identical bot tokens are rejected.
5. An allowed human sender posts `/grocerytest@Atlas_Grocery_bot` in the group. A reply confirms the webhook round-trip. Refresh the page for webhook diagnostics.
6. Post a fresh ordinary grocery message. Vercel runtime logs should contain `Atlas grocery Telegram receipt` with its update/message/group IDs. Message text and sender identity are not logged. Ordinary lists are not acknowledged or processed in this phase.

The settings page and setup endpoint remain behind Atlas's browser middleware. Only the inbound grocery webhook bypasses that gate; it verifies its own Telegram secret, group and sender allowlists. Do not expose setup or settings as public paths. Preview URLs can register only when the owner deliberately configures and opens that deployment; use production canonical URL for the real bot.

## Limitations and next step

Webhook URL/permission checks alone do not prove delivery; run the real command test. Diagnostic checks are on demand rather than continuous monitoring. A failed reply is reported in logs without automatically retrying it. Telegram redeliveries can repeat the diagnostic command reply; this phase has no persistent deduplication. Edited messages are logged as receipts and never repeat the command reply. Chat migrations, unknown update types, forwarded attribution and chef authorization need explicit handling before shopping ingestion.

No persistent inbox or daily list exists yet. Before enabling any grocery or retailer writes, add transactional update deduplication, durable processing/retry state, list revisions/corrections, audit, and cart reconciliation. Do not treat the receipt logs as a durable queue or proof that a shopping list was saved.

## Validation

`npm run typecheck`

`npm test -- src/app/api/telegram/grocery src/lib/telegram/grocery src/app/api/telegram/webhook/route.test.ts src/lib/env/server.test.ts`

Existing reminder webhook tests must continue to pass. Live Telegram connectivity can only be established after the approved deployment, environment setup and webhook registration.

## Deployment automation

Authenticated GET and PUT on the grocery webhook support read-only diagnostics and explicit webhook registration respectively. Both require the independent grocery secret in `X-Telegram-Bot-Api-Secret-Token`; unauthenticated requests are denied. PUT always registers the fixed production URL `https://expdash.vercel.app/api/telegram/grocery/webhook`; callers cannot provide another destination. This allows approved deployment automation without reading production bot tokens or browser passwords. Telegram delivers updates using POST only.
