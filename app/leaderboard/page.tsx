'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Container, Row, Col, ButtonGroup, Button, Badge } from 'react-bootstrap';
import { LeaderboardEntry, CURRENT_SEASON } from '@/lib/data';
import { calculateSeasonPoints } from '@/lib/scoring';
import { DbPrediction } from '@/lib/types';
import { fetchCalendar } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import PullToRefresh from '@/components/PullToRefresh';
import { fetchAllSimplifiedResults } from '@/lib/results';
import { isTestAccount } from '@/lib/utils/profiles';
import { withTimeout } from '@/lib/utils/sync-queue';
import { STORAGE_KEYS, getPredictionKey } from '@/lib/utils/storage';
import { useAuth } from '@/components/AuthProvider';
import LeaderboardTable from '@/components/LeaderboardTable';
import { Trophy } from 'lucide-react';

interface LeaderboardPlayer {
  username: string;
  userId?: string;
  isLocal: boolean;
  dbPredictions?: DbPrediction[];
}

export default function LeaderboardPage() {
  const supabase = createClient();
  const mountedRef = useRef(true);
  const { session, currentUser, syncVersion, triggerRefresh } = useAuth();

  // 1. Synchronous Cache Initialization
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    const cached = localStorage.getItem(STORAGE_KEYS.CACHE_LEADERBOARD);
    return cached ? JSON.parse(cached) : [];
  });

  const [loading, setLoading] = useState(!leaderboard.length);
  const [isSeasonComplete, setIsSeasonComplete] = useState(false);
  const [view, setView] = useState<'global' | 'local'>('global');

  // Lifecycle
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const calculate = useCallback(async (quiet = false) => {
  if (!quiet && mountedRef.current) setLoading(true);
  try {
    const [raceResultsMap, races] = await Promise.all([
      fetchAllSimplifiedResults(),
      fetchCalendar(CURRENT_SEASON)
    ]);
    
    const resultsFoundCount = Object.keys(raceResultsMap).length;
    if (mountedRef.current) setIsSeasonComplete(resultsFoundCount > 0 && resultsFoundCount >= races.length);

    let playersData: LeaderboardPlayer[] = [];
      if (view === 'global') {
        const currentUserId = session?.user?.id;

        const { data: profiles } = await withTimeout(supabase.from('profiles').select('id, username'));
        const { data: predictions } = await withTimeout(supabase.from('predictions').select('*')) as { data: DbPrediction[] | null };

        if (profiles && mountedRef.current) {
          playersData = profiles
            .filter(p => !isTestAccount(p.username) || p.id === currentUserId)
            .map(p => ({ 
              username: p.username, 
              userId: p.id, 
              isLocal: false,
              dbPredictions: predictions?.filter(pred => pred.user_id === p.id) || []
            }));
        }
      } else {
        const localPlayers: string[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYERS_LIST) || '[]');
        playersData = localPlayers.map(p => ({ username: p, isLocal: true }));
      }

      const entries: LeaderboardEntry[] = playersData.map((player) => {
        const playerPredictions: { [round: string]: { p10: string, dnf: string } | null } = {};
        Object.keys(raceResultsMap).forEach(round => {
          if (player.isLocal) {
            const predStr = localStorage.getItem(getPredictionKey(CURRENT_SEASON, player.username, round));
            if (predStr) playerPredictions[round] = JSON.parse(predStr);
          } else if (player.dbPredictions) {
            const dbMatch = player.dbPredictions.find((dp) => dp.race_id === `${CURRENT_SEASON}_${round}`);
            if (dbMatch) playerPredictions[round] = { p10: dbMatch.p10_driver_id, dnf: dbMatch.dnf_driver_id };
          }
        });
        const { totalPoints, lastRacePoints, latestBreakdown, history } = calculateSeasonPoints(playerPredictions, raceResultsMap);
        return { rank: 0, player: player.username, points: totalPoints, lastRacePoints, breakdown: latestBreakdown, history };
      });

      const sorted = entries.sort((a, b) => b.points - a.points);
      const ranked = sorted.map((entry, index) => ({ ...entry, rank: index + 1 }));
      
      if (mountedRef.current) {
        setLeaderboard(ranked);
        if (view === 'global') localStorage.setItem(STORAGE_KEYS.CACHE_LEADERBOARD, JSON.stringify(ranked));
      }
    } catch (err) {
      console.error('Leaderboard: Calc error:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [supabase, view, session?.user?.id, syncVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Always calculate on mount, view change, or sync update
    // quiet=true if we already have some data to show
    calculate(leaderboard.length > 0);
  }, [calculate, leaderboard.length]); // calculate changes when view, session, or syncVersion change

  useEffect(() => {
    // Listen for app resume
    const handleResume = () => {
      console.log('Leaderboard: App resumed (background).');
      triggerRefresh();
    };
    window.addEventListener('p10:app_resume', handleResume);
    return () => window.removeEventListener('p10:app_resume', handleResume);
  }, [triggerRefresh]);

  // Real-time subscription
  useEffect(() => {
    if (view !== 'global') return;
    const channel = supabase.channel('leaderboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'verified_results' }, () => calculate(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, () => calculate(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, view, calculate]);

  return (
    <PullToRefresh onRefresh={() => calculate(false)}>
      <Container className="mt-4 mb-4">
        <Row className="mb-4 align-items-center g-3">
          <Col xs={12} md={6}>
            <div className="d-flex align-items-center">
              <div className="bg-danger rounded-circle p-2 me-3 d-flex align-items-center justify-content-center shadow-sm" style={{ width: '45px', height: '45px' }}>
                <Trophy size={24} className="text-white" />
              </div>
              <div>
                <div className="d-flex align-items-center gap-2">
                  <h1 className="h2 mb-0 f1-page-title">Leaderboard</h1>
                  {isSeasonComplete && <Badge bg="warning" text="dark" className="rounded-pill fw-bold" style={{ fontSize: '0.6rem' }}>FINAL STANDINGS</Badge>}
                </div>
                <small className="text-muted text-uppercase fw-bold letter-spacing-1" style={{ fontSize: '0.65rem' }}>{CURRENT_SEASON} World Rankings</small>
              </div>
            </div>
          </Col>
          <Col xs={12} md={6} className="text-md-end">
            <ButtonGroup className="bg-dark rounded border border-secondary p-1 shadow-sm">
              <Button 
                variant={view === 'global' ? 'danger' : 'dark'} 
                size="sm" 
                onClick={() => setView('global')} 
                className="rounded px-4 fw-bold text-uppercase"
                style={{ fontSize: '0.7rem' }}
              >
                GLOBAL
              </Button>
              <Button 
                variant={view === 'local' ? 'danger' : 'dark'} 
                size="sm" 
                onClick={() => setView('local')} 
                className="rounded px-4 fw-bold text-uppercase"
                style={{ fontSize: '0.7rem' }}
              >
                GUESTS
              </Button>
            </ButtonGroup>
          </Col>
        </Row>
        <Row>
          <Col>
            <LeaderboardTable 
              key={view}
              entries={leaderboard} 
              loading={loading} 
              currentUser={currentUser || undefined}
              isSeasonComplete={isSeasonComplete}
              emptyMessage={view === 'global' ? "No global players found." : "No guest data found on this device."}
            />
          </Col>
        </Row>
      </Container>
    </PullToRefresh>
  );
}
