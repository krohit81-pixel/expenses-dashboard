import "server-only";

import { ImapFlow } from "imapflow";

import { serverEnv } from "@/lib/env/server";

/**
 * v3.4.12 — deliberately the simplest possible mailbox connection: two
 * env vars (a school email address + its password), IMAP against
 * Outlook's own server, nothing else. No OAuth, no consent screen, no
 * stored token, no encryption-at-rest, no database table — this
 * replaces an earlier, more elaborate Microsoft Graph OAuth version of
 * this same proof of concept, at the household's own explicit request
 * ("don't need such complicated architecture").
 *
 * Real caveat, not swept under the rug: Microsoft retired plain
 * username+password (Basic Auth) access to Exchange Online across
 * every protocol — IMAP included — back in October 2022, for most
 * tenants. Whether this actually works at all depends entirely on
 * whether Ahaana's SCHOOL tenant is one of the shrinking minority that
 * still permits it (or has an admin-configured Authentication Policy
 * exception) — that's genuinely unknown until it's tried, and there is
 * no code-side fix if it's disabled; the school's own IT would need to
 * re-enable IMAP Basic Auth, which is unlikely for a personal project.
 */

const IMAP_HOST = "outlook.office365.com";
const IMAP_PORT = 993;

export function isConfigured(): boolean {
  return Boolean(
    serverEnv.AHAANA_SCHOOL_EMAIL && serverEnv.AHAANA_SCHOOL_EMAIL_PASSWORD,
  );
}

export interface MailboxMessage {
  sender: string;
  subject: string;
  receivedDate: string;
  bodyPreview: string;
}

const BODY_PREVIEW_LENGTH = 200;

/** A blunt, non-recursive, bounded tag-stripper for the rare case the first body part is HTML with no plain-text alternative — deliberately not a real HTML-to-text conversion (this codebase avoided pulling in `mailparser` specifically to sidestep a real stack-exhaustion advisory in one of ITS OWN transitive dependencies, `html-to-text`/`deepmerge-ts` — GHSA-ggr8-5vv4-36mx — since a preview snippet doesn't need real HTML rendering). */
function stripHtmlForPreview(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The latest `count` Inbox messages, newest first. Uses `imapflow`'s
 * own `download()` (part `"1"`) to get the first body part already
 * decoded (transfer-encoding handled for us) — no MIME-parsing
 * dependency needed for a short preview. Falls back to an empty
 * preview if a message has no readable first part rather than failing
 * the whole batch over one odd message.
 */
export async function fetchLatestInboxMessages(
  count: number,
): Promise<MailboxMessage[]> {
  if (!isConfigured()) {
    throw new Error(
      "School email isn't configured yet — set AHAANA_SCHOOL_EMAIL and AHAANA_SCHOOL_EMAIL_PASSWORD.",
    );
  }

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: {
      user: serverEnv.AHAANA_SCHOOL_EMAIL as string,
      pass: serverEnv.AHAANA_SCHOOL_EMAIL_PASSWORD as string,
    },
    logger: false,
  });

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const total =
        typeof client.mailbox === "object" && client.mailbox
          ? client.mailbox.exists
          : 0;
      if (total === 0) return [];

      const start = Math.max(1, total - count + 1);
      const messages: MailboxMessage[] = [];

      for await (const message of client.fetch(`${start}:${total}`, {
        envelope: true,
      })) {
        const from = message.envelope?.from?.[0];
        const sender = from
          ? (from.name ?? from.address ?? "(unknown sender)")
          : "(unknown sender)";

        let bodyPreview = "";
        try {
          const download = await client.download(message.seq.toString(), "1", {
            maxBytes: 4096,
          });
          const chunks: Buffer[] = [];
          for await (const chunk of download.content) {
            chunks.push(chunk as Buffer);
          }
          const raw = Buffer.concat(chunks).toString("utf8");
          bodyPreview = download.meta.contentType?.includes("html")
            ? stripHtmlForPreview(raw)
            : raw.trim();
        } catch {
          // Some messages (calendar invites, odd structures) don't have
          // a readable "part 1" — an empty preview is fine, not worth
          // failing the whole fetch over one message.
        }

        messages.push({
          sender,
          subject: message.envelope?.subject ?? "(no subject)",
          receivedDate: (message.envelope?.date ?? new Date()).toISOString(),
          bodyPreview: bodyPreview.slice(0, BODY_PREVIEW_LENGTH),
        });
      }

      messages.reverse(); // newest first
      return messages;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}
