// Supabase Edge Function: push-notifications-sender
// Automatically generates OAuth2 tokens using a Firebase Service Account.
// Location: lib/supabase/edge_function_sender.ts (Reference)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { JWT } from 'https://esm.sh/google-auth-library@9';

interface NotificationRecord {
  id: string;
  user_id: string | null;
  title: string;
  body: string;
  type: string;
  data: Record<string, unknown>;
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record: NotificationRecord = payload.record;

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID')!;
    const SERVICE_ACCOUNT_JSON = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!;

    const serviceAccount = JSON.parse(SERVICE_ACCOUNT_JSON);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Generate a fresh Google OAuth2 Token
    const client = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });

    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;

    if (!accessToken) throw new Error('Failed to generate Google Access Token');

    // 2. Fetch target tokens
    let query = supabase.from('push_tokens').select('token');
    if (record.user_id) query = query.eq('user_id', record.user_id);
    const { data: tokenRows } = await query;

    if (!tokenRows || tokenRows.length === 0) return new Response('No tokens');
    const tokens = tokenRows.map(r => r.token);

    // 3. Send to FCM v1 API
    const results = await Promise.all(tokens.map(async (token) => {
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: {
              token: token,
              notification: { title: record.title, body: record.body },
              data: { ...record.data, type: record.type, notification_id: record.id },
              android: {
                priority: 'high',
                notification: { channel_id: 'default', color: '#e10600' }
              }
            },
          }),
        }
      );
      return response.status;
    }));

    return new Response(JSON.stringify({ sent: results.length, statuses: results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Push Error:', msg);
    return new Response(msg, { status: 500 });
  }
});
