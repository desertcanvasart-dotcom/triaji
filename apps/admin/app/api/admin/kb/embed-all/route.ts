import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { embedDocument } from '@/lib/embedding/pipeline';

export const dynamic = 'force-dynamic';

/** POST /api/admin/kb/embed-all — re-embed all active documents */
export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  const supabase = createAdminClient();

  const { data: docs, error } = await supabase
    .from('kb_documents')
    .select('id')
    .eq('is_active', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{ id: string; success: boolean; chunks: number; error?: string }> = [];

  for (const doc of docs ?? []) {
    const result = await embedDocument(doc.id);
    results.push({
      id: doc.id,
      success: result.success,
      chunks: result.chunksEmbedded,
      error: result.error,
    });
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({
    total: results.length,
    succeeded,
    failed,
    results,
  });
}
