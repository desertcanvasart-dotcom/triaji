/**
 * GET /api/admin/analytics
 *
 * Returns widget analytics data for the analytics dashboard.
 * Query params:
 *   - days: number of days to look back (default 30)
 *
 * Returns funnel data, daily time series, and top pages.
 *
 * Primary path: the widget_analytics_summary RPC (migration 061) aggregates
 * counts in SQL. Until that migration is applied to the live database the
 * route falls back to the legacy full-row fetch + JS aggregation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateAdmin, tenantScope } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const FUNNEL_TYPES = [
  'impression',
  'button_click',
  'session_start',
  'session_complete',
  'booking_started',
  'booking_confirmed',
] as const;

type FunnelType = (typeof FUNNEL_TYPES)[number];
type Funnel = Record<FunnelType, number>;

function emptyFunnel(): Funnel {
  return {
    impression: 0,
    button_click: 0,
    session_start: 0,
    session_complete: 0,
    booking_started: 0,
    booking_confirmed: 0,
  };
}

function buildConversions(funnel: Funnel) {
  return {
    clickRate: funnel.impression > 0
      ? ((funnel.button_click / funnel.impression) * 100).toFixed(1)
      : '0.0',
    sessionRate: funnel.button_click > 0
      ? ((funnel.session_start / funnel.button_click) * 100).toFixed(1)
      : '0.0',
    completionRate: funnel.session_start > 0
      ? ((funnel.session_complete / funnel.session_start) * 100).toFixed(1)
      : '0.0',
    bookingRate: funnel.session_complete > 0
      ? ((funnel.booking_confirmed / funnel.session_complete) * 100).toFixed(1)
      : '0.0',
  };
}

interface RpcSummary {
  funnel: Record<string, number>;
  daily: Array<{ date: string; event_type: string; count: number }>;
  top_pages: Array<{ url: string; count: number }>;
  total_events: number;
}

export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;

  const days = Math.min(
    Number(request.nextUrl.searchParams.get('days') ?? 30),
    90
  );

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']!;
  const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tenantId = tenantScope(admin);
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Primary path: aggregate in SQL.
  const { data: rpcData, error: rpcError } = await supabase.rpc('widget_analytics_summary', {
    p_since: since.toISOString(),
    p_tenant_id: tenantId ?? null,
  });

  if (!rpcError && rpcData) {
    const summary = rpcData as unknown as RpcSummary;

    const funnel = emptyFunnel();
    for (const type of FUNNEL_TYPES) {
      funnel[type] = summary.funnel[type] ?? 0;
    }

    // Regroup the per-(day, type) rows into one zero-filled record per day.
    const daily: Record<string, Funnel> = {};
    for (const row of summary.daily) {
      if (!FUNNEL_TYPES.includes(row.event_type as FunnelType)) continue;
      daily[row.date] ??= emptyFunnel();
      daily[row.date]![row.event_type as FunnelType] = row.count;
    }
    const dailySeries = Object.entries(daily)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));

    return NextResponse.json({
      funnel,
      conversions: buildConversions(funnel),
      dailySeries,
      topPages: summary.top_pages,
      totalEvents: summary.total_events,
    });
  }

  // Fallback: migration 061 not applied yet — legacy full fetch + JS aggregation.
  console.warn('[admin/analytics] widget_analytics_summary RPC unavailable, using legacy path:', rpcError?.message);

  let query = supabase
    .from('widget_events')
    .select('event_type, page_url, created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true });

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data: events, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const funnel = emptyFunnel();
  const daily: Record<string, Funnel> = {};
  const pageCounts: Record<string, number> = {};

  for (const event of events ?? []) {
    const type = event.event_type as FunnelType;
    if (type in funnel) {
      funnel[type]++;
    }

    const day = (event.created_at as string).split('T')[0] ?? '';
    daily[day] ??= emptyFunnel();
    if (type in (daily[day] ?? {})) {
      daily[day]![type]++;
    }

    if (type === 'impression' && event.page_url) {
      pageCounts[event.page_url] = (pageCounts[event.page_url] ?? 0) + 1;
    }
  }

  const dailySeries = Object.entries(daily)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));

  const topPages = Object.entries(pageCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([url, count]) => ({ url, count }));

  return NextResponse.json({
    funnel,
    conversions: buildConversions(funnel),
    dailySeries,
    topPages,
    totalEvents: events?.length ?? 0,
  });
}
