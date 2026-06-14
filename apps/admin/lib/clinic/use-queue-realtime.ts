'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseBrowser } from '../supabase/browser';
import type { QueueEntry } from '@triaji/shared/types';

interface UseQueueRealtimeReturn {
  entries: QueueEntry[];
  loading: boolean;
  error: string | null;
}

/**
 * React hook that subscribes to real-time queue changes via Supabase Realtime.
 * Fetches today's queue for a given tenant + doctor and keeps it in sync.
 */
export function useQueueRealtime(
  tenantId: string,
  doctorId: string
): UseQueueRealtimeReturn {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const fetchQueue = useCallback(async () => {
    try {
      const supabase = getSupabaseBrowser();
      const { data, error: fetchError } = await supabase
        .from('clinic_queue')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('doctor_id', doctorId)
        .eq('queue_date', today)
        .order('queue_number', { ascending: true });

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      setEntries((data as QueueEntry[]) ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch queue');
    } finally {
      setLoading(false);
    }
  }, [tenantId, doctorId, today]);

  useEffect(() => {
    // Initial fetch
    fetchQueue();

    // Subscribe to real-time changes
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel(`queue:${tenantId}:${doctorId}:${today}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clinic_queue',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          // Re-fetch the full queue on any change (simpler than incremental updates)
          fetchQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, doctorId, today, fetchQueue]);

  return { entries, loading, error };
}
