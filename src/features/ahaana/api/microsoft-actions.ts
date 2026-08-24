"use server";

import { fetchLatestInboxMessages } from "@/lib/microsoft/imap-client";

const MESSAGE_COUNT = 10;

export interface MailboxTestMessage {
  sender: string;
  subject: string;
  receivedDateTime: string;
  bodyPreview: string;
}

export interface TestMailboxConnectionResult {
  success: boolean;
  error?: string;
  messages?: MailboxTestMessage[];
}

/**
 * v3.4.12 — the "Test Mailbox Connection" button's action: connects
 * over IMAP with the two configured env vars and returns the latest
 * Inbox messages. Same thin try/catch-wrapper shape as every other
 * action in this app (e.g. push-actions.ts's own
 * saveAhaanaPushSubscriptionAction) — the real logic lives in
 * imap-client.ts, this just adapts it to a server action's
 * {success, error?} return shape.
 */
export async function testMailboxConnectionAction(): Promise<TestMailboxConnectionResult> {
  try {
    const messages = await fetchLatestInboxMessages(MESSAGE_COUNT);
    return {
      success: true,
      messages: messages.map((message) => ({
        sender: message.sender,
        subject: message.subject,
        receivedDateTime: message.receivedDate,
        bodyPreview: message.bodyPreview,
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }
}
