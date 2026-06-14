import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { embedDocument } from '@/lib/embedding/pipeline';

export const dynamic = 'force-dynamic';

/** POST /api/admin/kb/[id]/embed — manually trigger re-embed */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  const { id } = await params;
  const result = await embedDocument(id);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? 'Embedding failed.' },
      { status: 500 }
    );
  }

  return NextResponse.json(result);
}
