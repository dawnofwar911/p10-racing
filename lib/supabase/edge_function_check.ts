// Supabase Edge Function: check-f1-results
// This script is intended to be deployed to Supabase Edge Functions.

import { createClient } from 'npm:@supabase/supabase-js@2';

const BASE_URL = 'https://api.jolpi.ca/ergast/f1';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface RaceResultItem {
  status: string;
  laps: string;
  position: string;
  Driver: {
    driverId: string;
  };
}

Deno.serve(async (req) => {
  // 1. CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // System task, but good practice
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 2. Security: Verify Secret (prevent manual/external trigger)
  const authHeader = req.headers.get('Authorization');
  const customCronHeader = req.headers.get('X-Cron-Secret');
  const CRON_SECRET = Deno.env.get('CRON_SECRET');
  
  if (CRON_SECRET) {
    const expectedBearer = `Bearer ${CRON_SECRET}`;
    const isAuthorized = 
      authHeader === expectedBearer || 
      authHeader === CRON_SECRET || 
      customCronHeader === CRON_SECRET;

    if (!isAuthorized) {
      console.warn('Unauthorized trigger attempt rejected');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }
  }

  const now = new Date();
  const season = now.getFullYear();

  try {
    // 1. Fetch Calendar to find current/next race
    const calResponse = await fetch(`${BASE_URL}/${season}.json`);
    const calData = await calResponse.json();
    const races = calData.MRData.RaceTable.Races;

    if (!races || races.length === 0) return new Response('No races found');

    // Find the latest finished race that doesn't have results yet
    let roundToProcess = null;
    let raceToProcess = null;

    // Check races in reverse to find the most recent one that *should* have results
    for (let i = races.length - 1; i >= 0; i--) {
      const r = races[i];
      const raceTime = new Date(`${r.date}T${r.time || '00:00:00Z'}`);
      
      // If the race started more than 2 hours ago, it's a candidate for results check
      if (now.getTime() > raceTime.getTime() + (2 * 60 * 60 * 1000)) {
        const { data: verified } = await supabase
          .from('verified_results')
          .select('id')
          .eq('id', `${season}_${r.round}`)
          .maybeSingle();
        
        if (!verified) {
          roundToProcess = r.round;
          raceToProcess = r;
          // We found the most recent finished race without results. 
          // Stop here to process it.
          break;
        }
      }
    }

    // If we didn't find any finished race needing results, 
    // default to the "active" race for qualifying checks etc.
    let activeIndex = races.findIndex((r: { date: string, time?: string }) => {
      const raceTime = new Date(`${r.date}T${r.time || '00:00:00Z'}`);
      const fourHoursLater = new Date(raceTime.getTime() + 4 * 60 * 60 * 1000);
      return fourHoursLater > now;
    });

    if (activeIndex === -1) activeIndex = races.length - 1;

    const round = roundToProcess || races[activeIndex].round;
    const upcomingRace = raceToProcess || races[activeIndex];

    // --- NEW: Calculate Recency for Notifications ---
    const raceTime = new Date(`${upcomingRace.date}T${upcomingRace.time || '00:00:00Z'}`);
    const fortyEightHoursAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));
    const isRecent = raceTime > fortyEightHoursAgo;

    // Check if race starts in the next 2 hours for reminders
    const twoHoursFromNow = new Date(now.getTime() + (2 * 60 * 60 * 1000));
    const raceStartsSoon = raceTime > now && raceTime < twoHoursFromNow;
    // --- END RECENCY ---

    // --- NEW: Sync Calendar ---
    // Every time we check, let's sync the next few races to the DB to ensure locking works
    const racesToSync = races.slice(activeIndex, activeIndex + 3);
    for (const r of (racesToSync.length > 0 ? racesToSync : [races[races.length - 1]])) {
      const raceId = `${season}_${r.round}`;
      const raceStartTime = `${r.date}T${r.time || '00:00:00Z'}`;

      await supabase.from('races').upsert({
        id: raceId,
        start_time: raceStartTime,
        race_name: r.raceName
      }, { onConflict: 'id' });
    }
    // --- END SYNC ---

    console.log(`Checking results for Season ${season}, Round ${round} (${upcomingRace.raceName})`);

    // --- NEW: Prediction Reminders ---
    if (raceStartsSoon) {
      console.log(`Race ${upcomingRace.raceName} starts soon. Checking for missing predictions...`);
      const raceId = `${season}_${round}`;

      // 1. Get all users who have registered push tokens
      const { data: usersWithTokens } = await supabase
        .from('push_tokens')
        .select('user_id');

      if (usersWithTokens && usersWithTokens.length > 0) {
        // Unique user IDs
        const userIds = [...new Set(usersWithTokens.map(u => u.user_id))];

        // 2. Bulk fetch predictions for this race to avoid N+1 query timeout
        const { data: existingPredictions } = await supabase
          .from('predictions')
          .select('user_id')
          .eq('race_id', raceId);

        const predictedUserIds = new Set(existingPredictions?.map(p => p.user_id) || []);
        const usersNeedingReminder = userIds.filter(uid => !predictedUserIds.has(uid));

        for (const uid of usersNeedingReminder) {
          // 3. Try to mark reminder as sent (atomically via ON CONFLICT)
          const { data: wasMarked } = await supabase.rpc('mark_reminder_sent', { 
            p_race_id: raceId, 
            p_user_id: uid 
          });

          if (wasMarked) {
            console.log(`Sending prediction reminder to user ${uid}`);
            await supabase.from('notifications').insert({
              user_id: uid,
              title: 'Don\'t Forget Your Picks! 🏎️',
              body: `The ${upcomingRace.raceName} starts in less than 2 hours. Get your P10 and DNF picks in now!`,
              type: 'reminder',
              data: { url: '/predict' }
            });
          }
        }

      }
    }
    // --- END REMINDERS ---

    // 2. Check for Qualifying Results

    const qualiResponse = await fetch(`${BASE_URL}/${season}/${round}/qualifying.json`);
    const qualiData = await qualiResponse.json();
    const hasQuali = qualiData.MRData.RaceTable.Races[0]?.QualifyingResults?.length > 0;

    if (hasQuali) {
      const notificationId = `${season}_${round}_quali`;
      const { data: wasMarked } = await supabase.rpc('check_and_mark_notification_sent', { p_id: notificationId });

      if (wasMarked) {
        if (isRecent) {
          console.log('Qualifying results found! Sending broadcast...');
          await supabase.rpc('send_broadcast_notification', {
            p_title: 'Qualifying Results Are In!',
            p_body: `The grid for the ${upcomingRace.raceName} is ready. Make your P10 picks now!`,
            p_type: 'quali',
            p_url: '/predict'
          });
        } else {
          console.log(`Silencing old qualifying notification for ${upcomingRace.raceName}`);
        }
      }
    }

    // 3. Check for Race Results
    const raceResponse = await fetch(`${BASE_URL}/${season}/${round}/results.json`);
    const raceData = await raceResponse.json();
    const raceResult = raceData.MRData.RaceTable.Races[0];
    const hasResults = raceResult?.Results?.length > 0;

    if (hasResults) {
      const resultsId = `${season}_${round}`;
      
      // Check if we already have verified results in DB
      const { data: existingResults } = await supabase
        .from('verified_results')
        .select('id')
        .eq('id', resultsId)
        .single();

      if (!existingResults) {
        console.log(`Race results found for Round ${round} (${upcomingRace.raceName})! Automating publication...`);
        
        // Find first DNF
        const retirements = raceResult.Results.filter((r: RaceResultItem) => {
          const s = r.status.toLowerCase();
          const isFinished = s === "finished";
          const isLapped = s.includes("lap"); 
          const isDns = s.includes("not start") || s === "dns" || s.includes("qualify") || s.includes("withdrawn");
          const hasLaps = parseInt(r.laps) > 0;
          return !isFinished && !isLapped && !isDns && hasLaps;
        });
        
        retirements.sort((a: RaceResultItem, b: RaceResultItem) => {
          const lapsA = parseInt(a.laps);
          const lapsB = parseInt(b.laps);
          if (lapsA !== lapsB) return lapsA - lapsB;
          // Tie-breaker: higher position (numeric string) usually means earlier DNF in Ergast
          return parseInt(b.position) - parseInt(a.position);
        });
        const firstDnf = retirements[0]?.Driver.driverId || '';

        const positions: { [driverId: string]: number } = {};
        raceResult.Results.forEach((r: RaceResultItem) => {
          positions[r.Driver.driverId] = parseInt(r.position);
        });

        // Publish results (this will trigger the Race Results notification via DB trigger)
        await supabase.from('verified_results').upsert({
          id: resultsId,
          data: { positions, firstDnf },
          updated_at: new Date().toISOString()
        });
      }
    }

    return new Response('Check completed', { headers: corsHeaders });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('Error in checker:', errorMessage);
    return new Response('Error', { status: 500, headers: corsHeaders });
  }
});
