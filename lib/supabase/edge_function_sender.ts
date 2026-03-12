// Supabase Edge Function: push-notifications-sender (DEBUG VERSION)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { JWT } from 'https://esm.sh/google-auth-library@9';

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    console.log('Incoming Webhook Payload:', JSON.stringify(payload, null, 2));

    const record = payload.record;
    if (!record) throw new Error('No record found in payload. Check your webhook settings.');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID');
    const SERVICE_ACCOUNT_JSON = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');

    if (!SERVICE_ACCOUNT_JSON) throw new Error('Secret "FIREBASE_SERVICE_ACCOUNT" is missing!');
    if (!FIREBASE_PROJECT_ID) throw new Error('Secret "FIREBASE_PROJECT_ID" is missing!');

    const serviceAccount = JSON.parse(SERVICE_ACCOUNT_JSON);
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Generate Token
    console.log('Generating Google Auth Token...');
    const client = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });

    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;
    if (!accessToken) throw new Error('Failed to generate Google Access Token. Check your service account permissions.');

    // Fetch Target Tokens
    console.log(`Searching for tokens for user: ${record.user_id || 'BROADCAST'}`);
    let query = supabase.from('push_tokens').select('token');
    if (record.user_id) query = query.eq('user_id', record.user_id);
    const { data: tokenRows, error: tokenError } = await query;

    if (tokenError) throw tokenError;
    if (!tokenRows || tokenRows.length === 0) {
      console.log('No registered devices found. Skipping send.');
      return new Response('No tokens');
    }

    const tokens = tokenRows.map(r => r.token);
    console.log(`Sending to ${tokens.length} devices...`);

    // Send to FCM
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
              android: { priority: 'high', notification: { channel_id: 'default', color: '#e10600' } }
            },
          }),
        }
      );
      return { status: response.status, ok: response.ok };
    }));

    console.log('Batch results:', JSON.stringify(results));
    return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('CRITICAL ERROR:', msg);
    return new Response(msg, { status: 500 });
  }
});
