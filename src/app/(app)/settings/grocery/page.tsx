import { headers } from "next/headers";
import { groceryDiagnostics } from "@/lib/telegram/grocery/api";

export const dynamic = "force-dynamic";
export default async function GroceryConnectionPage() {
  const incoming = await headers();
  const host = incoming.get("host");
  const origin = `${process.env.NODE_ENV === "production" ? "https" : "http"}://${host}`;
  let status: Awaited<ReturnType<typeof groceryDiagnostics>> | null = null;
  try {
    status = await groceryDiagnostics(origin);
  } catch {
    /* Display only safe diagnostics. */
  }
  return (
    <main className="mx-auto max-w-2xl space-y-5 p-6">
      <h1 className="text-2xl font-semibold">
        Atlas Grocery · Telegram connection
      </h1>
      <p>
        This first step verifies the separate grocery bot. Shopping lists and
        carts are not processed yet.
      </p>
      {!status ? (
        <p>
          Could not check Telegram. Verify the grocery bot token and try again.
          No settings were changed.
        </p>
      ) : (
        <dl className="space-y-2">
          <div>
            <dt>Bot</dt>
            <dd>
              @{status.bot} —{" "}
              {status.botMatches
                ? "expected bot"
                : "unexpected bot; check credentials"}
            </dd>
          </div>
          <div>
            <dt>Configuration</dt>
            <dd>
              {status.configured
                ? "Complete"
                : "Set grocery webhook secret, group ID and allowed sender IDs"}
            </dd>
          </div>
          <div>
            <dt>Group</dt>
            <dd>
              {status.group
                ? `${status.group.title} (${status.group.id}); bot status: ${status.group.status}`
                : "Not checked until configuration is complete"}
            </dd>
          </div>
          <div>
            <dt>Ordinary group messages</dt>
            <dd>
              {status.canReceiveOrdinaryMessages
                ? "Bot access permits receiving ordinary messages"
                : "Not verified: bot must be an administrator or have privacy mode disabled"}
            </dd>
          </div>
          <div>
            <dt>Webhook</dt>
            <dd>
              {status.webhookMatches
                ? "Points to this deployment's grocery handler"
                : "Not registered to this deployment's grocery handler"}
            </dd>
          </div>
          <div>
            <dt>Pending Telegram updates</dt>
            <dd>{status.pendingUpdates}</dd>
          </div>
          {status.deliveryErrorAt && (
            <p>
              Telegram reports a delivery error. Check deployment access and
              webhook configuration before testing.
            </p>
          )}
        </dl>
      )}
      <form action="/api/telegram/grocery/setup" method="post">
        <p>
          Registering points only the grocery bot at this deployment. Use this
          page on the production domain. Pending updates are retained.
        </p>
        <button
          className="mt-3 rounded bg-ink px-4 py-2 text-white disabled:opacity-50"
          disabled={
            !status?.configured ||
            !status?.botMatches ||
            !status?.canReceiveOrdinaryMessages
          }
        >
          Register grocery webhook
        </button>
      </form>
      <p>
        After registration, an allowed sender can post{" "}
        <code>/grocerytest@Atlas_Grocery_bot</code> in Kohli Kitchen. The bot
        replies once per delivery attempt. Ordinary messages produce a
        metadata-only receipt in Vercel logs.
      </p>
      <p>
        Refresh this page to recheck Telegram. A webhook URL match alone does
        not prove message delivery.
      </p>
    </main>
  );
}
