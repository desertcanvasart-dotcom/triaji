/**
 * GET /api/admin/analytics
 *
 * Returns widget analytics data for the analytics dashboard.
 * Query params:
 *   - days: number of days to look back (default 30)
 *
 * Returns funnel data, daily time series, and top pages.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateAdmin, tenantScope } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

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

  // Build query
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

  // ─── Funnel counts ────────────────────────────────────────────────
  const funnel = {
    impression: 0,
    button_click: 0,
    session_start: 0,
    session_complete: 0,
    booking_started: 0,
    booking_confirmed: 0,
  };

  // ─── Daily time series ────────────────────────────────────────────
  const daily: Record<string, Record<string, number>> = {};

  // ─── Top pages ────────────────────────────────────────────────────
  const pageCounts: Record<string, number> = {};

  for (const event of events ?? []) {
    const type = event.event_type as keyof typeof funnel;
    if (type in funnel) {
      funnel[type]++;
    }

    // Daily
    const day = (event.created_at as string).split('T')[0] ?? '';
    if (!daily[day]) {
      daily[day] = { impression: 0, button_click: 0, session_start: 0, session_complete: 0, booking_started: 0, booking_confirmed: 0 };
    }
    if (type in (daily[day] ?? {})) {
      daily[day]![type]!++;
    }

    // Top pages (count impressions per page)
    if (type === 'impression' && event.page_url) {
      pageCounts[event.page_url] = (pageCounts[event.page_url] ?? 0) + 1;
    }
  }

  // Sort daily by date
  const dailySeries = Object.entries(daily)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));

  // Top pages — sorted by count descending, top 10
  const topPages = Object.entries(pageCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([url, count]) => ({ url, count }));

  // Conversion rates
  const conversions = {
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

  return NextResponse.json({
    funnel,
    conversions,
    dailySeries,
    topPages,
    totalEvents: events?.length ?? 0,
  });
}
