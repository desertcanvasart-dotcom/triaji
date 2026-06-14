import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { embedQuery } from '@/lib/embedding/pipeline';

export const dynamic = 'force-dynamic';

/** POST /api/admin/kb/test-query — test retrieval */
export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  const body = await request.json();
  const query: string = body['query'];

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ error: 'query is required.' }, { status: 400 });
  }

  try {
    const queryEmbedding = await embedQuery(query);
    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc('match_kb_documents', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: 0.3,
      match_count: 5,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ results: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Query failed.' },
      { status: 500 }
    );
  }
}
