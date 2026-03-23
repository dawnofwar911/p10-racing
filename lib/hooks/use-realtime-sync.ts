'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Custom hook to subscribe to real-time changes in Supabase tables.
 * Triggers the provided callback whenever a change occurs.
 */
export function useRealtimeSync(onUpdate: () => void, tables: string[] = ['predictions', 'verified_results']) {
  const supabase = createClient();

  useEffect(() => {
    if (typeof supabase.channel !== 'function') {
      console.warn('supabase.channel is not available (possibly mocked in tests)');
      return;
    }

    const channel = supabase.channel('realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'verified_results' }, () => {
        if (tables.includes('verified_results')) onUpdate();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, () => {
        if (tables.includes('predictions')) onUpdate();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, onUpdate, tables]);
}
