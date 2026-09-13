// Supabase Edge Function: check-f1-results
// This script is intended to be deployed to Supabase Edge Functions.

import { createClient } from 'npm:@supabase/supabase-js@2';

const BASE_URL = 'https://api.jolpi.ca/ergast/f1';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

interface RaceResultItem {
  status: string;
  laps: string;
  position: string;
  Driver: {
    driverId: string;
  };
}

/**
 * Shared utility to determine if a status string indicates a true DNF (Retired during race).
 * Excludes DNS (Did not start) and other non-participation statuses.
 */
function isTrueDnf(status: string, laps: string | number = "1"): boolean {
  const s = String(status || '').toLowerCase();
  const isFinished = s === "finished" || s.includes("lap");
  const isDns = s.includes("not start") || s === "dns" || s.includes("qualify") || s.includes("withdrawn");
  const lapCount = typeof laps === 'string' ? parseInt(laps) : laps;
  const hasLaps = lapCount > 0;
  
  return !isFinished && !isDns && hasLaps;
}

Deno.serve(async (req) => {
  // 1. CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // System task, but good practice
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 2. Security: Verify Secret (prevent manual/external trigger)
  const authHeader = req.headers.get('Authorization');
  const customCronHeader = req.headers.get('X-Cron-Secret');
  const CRON_SECRET = Deno.env.get('CRON_SECRET');

  console.log('Request received. Auth Header present:', !!authHeader, 'Custom Header present:', !!customCronHeader);
  
  if (CRON_SECRET) {
    const expectedBearer = `Bearer ${CRON_SECRET}`;
    const isAuthorized = 
      authHeader === expectedBearer || 
      authHeader === CRON_SECRET || 
      customCronHeader === CRON_SECRET;

    if (!isAuthorized) {
      console.warn('Unauthorized trigger attempt rejected. Secrets do not match.');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }
  }

  const now = new Date();
  const season = now.getFullYear();

  try {
    // 1. Fetch Calendar to find current/next race
    const calResponse = await fetchWithTimeout(`${BASE_URL}/${season}.json`);
    const calData = calResponse.ok ? await calResponse.json() : null;
    const races = calData?.MRData?.RaceTable?.Races;

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

    const qualiResponse = await fetchWithTimeout(`${BASE_URL}/${season}/${round}/qualifying.json`);
    const qualiData = qualiResponse.ok ? await qualiResponse.json() : null;
    const hasQuali = (qualiData?.MRData?.RaceTable?.Races?.[0]?.QualifyingResults?.length || 0) > 0;

    if (hasQuali) {
      const qualiResults = qualiData?.MRData?.RaceTable?.Races?.[0]?.QualifyingResults || [];
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

      // Sync Starting Grid to kv_cache (Check OpenF1 for grid penalties)
      try {
        const raceDate = upcomingRace.date;
        const targetDate = new Date(raceDate);
        const meetingsResp = await fetchWithTimeout(`https://api.openf1.org/v1/meetings?year=${season}`);
        if (meetingsResp.ok) {
          const meetings = await meetingsResp.json();
          const meeting = Array.isArray(meetings) ? meetings.find((m: { date_start: string; date_end: string }) => {
            const start = new Date(m.date_start);
            const end = new Date(m.date_end);
            return targetDate >= new Date(start.getTime() - 86400000) &&
                   targetDate <= new Date(end.getTime() + 86400000);
          }) : null;

          if (meeting) {
            const sessionsResp = await fetchWithTimeout(`https://api.openf1.org/v1/sessions?meeting_key=${meeting.meeting_key}&session_name=Qualifying`);
            if (sessionsResp.ok) {
              const sessions = await sessionsResp.json();
              if (Array.isArray(sessions) && sessions.length > 0) {
                const gridResp = await fetchWithTimeout(`https://api.openf1.org/v1/starting_grid?session_key=${sessions[0].session_key}`);
                if (gridResp.ok) {
                  const openf1Grid = await gridResp.json();
                  if (Array.isArray(openf1Grid) && openf1Grid.length >= 15) {
                    const qualiByCarNumber = new Map();
                    qualiResults.forEach((q: { number?: string; Driver?: { permanentNumber?: string } }) => {
                      if (q.number) qualiByCarNumber.set(String(q.number), q);
                      if (q.Driver?.permanentNumber) qualiByCarNumber.set(String(q.Driver.permanentNumber), q);
                    });

                    // Fetch driver standings for full driver info on non-qualifying starters (e.g. DNS in Q1)
                    const standingsByCarNumber = new Map();
                    try {
                      const standingsResp = await fetchWithTimeout(`${BASE_URL}/${season}/driverStandings.json`);
                      if (standingsResp.ok) {
                        const standingsData = await standingsResp.json();
                        const list = standingsData?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
                        list.forEach((s: any) => {
                          const num = s.Driver?.permanentNumber || s.number;
                          if (num) standingsByCarNumber.set(String(num), s);
                        });
                      }
                    } catch (e) {
                      console.warn('Could not fetch driver standings for grid hydration:', e);
                    }

                    const maxGridSize = season >= 2026 ? 22 : 20;
                    const sortedOpenF1 = [...openf1Grid]
                      .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
                      .slice(0, maxGridSize);

                    const finalStartingGrid = sortedOpenF1.map((entry: { position: number; driver_number: number }) => {
                      const carNum = String(entry.driver_number);
                      const q = qualiByCarNumber.get(carNum);
                      const s = standingsByCarNumber.get(carNum);
                      const qualiPosStr = q?.position;
                      const qualiPosNum = qualiPosStr ? parseInt(qualiPosStr, 10) : null;
                      const penalty = qualiPosNum !== null ? entry.position - qualiPosNum : 0;
                      return {
                        position: entry.position.toString(),
                        number: carNum,
                        grid: entry.position.toString(),
                        points: '0',
                        status: 'Active',
                        laps: '0',
                        qualifyingPosition: qualiPosStr,
                        penalty,
                        Constructor: q?.Constructor || s?.Constructors?.[0] || { constructorId: 'unknown', name: 'Unknown' },
                        Driver: q?.Driver || s?.Driver || {
                          driverId: `driver_${carNum}`,
                          code: carNum,
                          permanentNumber: carNum,
                          givenName: 'Driver',
                          familyName: `#${carNum}`
                        }
                      };
                    });

                    await supabase.from('kv_cache').upsert({
                      key: `starting_grid_${season}_${round}`,
                      value: finalStartingGrid,
                      updated_at: new Date().toISOString()
                    });
                    console.log(`Starting grid successfully cached for Season ${season} Round ${round} with ${finalStartingGrid.length} entries.`);
                  }
                }
              }
            }
          }
        }
      } catch (gridErr) {
        console.warn('Could not sync starting grid from OpenF1:', gridErr);
      }
    }

    // 3. Check for Race Results
    const raceResponse = await fetchWithTimeout(`${BASE_URL}/${season}/${round}/results.json`);
    const raceData = raceResponse.ok ? await raceResponse.json() : null;
    const raceResult = raceData?.MRData?.RaceTable?.Races?.[0];
    const hasResults = (raceResult?.Results?.length || 0) > 0;

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
        
        // Find first DNF using the standardized logic
        const retirements = raceResult.Results.filter((r: RaceResultItem) => isTrueDnf(r.status, r.laps));
        
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
