import "server-only";

/**
 * v3.4.12 — the two Microsoft Graph calls this proof of concept needs:
 * who the connected mailbox belongs to (for display), and a handful of
 * her Inbox messages (the actual "prove Atlas can read her email"
 * test). Deliberately narrow: one folder (Inbox), `$select` limited to
 * exactly what the UI shows, no attachments, no full-mailbox scan, a
 * fixed small `$top`.
 */

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function graphGet<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Microsoft Graph request failed (${response.status}): ${body.slice(0, 300)}`,
    );
  }

  return response.json() as Promise<T>;
}

interface GraphProfileResponse {
  mail: string | null;
  userPrincipalName: string;
}

/** The connected mailbox's own address, for display ("Connected — ahaana.kohli@cns.ac.in"). Falls back to userPrincipalName when `mail` is null — some school tenants leave that attribute unset on the directory object. */
export async function fetchUserProfile(accessToken: string): Promise<string> {
  const profile = await graphGet<GraphProfileResponse>(
    accessToken,
    "/me?$select=mail,userPrincipalName",
  );
  return profile.mail ?? profile.userPrincipalName;
}

export interface GraphMessage {
  id: string;
  subject: string | null;
  from: {
    emailAddress: { name: string | null; address: string | null };
  } | null;
  receivedDateTime: string;
  isRead: boolean;
  bodyPreview: string;
}

interface GraphMessagesResponse {
  value: GraphMessage[];
}

/** The `top` most recent Inbox messages, newest first — this is the actual "can Atlas read her email" proof. `$select` deliberately excludes body/attachments entirely (bodyPreview is a short plain-text snippet Graph always includes, not the full body). */
export async function fetchInboxMessages(
  accessToken: string,
  top: number,
): Promise<GraphMessage[]> {
  const query = new URLSearchParams({
    $top: String(top),
    $select: "id,subject,from,receivedDateTime,isRead,bodyPreview",
    $orderby: "receivedDateTime desc",
  });
  const result = await graphGet<GraphMessagesResponse>(
    accessToken,
    `/me/mailFolders/inbox/messages?${query.toString()}`,
  );
  return result.value;
}
