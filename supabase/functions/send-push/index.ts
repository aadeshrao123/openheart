import { errorResponse, jsonResponse, readJsonObject, serveJson } from '../_shared/http.ts';
import { hasSecret } from '../_shared/secret.ts';
import { pushText, type PushKind } from '../_shared/push-strings.ts';
import { createAdminClient, type AdminClient } from '../_shared/supabase-admin.ts';

// Expo's documented endpoint and its documented ceiling: "an array of up to 100
// message objects" per request.
const EXPO_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

type Ticket = {
  status?: string;
  message?: string;
  details?: { error?: string };
};

serveJson(async (request) => {
  if (request.method !== 'POST') {
    return errorResponse('method_not_allowed', 405);
  }

  // No user JWT. The only caller is the trigger in 0029, running inside
  // Postgres, and a client that could ask the server to notify somebody could
  // ask it to notify anybody.
  if (!hasSecret(request, 'X-Push-Secret', 'PUSH_SECRET')) {
    return errorResponse('unauthorized', 401);
  }

  const body = await readJsonObject(request);
  const recipient = body?.recipient;
  const kind = body?.kind;
  const matchId = body?.match_id;
  const givenTitle = body?.title;
  const givenBody = body?.body;

  if (typeof recipient !== 'string') {
    return errorResponse('invalid_request', 400);
  }

  // An announcement is the one kind that carries its own words and belongs to
  // no conversation. A match or a message is the opposite: it names a
  // conversation and says nothing about it.
  const announcement = kind === 'announcement';

  if (announcement) {
    if (typeof givenTitle !== 'string' || typeof givenBody !== 'string') {
      return errorResponse('invalid_request', 400);
    }
  } else if (typeof matchId !== 'string' || (kind !== 'match' && kind !== 'message')) {
    return errorResponse('invalid_request', 400);
  }

  const admin = createAdminClient();

  const { data: tokens, error } = await admin
    .from('push_tokens')
    .select('token, locale')
    .eq('profile_id', recipient);

  if (error) {
    throw error;
  }

  // Nobody has the app installed, or nobody granted the permission. Not a
  // failure, and the trigger is not waiting for an answer either way.
  if (!tokens || tokens.length === 0) {
    return jsonResponse({ sent: 0 }, 200);
  }

  const messages = tokens.map((row) => {
    const text = announcement
      ? { title: givenTitle as string, body: givenBody as string }
      : pushText(row.locale, kind as PushKind);

    return {
      to: row.token,
      title: text.title,
      body: text.body,
      // What the tap needs to open the right screen, and nothing more. No
      // message text: see the note in 0019 and the one in push-strings.ts.
      // An announcement has no conversation to open, so the tap just opens the
      // app, which is what the client does when match_id is absent.
      data: { kind, match_id: matchId },
      sound: 'default',
      // Created by the client on Android. Without it a notification arrives
      // silently on Android 8 and above.
      channelId: 'default',
      priority: 'high',
      // The second line of defence behind the trigger in 0030. That stops most
      // repeats being sent at all; these stop any that are from stacking.
      //
      // Keyed on the conversation, so a second notification about the same one
      // replaces the first rather than sitting under it. Three fields because
      // the platforms do it differently: tag replaces what is already on screen
      // on Android, collapseId coalesces in transit and replaces on iOS, and
      // threadId is what groups them in iOS notification centre.
      tag: matchId,
      collapseId: matchId,
      threadId: matchId,
    };
  });

  let sent = 0;
  const dead: string[] = [];
  const failures: string[] = [];

  for (let start = 0; start < messages.length; start += BATCH_SIZE) {
    const batch = messages.slice(start, start + BATCH_SIZE);
    let tickets: Ticket[];

    try {
      tickets = await deliver(batch);
    } catch (sendError) {
      // Logged rather than thrown. pg_net does not read the response and the
      // write that prompted this has already committed, so failing loudly here
      // achieves nothing a log does not.
      console.error('expo push failed', sendError);
      failures.push(sendError instanceof Error ? sendError.message : 'send failed');
      continue;
    }

    tickets.forEach((ticket, index) => {
      if (ticket.status === 'ok') {
        sent += 1;
        return;
      }

      // Every other outcome used to be counted as nothing and dropped, which
      // made "Expo refused this" and "there was nobody to send to" the same
      // answer: sent 0. They need entirely different fixes, and the difference
      // is in the ticket rather than anywhere else in the system.
      const reason = ticket.details?.error ?? ticket.message ?? 'unknown';

      console.error('expo rejected a notification', reason, ticket.message ?? '');
      failures.push(reason);

      // Expo: "stop sending messages to the corresponding Expo push token".
      // The app was uninstalled, so the row is now noise that costs a request
      // on every future notification.
      if (ticket.details?.error === 'DeviceNotRegistered') {
        dead.push(batch[index].to);
      }
    });
  }

  await forget(admin, dead);

  // tokens rather than a bare count, so "nobody had a device" is visibly
  // different from "every device refused it".
  return jsonResponse(
    { sent, removed: dead.length, tokens: messages.length, errors: [...new Set(failures)] },
    200,
  );
});

async function deliver(batch: unknown[]): Promise<Ticket[]> {
  const response = await fetch(EXPO_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
    body: JSON.stringify(batch),
  });

  if (!response.ok) {
    throw new Error(`Expo push returned ${response.status}`);
  }

  const payload = (await response.json()) as { data?: unknown };

  // One ticket per message, in order. Anything else and the index mapping
  // below would delete the wrong token.
  if (!Array.isArray(payload.data) || payload.data.length !== batch.length) {
    throw new Error('Expo push returned an unexpected ticket count');
  }

  return payload.data as Ticket[];
}

async function forget(admin: AdminClient, tokens: string[]): Promise<void> {
  if (tokens.length === 0) {
    return;
  }

  const { error } = await admin.from('push_tokens').delete().in('token', tokens);

  if (error) {
    console.error('could not remove dead tokens', error);
  }
}
