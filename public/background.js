// background.js - Capacitor Background Runner script
// This runs in a isolated JavaScript environment on the native side.
// It can't access window, localStorage, or full Supabase SDK.
// It uses fetch and Preferences.

addEventListener('syncTask', async (event) => {
  console.log('Background Sync Task Triggered');

  try {
    // 1. Get Session from Preferences (needs to be mirrored to Preferences for Background use)
    const { value: sessionStr } = await Capacitor.Plugins.Preferences.get({ key: 'p10_bg_session' });
    if (!sessionStr) {
      console.log('BG Sync: No session found.');
      return;
    }
    const session = JSON.parse(sessionStr);

    // 2. Get Pending Prediction
    const pendingKey = `pending_pred_${session.user.id}`;
    const { value: pendingData } = await Capacitor.Plugins.Preferences.get({ key: pendingKey });

    if (pendingData) {
      const pending = JSON.parse(pendingData);
      
      // 3. Manual Fetch to Supabase (SDK doesn't work in background runner env usually)
      const SUPABASE_URL = session.supabase_url; // We'll need to store this
      const SUPABASE_KEY = session.supabase_key;

      const response = await fetch(`${SUPABASE_URL}/rest/v1/predictions`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          user_id: session.user.id,
          race_id: pending.race_id,
          p10_driver_id: pending.p10_driver_id,
          dnf_driver_id: pending.dnf_driver_id,
          updated_at: new Date().toISOString()
        })
      });

      if (response.ok) {
        console.log('BG Sync: Prediction uploaded successfully.');
        await Capacitor.Plugins.Preferences.remove({ key: pendingKey });
      } else {
        const errText = await response.text();
        console.error('BG Sync: Upload failed', errText);
      }
    }
  } catch (err) {
    console.error('BG Sync: Error in sync task', err);
  }
});
