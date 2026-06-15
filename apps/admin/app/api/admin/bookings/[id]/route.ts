import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/bookings/[id] — full booking detail including session */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      doctors!inner(id, name_ar, name_en, title_ar, photo_url, specialty_id, specialties!inner(name_en, name_ar)),
      triage_sessions!fk_session_booking(
        id, chief_complaint_ar, determined_specialty_id, urgency_level,
        extracted_symptoms, session_start,
        session_messages(id, role, content_ar, image_urls, created_at)
      )
    `)
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  }

  return NextResponse.json({ booking: data });
}
