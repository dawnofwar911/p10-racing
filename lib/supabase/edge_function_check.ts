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

Deno.serve(async () => {
  const now = new Date();
  const season = now.getFullYear();

  try {
    // 1. Fetch Calendar to find current/next race
    const calResponse = await fetch(`${BASE_URL}/${season}.json`);
    const calData = await calResponse.json();
    const races = calData.MRData.RaceTable.Races;

    if (!races || races.length === 0) return new Response('No races found');

    // Find the first race that hasn't happened yet or happened recently
    const upcomingRace = races.find((r: { date: string }) => new Date(r.date) >= now) || races[races.length - 1];
    const round = upcomingRace.round;

    console.log(`Checking results for Season ${season}, Round ${round} (${upcomingRace.raceName})`);

    // 2. Check for Qualifying Results
    const qualiResponse = await fetch(`${BASE_URL}/${season}/${round}/qualifying.json`);
    const qualiData = await qualiResponse.json();
    const hasQuali = qualiData.MRData.RaceTable.Races[0]?.QualifyingResults?.length > 0;

    if (hasQuali) {
      const notificationId = `${season}_${round}_quali`;
      const { data: wasMarked } = await supabase.rpc('check_and_mark_notification_sent', { p_id: notificationId });

      if (wasMarked) {
        console.log('Qualifying results found! Sending broadcast...');
        await supabase.rpc('send_broadcast_notification', {
          p_title: 'Qualifying Results Are In!',
          p_body: `The grid for the ${upcomingRace.raceName} is ready. Make your P10 picks now!`,
          p_type: 'quali',
          p_url: '/predict'
        });
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
        
        retirements.sort((a: RaceResultItem, b: RaceResultItem) => parseInt(a.laps) - parseInt(b.laps));
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

    return new Response('Check completed');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('Error in checker:', errorMessage);
    return new Response('Error', { status: 500 });
  }
});
