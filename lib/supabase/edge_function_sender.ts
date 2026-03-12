// Supabase Edge Function: push-notifications-sender (SECRET DEBUGGER)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { JWT } from 'npm:google-auth-library@9';

Deno.serve(async (req) => {
  try {
    // 1. LOG ALL VISIBLE SECRET NAMES (NOT VALUES)
    const envVars = Object.keys(Deno.env.toObject());
    console.log('Available Secrets in this Environment:', envVars.sort().join(', '));

    const payload = await req.json();
    const record = payload.record;

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID');
    const SERVICE_ACCOUNT_JSON = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');

    // 2. SPECIFIC CHECKS
    if (!SERVICE_ACCOUNT_JSON) {
      const msg = `Missing FIREBASE_SERVICE_ACCOUNT. Available keys: ${envVars.join(', ')}`;
      console.error(msg);
      throw new Error(msg);
    }
    
    if (!FIREBASE_PROJECT_ID) {
      throw new Error('Missing FIREBASE_PROJECT_ID');
    }

    const serviceAccount = JSON.parse(SERVICE_ACCOUNT_JSON);
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Generate Token
    const client = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });

    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;

    // Fetch Tokens
    let query = supabase.from('push_tokens').select('token');
    if (record.user_id) query = query.eq('user_id', record.user_id);
    const { data: tokenRows } = await query;

    if (!tokenRows || tokenRows.length === 0) return new Response('No tokens');
    const tokens = tokenRows.map(r => r.token);

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

    return new Response(JSON.stringify({ sent: results.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('ERROR:', msg);
    return new Response(msg, { status: 500 });
  }
});
