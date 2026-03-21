'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Container, Row, Col, Badge, Nav, Spinner } from 'react-bootstrap';
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
import { triggerSelectionHaptic } from '@/lib/utils/haptics';
import LeaderboardTable from '@/components/LeaderboardTable';
import { Trophy, Globe, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SWIPE_THRESHOLD = 30;
const VELOCITY_THRESHOLD = 200;

export default function LeaderboardPage() {
  const supabase = createClient();
  const mountedRef = useRef(true);
  const { session, currentUser, syncVersion, triggerRefresh } = useAuth();

  // 1. Separate Cache Initialization for Global and Local
  const [globalLeaderboard, setGlobalLeaderboard] = useState<LeaderboardEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    const cached = localStorage.getItem(STORAGE_KEYS.CACHE_LEADERBOARD);
    return cached ? JSON.parse(cached) : [];
  });

  const [localLeaderboard, setLocalLeaderboard] = useState<LeaderboardEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    const cached = localStorage.getItem(STORAGE_KEYS.CACHE_LOCAL_LEADERBOARD);
    return cached ? JSON.parse(cached) : [];
  });

  const [loading, setLoading] = useState(!globalLeaderboard.length && !localLeaderboard.length);
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

      // We always calculate both to support seamless swiping
      const currentUserId = session?.user?.id;

      // 1. GLOBAL CALCULATION
      let globalEntries: LeaderboardEntry[] = [];
      const { data: profiles } = await withTimeout(supabase.from('profiles').select('id, username'));
      const { data: predictions } = await withTimeout(supabase.from('predictions').select('*')) as { data: DbPrediction[] | null };

      if (profiles) {
        const globalPlayers = profiles
          .filter(p => !isTestAccount(p.username) || p.id === currentUserId)
          .map(p => ({ 
            username: p.username, 
            userId: p.id, 
            isLocal: false,
            dbPredictions: predictions?.filter(pred => pred.user_id === p.id) || []
          }));

        globalEntries = globalPlayers.map((player) => {
          const playerPredictions: { [round: string]: { p10: string, dnf: string } | null } = {};
          Object.keys(raceResultsMap).forEach(round => {
            const dbMatch = player.dbPredictions?.find((dp) => dp.race_id === `${CURRENT_SEASON}_${round}`);
            if (dbMatch) playerPredictions[round] = { p10: dbMatch.p10_driver_id, dnf: dbMatch.dnf_driver_id };
          });
          const { totalPoints, lastRacePoints, latestBreakdown, history } = calculateSeasonPoints(playerPredictions, raceResultsMap);
          return { rank: 0, player: player.username, points: totalPoints, lastRacePoints, breakdown: latestBreakdown, history };
        });

        const sortedGlobal = globalEntries.sort((a, b) => b.points - a.points);
        const rankedGlobal = sortedGlobal.map((entry, index) => ({ ...entry, rank: index + 1 }));
        
        if (mountedRef.current) {
          setGlobalLeaderboard(rankedGlobal);
          localStorage.setItem(STORAGE_KEYS.CACHE_LEADERBOARD, JSON.stringify(rankedGlobal));
        }
      }

      // 2. LOCAL CALCULATION
      const localPlayers: string[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYERS_LIST) || '[]');
      const localPlayersData = localPlayers.map(p => ({ username: p, isLocal: true }));

      const localEntries: LeaderboardEntry[] = localPlayersData.map((player) => {
        const playerPredictions: { [round: string]: { p10: string, dnf: string } | null } = {};
        Object.keys(raceResultsMap).forEach(round => {
          const predStr = localStorage.getItem(getPredictionKey(CURRENT_SEASON, player.username, round));
          if (predStr) playerPredictions[round] = JSON.parse(predStr);
        });
        const { totalPoints, lastRacePoints, latestBreakdown, history } = calculateSeasonPoints(playerPredictions, raceResultsMap);
        return { rank: 0, player: player.username, points: totalPoints, lastRacePoints, breakdown: latestBreakdown, history };
      });

      const sortedLocal = localEntries.sort((a, b) => b.points - a.points);
      const rankedLocal = sortedLocal.map((entry, index) => ({ ...entry, rank: index + 1 }));
      
      if (mountedRef.current) {
        setLocalLeaderboard(rankedLocal);
        localStorage.setItem(STORAGE_KEYS.CACHE_LOCAL_LEADERBOARD, JSON.stringify(rankedLocal));
      }

    } catch (err) {
      console.error('Leaderboard: Calc error:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [supabase, session?.user?.id, syncVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    calculate(globalLeaderboard.length > 0 || localLeaderboard.length > 0);
  }, [calculate, globalLeaderboard.length, localLeaderboard.length]);

  useEffect(() => {
    const handleResume = () => triggerRefresh();
    window.addEventListener('p10:app_resume', handleResume);
    return () => window.removeEventListener('p10:app_resume', handleResume);
  }, [triggerRefresh]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase.channel('leaderboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'verified_results' }, () => calculate(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, () => calculate(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, calculate]);

  const handleViewChange = (newView: 'global' | 'local') => {
    if (newView !== view) {
      triggerSelectionHaptic();
      setView(newView);
    }
  };

  const swipeHandlers = {
    onDragEnd: (event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }) => {
      const { offset, velocity } = info;
      const isRightSwipe = offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD;
      const isLeftSwipe = offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD;

      if (isRightSwipe && view === 'local') {
        handleViewChange('global');
      } else if (isLeftSwipe && view === 'global') {
        handleViewChange('local');
      }
    }
  };

  return (
    <PullToRefresh onRefresh={() => calculate(true)}>
      <Container className="mt-4 mb-4 overflow-hidden">
        <Row className="mb-4 align-items-center">
          <Col>
            <div className="d-flex align-items-center">
              <div className="bg-danger rounded-circle p-2 me-3 d-flex align-items-center justify-content-center shadow-sm" style={{ width: '45px', height: '45px' }}>
                <Trophy size={24} className="text-white" />
              </div>
              <div>
                <div className="d-flex align-items-center gap-2">
                  <h1 className="h2 mb-0 f1-page-title">Leaderboard</h1>
                  {isSeasonComplete && <Badge bg="warning" text="dark" className="rounded-pill fw-bold" style={{ fontSize: '0.6rem' }}>FINAL</Badge>}
                </div>
                <small className="text-muted text-uppercase fw-bold letter-spacing-1" style={{ fontSize: '0.65rem' }}>
                  {view === 'global' ? `${CURRENT_SEASON} World Rankings` : 'Guest Players on Device'}
                </small>
              </div>
            </div>
          </Col>
        </Row>

        <div className="mb-4">
          <Nav variant="pills" className="f1-tab-container p-1 bg-dark rounded-pill border border-secondary" style={{ width: 'fit-content' }}>
            <Nav.Item>
              <Nav.Link 
                active={view === 'global'} 
                onClick={() => handleViewChange('global')}
                className="rounded-pill px-4 py-2 d-flex align-items-center"
              >
                <Globe size={16} className="me-2" />
                Global
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link 
                active={view === 'local'} 
                onClick={() => handleViewChange('local')}
                className="rounded-pill px-4 py-2 d-flex align-items-center"
              >
                <Users size={16} className="me-2" />
                Guests
              </Nav.Link>
            </Nav.Item>
          </Nav>
        </div>
        
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="danger" />
          </div>
        ) : (
          <div className="position-relative" style={{ minHeight: '400px' }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={view}
                initial={{ opacity: 0, x: view === 'global' ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: view === 'global' ? -20 : 20 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.15}
                onDragEnd={swipeHandlers.onDragEnd}
                className="w-100"
              >
                <LeaderboardTable 
                  entries={view === 'global' ? globalLeaderboard : localLeaderboard} 
                  loading={false} 
                  currentUser={currentUser || undefined}
                  isSeasonComplete={isSeasonComplete}
                  emptyMessage={view === 'global' ? "No global players found." : "No guest data found on this device."}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </Container>
    </PullToRefresh>
  );
}
