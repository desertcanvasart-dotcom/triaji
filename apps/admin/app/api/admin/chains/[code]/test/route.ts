/**
 * POST /api/admin/chains/[code]/test
 *
 * Test API credentials for a lab chain.
 * Calls adapter.isConfigured() and attempts a test submitOrder with dummy data.
 * If successful, updates lab_chains: has_api=true, api_contract_signed=true.
 *
 * Auth: platform_admin
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import {
  getLabChainAdapter,
  type LabChainCode,
} from '@triaji/lab-chain-adapters';

export const dynamic = 'force-dynamic';

const VALID_CHAIN_CODES = new Set<string>(['alborg', 'almokhtabar', 'alfa']);

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

interface RouteContext {
  params: Promise<{ code: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  // Auth
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;

  if (admin.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Platform admin access required' },
      { status: 403 }
    );
  }

  try {
    const { code } = await context.params;

    if (!VALID_CHAIN_CODES.has(code)) {
      return NextResponse.json(
        { error: `Invalid chain code: ${code}` },
        { status: 400 }
      );
    }

    const chainCode = code as LabChainCode;

    // 1. Check if adapter is configured
    let adapter;
    try {
      adapter = getLabChainAdapter(chainCode);
    } catch (err) {
      return NextResponse.json({
        success: false,
        step: 'adapter_init',
        error: `Failed to initialize adapter: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }

    const isConfigured = adapter.isConfigured();
    if (!isConfigured) {
      return NextResponse.json({
        success: false,
        step: 'credentials_check',
        error: 'API credentials are not configured. Check environment variables.',
      });
    }

    // 2. Attempt a test order with dummy data
    let testOrderId: string | null = null;
    try {
      const result = await adapter.submitOrder({
        patient: {
          name: 'TEST_PATIENT_TRIAJI',
          phone: '01000000000',
          dateOfBirth: '1990-01-01',
          gender: 'male',
        },
        tests: [
          {
            code: 'TEST_CBC',
            name: 'Complete Blood Count (TEST)',
          },
        ],
        tenantId: 'test',
        patientId: 'test',
        notes: `triaji-test-${Date.now()}`,
      });

      if (result.success) {
        testOrderId = result.orderId ?? null;
      } else {
        return NextResponse.json({
          success: false,
          step: 'test_order',
          error: result.error ?? 'Test order failed without error message',
        });
      }
    } catch (err) {
      return NextResponse.json({
        success: false,
        step: 'test_order',
        error: `Test order threw exception: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }

    // 3. Update chain record
    const supabase = getServiceClient();

    const { error: updateError } = await supabase
      .from('lab_chains')
      .update({
        has_api: true,
        api_contract_signed: true,
        api_live_date: new Date().toISOString().split('T')[0],
      })
      .eq('code', code);

    if (updateError) {
      console.error('[admin-chain-test] db update error:', updateError.message);
      // Non-blocking — the test itself was successful
    }

    return NextResponse.json({
      success: true,
      testOrderId,
      message: `API connection verified for ${code}. Chain marked as live.`,
    });
  } catch (err) {
    console.error('[admin-chain-test] error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
