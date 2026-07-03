import { NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';

export const dynamic = 'force-dynamic';

// GET /api/health — liveness + dependency check for uptime monitoring.
// Public by design; returns no data beyond component up/down status.
export async function GET() {
  const checks: Record<string, 'ok' | 'error'> = {};

  try {
    const supabase = createServerClient();

    const { error: dbError } = await supabase
      .from('specialties')
      .select('id', { head: true, count: 'exact' })
      .limit(1);
    checks.db = dbError ? 'error' : 'ok';

    const { error: storageError } = await supabase.storage
      .from('clinical-documents')
      .list('', { limit: 1 });
    checks.storage = storageError ? 'error' : 'ok';
  } catch {
    checks.db = checks.db ?? 'error';
    checks.storage = checks.storage ?? 'error';
  }

  const ok = Object.values(checks).every((v) => v === 'ok');

  return NextResponse.json(
    { ok, checks, timestamp: new Date().toISOString() },
    { status: ok ? 200 : 503 }
  );
}
