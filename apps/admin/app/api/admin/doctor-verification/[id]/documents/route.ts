import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const BUCKET = 'doctor-documents';
const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes — long enough to review, short enough not to leak

/**
 * GET /api/admin/doctor-verification/[id]/documents
 * The registration's uploaded documents, each with a short-lived signed URL.
 * These are national IDs and syndicate cards, so the bucket stays private and
 * URLs are minted per request rather than stored.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.admin.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Platform admin access required.' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: documents, error } = await supabase
    .from('doctor_documents')
    .select('id, doc_type, storage_path, file_name, mime_type, size_bytes, status, review_note, uploaded_at, reviewed_at')
    .eq('doctor_account_id', id)
    .order('uploaded_at', { ascending: false });

  if (error) {
    // The table only exists once migration 068 is applied.
    if (/doctor_documents/.test(error.message)) {
      console.warn('[doctor-verification/documents] table missing (apply migration 068):', error.message);
      return NextResponse.json({ documents: [], migration_pending: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const withUrls = await Promise.all(
    (documents ?? []).map(async (doc) => {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(doc.storage_path as string, SIGNED_URL_TTL_SECONDS);
      return { ...doc, url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ documents: withUrls });
}
