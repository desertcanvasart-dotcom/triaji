import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface ReviewBody {
  status?: 'approved' | 'rejected' | 'pending';
  review_note?: string | null;
}

/**
 * PATCH /api/admin/doctor-verification/[id]/documents/[docId]
 * Approve or reject a single document, so a reviewer can ask for one bad scan
 * again instead of rejecting the whole registration.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin access required.' }, { status: 403 });
  }

  let body: ReviewBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.status || !['approved', 'rejected', 'pending'].includes(body.status)) {
    return NextResponse.json(
      { error: 'status must be approved, rejected or pending.' },
      { status: 400 }
    );
  }

  const note = body.review_note?.trim() || null;
  if (body.status === 'rejected' && !note) {
    return NextResponse.json(
      { error: 'A reason is required when rejecting a document — the doctor sees it.' },
      { status: 400 }
    );
  }

  const { id, docId } = await params;
  const supabase = createAdminClient();

  // Scoped to the registration in the URL so a doc id alone can't be flipped.
  const { data: updated, error } = await supabase
    .from('doctor_documents')
    .update({
      status: body.status,
      review_note: body.status === 'rejected' ? note : null,
      reviewed_by: authResult.admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', docId)
    .eq('doctor_account_id', id)
    .select('id, doc_type, status, review_note, reviewed_at')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, document: updated });
}
