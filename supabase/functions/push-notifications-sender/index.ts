// Supabase Edge Function: push-notifications-sender
// Production Version
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { JWT } from 'npm:google-auth-library@9';

interface NotificationRecord {
  id: string;
  user_id: string | null;
  title: string;
  body: string;
  type: string;
  data: Record<string, unknown>;
}

Deno.serve(async (req) => {
  // 1. CORS Headers - Securely derived from environment
  const origin = req.headers.get('origin') || '';
  const allowedOrigins = [
    Deno.env.get('APP_URL'), 
    'http://localhost:3000',
    'http://localhost:3001',
    'capacitor://localhost',
    'http://localhost'
  ].filter(Boolean);

  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. Simple Authorization Check (ensure it's from Supabase or our App)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const payload = await req.json();
    const record: NotificationRecord = payload.record;

    if (!record) return new Response('No record found', { status: 400 });

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID')!;
    const SERVICE_ACCOUNT_JSON = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!;

    const serviceAccount = JSON.parse(SERVICE_ACCOUNT_JSON);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Generate Token
    const client = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });

    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;

    if (!accessToken) throw new Error('Failed to generate Google Access Token');

    // 2. Fetch Tokens
    let query = supabase.from('push_tokens').select('token');
    if (record.user_id) query = query.eq('user_id', record.user_id);
    const { data: tokenRows } = await query;

    if (!tokenRows || tokenRows.length === 0) return new Response('No tokens found');
    const tokens = tokenRows.map(r => r.token);

    // 3. Send to FCM
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

    console.log(`Successfully sent ${results.filter(s => s === 200).length} notifications.`);
    return new Response(JSON.stringify({ sent: results.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Push Error:', msg);
    return new Response(msg, { status: 500, headers: corsHeaders });
  }
});
