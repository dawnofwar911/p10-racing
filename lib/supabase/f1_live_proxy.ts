// Supabase Edge Function: f1-live-proxy
// Fetches live timing data from official F1 static JSON feeds

const BASE_URL = 'https://livetiming.formula1.com/static';

// Mapping from F1 Acronyms to internal Driver IDs
const ACRONYM_TO_ID: { [key: string]: string } = {
  'ALB': 'albon', 'ALO': 'alonso', 'ANT': 'antonelli', 'BEA': 'bearman',
  'BOR': 'bortoleto', 'BOT': 'bottas', 'COL': 'colapinto', 'GAS': 'gasly',
  'HAD': 'hadjar', 'HAM': 'hamilton', 'HUL': 'hulkenberg', 'LAW': 'lawson',
  'LEC': 'leclerc', 'LIN': 'arvid_lindblad', 'NOR': 'norris', 'OCO': 'ocon',
  'PIA': 'piastri', 'PER': 'perez', 'RUS': 'russell', 'SAI': 'sainz',
  'STR': 'stroll', 'VER': 'max_verstappen'
};

interface F1Index {
  Seasons?: { Year: number }[];
  Meetings?: { Path: string }[];
  Sessions?: { Path: string, Name: string }[];
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
  // 1. CORS Headers
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
    const forceMeeting = url.searchParams.get('meeting');
    const forceSession = url.searchParams.get('session');

    let season = forceSeason;
    let meeting = forceMeeting;
    let session = forceSession;

    // 2. Discover Path if not forced
    if (!season) {
      const resp = await fetch(`${BASE_URL}/Index.json`);
      const data: F1Index = await resp.json();
      season = data.Seasons?.[data.Seasons.length - 1]?.Year.toString() || new Date().getFullYear().toString();
    }

    if (!meeting) {
      const resp = await fetch(`${BASE_URL}/${season}/Index.json`);
      const data: F1Index = await resp.json();
      // Meetings are usually in order, pick the latest one (or the one matching today's date in a real app)
      meeting = data.Meetings?.[data.Meetings.length - 1]?.Path || '';
    }

    if (!session) {
      const resp = await fetch(`${BASE_URL}/${season}/${meeting}Index.json`);
      const data: F1Index = await resp.json();
      // Look for "Race" specifically, fallback to latest
      const raceSession = data.Sessions?.find(s => s.Name.toLowerCase() === 'race');
      session = raceSession?.Path || data.Sessions?.[data.Sessions.length - 1]?.Path || '';
    }

    const sessionPath = `${BASE_URL}/${season}/${meeting}${session}`;

    // 3. Fetch Timing and Session Info
    const [timingResp, sessionResp] = await Promise.all([
      fetch(`${sessionPath}TimingData.json`),
      fetch(`${sessionPath}SessionInfo.json`)
    ]);

    if (!timingResp.ok) {
      throw new Error(`Failed to fetch timing data: ${timingResp.status}`);
    }

    const timingData: TimingData = await timingResp.json();
    const sessionInfo: SessionInfo = await sessionResp.json();

    // 4. Map and Simplify Results
    // We need DriverList to map Number to Acronym
    const driverListResp = await fetch(`${sessionPath}DriverList.json`);
    const driverListData = await driverListResp.json();

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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
