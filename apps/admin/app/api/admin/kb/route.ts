import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { embedDocument } from '@/lib/embedding/pipeline';

export const dynamic = 'force-dynamic';

/** GET /api/admin/kb — list documents */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { searchParams } = request.nextUrl;
  const collection = searchParams.get('collection') ?? '';
  const status = searchParams.get('status') ?? '';
  const search = searchParams.get('search') ?? '';

  let query = supabase
    .from('kb_documents')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false });

  if (collection) {
    query = query.eq('collection', collection);
  }
  if (status === 'active') {
    query = query.eq('is_active', true);
  } else if (status === 'inactive') {
    query = query.eq('is_active', false);
  }
  if (search) {
    query = query.or(`title_ar.ilike.%${search}%,title_en.ilike.%${search}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents: data ?? [], total: count ?? 0 });
}

/** POST /api/admin/kb — create document + trigger embed */
export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin only.' }, { status: 403 });
  }

  const supabase = createAdminClient();
  const body = await request.json();

  if (!body['title_ar'] || !body['content_ar']) {
    return NextResponse.json(
      { error: 'title_ar and content_ar are required.' },
      { status: 400 }
    );
  }

  if (!body['collection']) {
    return NextResponse.json(
      { error: 'collection is required.' },
      { status: 400 }
    );
  }

  // Validate metadata JSON
  let metadata = {};
  if (body['metadata']) {
    try {
      metadata = typeof body['metadata'] === 'string' ? JSON.parse(body['metadata']) : body['metadata'];
    } catch {
      return NextResponse.json({ error: 'Invalid metadata JSON.' }, { status: 400 });
    }
  }

  const { data: doc, error } = await supabase
    .from('kb_documents')
    .insert({
      collection: body['collection'],
      title_ar: body['title_ar'],
      title_en: body['title_en'] ?? null,
      content_ar: body['content_ar'],
      content_en: body['content_en'] ?? null,
      metadata,
      is_active: body['is_active'] ?? true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Trigger embedding
  const embedResult = await embedDocument(doc.id);

  return NextResponse.json({
    document: doc,
    embedding: embedResult,
  }, { status: 201 });
}
