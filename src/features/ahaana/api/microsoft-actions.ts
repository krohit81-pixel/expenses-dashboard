"use server";

import {
  getValidAccessToken,
  MicrosoftConnectionExpiredError,
} from "@/services/MicrosoftEmailConnectionService";
import { fetchInboxMessages } from "@/lib/microsoft/graph";

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
 * v3.4.12 — the "Test Mailbox Connection" button's action: mints a
 * fresh access token from the stored (encrypted) refresh token, calls
 * Microsoft Graph for the latest Inbox messages, and maps the response
 * down to exactly what the UI shows. Same thin try/catch-wrapper shape
 * as every other action in this app (e.g.
 * push-actions.ts's saveAhaanaPushSubscriptionAction) — the real logic
 * lives in the service/graph-client layer, this just adapts it to a
 * server action's {success, error?} return shape.
 */
export async function testMailboxConnectionAction(): Promise<TestMailboxConnectionResult> {
  try {
    const accessToken = await getValidAccessToken();
    const messages = await fetchInboxMessages(accessToken, MESSAGE_COUNT);

    return {
      success: true,
      messages: messages.map((message) => ({
        sender:
          message.from?.emailAddress.name ??
          message.from?.emailAddress.address ??
          "(unknown sender)",
        subject: message.subject ?? "(no subject)",
        receivedDateTime: message.receivedDateTime,
        bodyPreview: message.bodyPreview,
      })),
    };
  } catch (error) {
    if (error instanceof MicrosoftConnectionExpiredError) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }
}
