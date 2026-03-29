// Supabase Edge Function: f1-live-proxy
// Emergency Version: Robust 2026 Path Discovery
// Fetches live timing data from official F1 static JSON feeds

const BASE_URL = 'https://livetiming.formula1.com/static';

// Mapping from F1 Acronyms to internal Driver IDs (2026 Lineup)
const ACRONYM_TO_ID: { [key: string]: string } = {
  'VER': 'max_verstappen', 'HAD': 'hadjar',
  'HAM': 'hamilton', 'LEC': 'leclerc',
  'NOR': 'norris', 'PIA': 'piastri',
  'RUS': 'russell', 'ANT': 'antonelli',
  'ALO': 'alonso', 'STR': 'stroll',
  'GAS': 'gasly', 'COL': 'colapinto',
  'ALB': 'albon', 'SAI': 'sainz',
  'LAW': 'lawson', 'LIN': 'arvid_lindblad',
  'HUL': 'hulkenberg', 'BOR': 'bortoleto',
  'OCO': 'ocon', 'BEA': 'bearman',
  'PER': 'perez', 'BOT': 'bottas'
};

interface F1Session {
  Key: number;
  Type: string;
  Name: string;
  StartDate: string;
  EndDate: string;
  Path?: string;
}

interface F1Meeting {
  Key: number;
  Name: string;
  Sessions: F1Session[];
}

interface F1Index {
  Meetings?: F1Meeting[];
}

interface TimingData {
  Lines: {
    [driverNumber: string]: {
      Position: string;
      GapToLeader: string;
      IntervalToNext: string;
      Stopped: boolean;
      InPit: boolean;
      Retired: boolean;
    }
  };
}

interface SessionInfo {
  Meeting: { Name: string };
  Session: { Name: string };
  Type: string;
  Status: string;
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const forceSeason = url.searchParams.get('season');
    const forceSession = url.searchParams.get('session');

    const season = forceSeason || new Date().getFullYear().toString();
    let sessionPath = '';

    // 1. Discover Active Path for 2026
    const resp = await fetch(`${BASE_URL}/${season}/Index.json`);
    if (!resp.ok) throw new Error(`Failed to fetch ${season} index: ${resp.status}`);
    const data: F1Index = await resp.json();

    if (!data.Meetings || data.Meetings.length === 0) {
      throw new Error(`No meetings found for season ${season}`);
    }

    // Find the current or most recent meeting
    const now = new Date();
    // Sort meetings by session dates to find the current one
    const sortedMeetings = data.Meetings.sort((a, b) => {
      const aStart = new Date(a.Sessions?.[0]?.StartDate || 0);
      const bStart = new Date(b.Sessions?.[0]?.StartDate || 0);
      return bStart.getTime() - aStart.getTime(); // Descending (latest first)
    });

    // Strategy: Find meeting that has a session starting today/yesterday or is closest to now
    const currentMeeting = sortedMeetings.find(m => {
      return m.Sessions?.some((s: F1Session) => {
        const start = new Date(s.StartDate);
        const diffDays = Math.abs(now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays < 4; // Within 4 days of any session
      });
    }) || sortedMeetings[0];

    // Find the 'Race' session in this meeting
    const sessions = currentMeeting.Sessions || [];
    const raceSession = sessions.find((s: F1Session) => s.Type === 'Race' || s.Name === 'Race');
    const targetSession = forceSession ? sessions.find((s: F1Session) => s.Name === forceSession) : (raceSession || sessions[sessions.length - 1]);

    if (!targetSession) {
      throw new Error("Target session not found");
    }

    if (targetSession.Path) {
      sessionPath = targetSession.Path;
    } else {
      // INFER PATH: Use another session's path to find the meeting root
      const sessionWithPadding = sessions.find((s: F1Session) => s.Path);
      if (sessionWithPadding && sessionWithPadding.Path) {
        // Example path: 2026/2026-03-29_Japanese_Grand_Prix/2026-03-27_Practice_1/
        const parts = sessionWithPadding.Path.split('/');
        const meetingRoot = parts.slice(0, 2).join('/'); // 2026/2026-03-29_Japanese_Grand_Prix
        
        // Expected session folder name format: YYYY-MM-DD_Name
        const sessionDate = targetSession.StartDate.split('T')[0];
        sessionPath = `${meetingRoot}/${sessionDate}_${targetSession.Name.replace(/ /g, '_')}/`;
      }
    }

    if (!sessionPath) {
      throw new Error("Could not discover session path");
    }

    const fullPath = `${BASE_URL}/${sessionPath}`;
    console.log(`Fetching from: ${fullPath}`);

    // 2. Fetch Data
    const [timingResp, sessionResp, driverListResp] = await Promise.all([
      fetch(`${fullPath}TimingData.json`),
      fetch(`${fullPath}SessionInfo.json`),
      fetch(`${fullPath}DriverList.json`)
    ]);

    // Handle 403/404 specifically for better error messages
    if (timingResp.status === 403 || timingResp.status === 404) {
      return new Response(JSON.stringify({ error: "Waiting for track data..." }), {
        status: timingResp.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!timingResp.ok) throw new Error(`Timing fetch failed: ${timingResp.status}`);
    
    const [timingData, sessionInfo, driverListData] = await Promise.all([
      timingResp.json() as Promise<TimingData>,
      sessionResp.json() as Promise<SessionInfo>,
      driverListResp.json()
    ]);

    // 3. Map and Simplify Results
    const results = Object.entries(timingData.Lines).map(([number, data]) => {
      const driver = driverListData[number];
      const acronym = driver?.Tla || '';
      return {
        driverId: ACRONYM_TO_ID[acronym] || acronym.toLowerCase(),
        acronym,
        position: parseInt(data.Position) || 0,
        gap: data.GapToLeader || '',
        interval: data.IntervalToNext || '',
        isRetired: data.Retired || data.Stopped || false,
        inPit: data.InPit || false,
        number
      };
    }).sort((a, b) => (a.position || 99) - (b.position || 99));

    const simplified = {
      status: sessionInfo.Status,
      meeting: sessionInfo.Meeting.Name,
      session: sessionInfo.Session.Name,
      results: results,
      lastUpdated: new Date().toISOString()
    };

    return new Response(JSON.stringify(simplified), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
