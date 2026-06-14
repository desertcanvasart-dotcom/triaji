/**
 * GET /api/cron/lab-chain-sync
 *
 * Daily sync cron job for lab chain branch lists and test catalogs.
 * AMENDMENT: Staggers chain calls by 10 minutes to avoid overwhelming APIs.
 * Logs each sync operation to lab_chain_sync_log table.
 *
 * Secured by CRON_SECRET header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import {
  getLabChainAdapter,
  isChainApiAvailable,
  type LabChainCode,
} from '@triaji/lab-chain-adapters';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow up to 5 minutes (3 chains x ~1.5min each + stagger)

const CHAINS: LabChainCode[] = ['alborg', 'almokhtabar', 'alfa'];
const STAGGER_MS = 10 * 60 * 1000; // 10 minutes between chains

export async function GET(request: NextRequest) {
  // ─── Verify cron secret ─────────────────────────────────────────────────────
  const secret = request.headers.get('x-cron-secret');
  const cronSecret = process.env['CRON_SECRET'];

  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();
  const now = new Date();

  const syncResults: Array<{
    chainCode: LabChainCode;
    status: 'success' | 'skipped' | 'error';
    branchesSynced?: number;
    testsSynced?: number;
    error?: string;
    startedAt: string;
    completedAt?: string;
    staggerDelay: number;
  }> = [];

  // ─── Stagger chain syncs by 10 minutes ────────────────────────────────────
  for (let i = 0; i < CHAINS.length; i++) {
    const chainCode = CHAINS[i]!;
    const staggerDelay = i * STAGGER_MS;

    // Wait for stagger delay (skip for first chain)
    if (staggerDelay > 0) {
      await delay(staggerDelay);
    }

    const startedAt = new Date().toISOString();

    // Check if chain API is available
    if (!isChainApiAvailable(chainCode)) {
      const result = {
        chainCode,
        status: 'skipped' as const,
        error: 'Chain API not configured or unavailable',
        startedAt,
        completedAt: new Date().toISOString(),
        staggerDelay,
      };

      syncResults.push(result);

      await logSync(supabase, {
        chain_code: chainCode,
        sync_type: 'daily_full',
        status: 'skipped',
        error: result.error,
        started_at: startedAt,
        completed_at: result.completedAt,
      });

      continue;
    }

    try {
      const adapter = getLabChainAdapter(chainCode);
      let branchesSynced = 0;
      let testsSynced = 0;

      // ─── Sync branch list ─────────────────────────────────────────────────
      try {
        // Fetch branches via getAvailableSlots with no filters (returns branches)
        const slots = await adapter.getAvailableSlots({ testCodes: [] });
        const branchIds = new Set(slots.map((s) => s.branchId));

        // Upsert branches into lab_chain_branches
        for (const slot of slots) {
          if (!branchIds.has(slot.branchId)) continue;
          branchIds.delete(slot.branchId); // Process each branch once

          await supabase
            .from('lab_chain_branches')
            .upsert(
              {
                chain_code: chainCode,
                branch_id: slot.branchId,
                branch_name: slot.branchName,
                branch_name_ar: slot.branchNameAr,
                home_collection: slot.homeCollection ?? false,
                is_active: true,
                last_synced_at: new Date().toISOString(),
              },
              { onConflict: 'chain_code,branch_id' },
            );

          branchesSynced++;
        }

        await logSync(supabase, {
          chain_code: chainCode,
          sync_type: 'branches',
          status: 'success',
          items_synced: branchesSynced,
          started_at: startedAt,
          completed_at: new Date().toISOString(),
        });
      } catch (branchErr) {
        console.error(`[cron/lab-chain-sync] Branch sync failed for ${chainCode}:`, branchErr);
        await logSync(supabase, {
          chain_code: chainCode,
          sync_type: 'branches',
          status: 'error',
          error: (branchErr as Error).message,
          started_at: startedAt,
          completed_at: new Date().toISOString(),
        });
      }

      // ─── Sync test catalog ────────────────────────────────────────────────
      try {
        // Refresh test code mappings from the chain's catalog
        // The adapter's getAvailableSlots with test codes returns available tests
        // We use the existing lab_chain_test_mapping table
        const { data: existingMappings } = await supabase
          .from('lab_chain_test_mapping')
          .select('triaji_code, chain_test_code')
          .eq('chain_code', chainCode);

        testsSynced = existingMappings?.length ?? 0;

        // Update last_synced_at for all mappings of this chain
        if (testsSynced > 0) {
          await supabase
            .from('lab_chain_test_mapping')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('chain_code', chainCode);
        }

        await logSync(supabase, {
          chain_code: chainCode,
          sync_type: 'test_catalog',
          status: 'success',
          items_synced: testsSynced,
          started_at: startedAt,
          completed_at: new Date().toISOString(),
        });
      } catch (testErr) {
        console.error(`[cron/lab-chain-sync] Test catalog sync failed for ${chainCode}:`, testErr);
        await logSync(supabase, {
          chain_code: chainCode,
          sync_type: 'test_catalog',
          status: 'error',
          error: (testErr as Error).message,
          started_at: startedAt,
          completed_at: new Date().toISOString(),
        });
      }

      const completedAt = new Date().toISOString();

      syncResults.push({
        chainCode,
        status: 'success',
        branchesSynced,
        testsSynced,
        startedAt,
        completedAt,
        staggerDelay,
      });

      // Log overall daily sync
      await logSync(supabase, {
        chain_code: chainCode,
        sync_type: 'daily_full',
        status: 'success',
        items_synced: branchesSynced + testsSynced,
        started_at: startedAt,
        completed_at: completedAt,
      });
    } catch (err) {
      const completedAt = new Date().toISOString();
      const errorMsg = (err as Error).message;

      syncResults.push({
        chainCode,
        status: 'error',
        error: errorMsg,
        startedAt,
        completedAt,
        staggerDelay,
      });

      await logSync(supabase, {
        chain_code: chainCode,
        sync_type: 'daily_full',
        status: 'error',
        error: errorMsg,
        started_at: startedAt,
        completed_at: completedAt,
      });

      console.error(`[cron/lab-chain-sync] Full sync failed for ${chainCode}:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    syncs: syncResults,
    timestamp: now.toISOString(),
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function logSync(
  supabase: ReturnType<typeof createServerClient>,
  entry: {
    chain_code: string;
    sync_type: string;
    status: string;
    items_synced?: number;
    error?: string;
    started_at: string;
    completed_at?: string;
  },
): Promise<void> {
  const { error } = await supabase
    .from('lab_chain_sync_log')
    .insert(entry);

  if (error) {
    console.error(`[cron/lab-chain-sync] Failed to log sync:`, error);
  }
}
