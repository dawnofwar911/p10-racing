'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const DEFAULT_TABLES = ['predictions', 'verified_results'];

/**
 * Custom hook to subscribe to real-time changes in Supabase tables.
 * Triggers the provided callback whenever a change occurs in any of the specified tables.
 */
export function useRealtimeSync(onUpdate: () => void, tables: string[] = DEFAULT_TABLES) {
  const supabase = createClient();
  const tablesKey = JSON.stringify(tables);

  useEffect(() => {
    if (typeof supabase.channel !== 'function') {
      console.warn('supabase.channel is not available (possibly mocked in tests)');
      return;
    }

    let activeTables: string[] = [];
    try {
      activeTables = JSON.parse(tablesKey);
    } catch (e) {
      console.error('useRealtimeSync: Failed to parse tables key', e);
      return;
    }
    const channel = supabase.channel('realtime-sync');
    
    // Subscribe to each table
    activeTables.forEach((table: string) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        onUpdate();
      });
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, onUpdate, tablesKey]); // eslint-disable-line react-hooks/exhaustive-deps
}
