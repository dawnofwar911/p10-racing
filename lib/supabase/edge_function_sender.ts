// Supabase Edge Function: push-notifications-sender
// This function should be triggered by a Supabase Database Webhook on the 'notifications' table.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    // This requires a Google OAuth2 token. 
    // In a real deployment, you would use a service account JSON to generate this.
    const FCM_ACCESS_TOKEN = Deno.env.get('FCM_ACCESS_TOKEN')!; 

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch tokens to send to
    let query = supabase.from('push_tokens').select('token');
    
    // If user_id is null, it's a broadcast to everyone
    if (record.user_id) {
      query = query.eq('user_id', record.user_id);
    }

    const { data: tokenRows, error: tokenError } = await query;

    if (tokenError || !tokenRows || tokenRows.length === 0) {
      console.log('No tokens found for notification:', record.id);
      return new Response('No tokens');
    }

    const tokens = tokenRows.map(r => r.token);
    console.log(`Sending "${record.title}" to ${tokens.length} devices...`);

    // 2. Send to Firebase (FCM v1 API)
    const results = await Promise.all(tokens.map(async (token) => {
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${FCM_ACCESS_TOKEN}`,
          },
          body: JSON.stringify({
            message: {
              token: token,
              notification: {
                title: record.title,
                body: record.body,
              },
              data: {
                ...record.data,
                type: record.type,
                notification_id: record.id
              },
              android: {
                priority: 'high',
                notification: {
                  channel_id: 'default',
                  icon: 'ic_stat_name', // Ensure this exists in your Android res/drawable
                  color: '#e10600'
                }
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
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('Error in push-sender:', errorMessage);
    return new Response(errorMessage, { status: 500 });
  }
});
