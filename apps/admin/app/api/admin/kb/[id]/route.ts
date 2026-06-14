import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { embedDocument } from '@/lib/embedding/pipeline';

export const dynamic = 'force-dynamic';

/** GET /api/admin/kb/[id] — get single document */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('kb_documents')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  }

  return NextResponse.json({ document: data });
}

/** PUT /api/admin/kb/[id] — update document + trigger re-embed */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createAdminClient();
  const body = await request.json();

  let metadata = undefined;
  if (body['metadata'] !== undefined) {
    try {
      metadata = typeof body['metadata'] === 'string' ? JSON.parse(body['metadata']) : body['metadata'];
    } catch {
      return NextResponse.json({ error: 'Invalid metadata JSON.' }, { status: 400 });
    }
  }

  const updateData: Record<string, unknown> = {};
  const fields = ['collection', 'title_ar', 'title_en', 'content_ar', 'content_en', 'is_active'];
  for (const f of fields) {
    if (body[f] !== undefined) updateData[f] = body[f];
  }
  if (metadata !== undefined) updateData['metadata'] = metadata;
  updateData['updated_at'] = new Date().toISOString();

  const { data: doc, error } = await supabase
    .from('kb_documents')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Trigger re-embed if content changed
  let embedResult = null;
  if (body['content_ar'] !== undefined) {
    embedResult = await embedDocument(id);
  }

  return NextResponse.json({ document: doc, embedding: embedResult });
}

/** DELETE /api/admin/kb/[id] — soft delete */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('kb_documents')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
