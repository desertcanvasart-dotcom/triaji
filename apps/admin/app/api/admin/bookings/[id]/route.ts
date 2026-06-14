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
      doctors!inner(id, name_ar, name_en, title_ar, title_en, photo_url, specialty_id, specialties!inner(name_en, name_ar)),
      triage_sessions(
        id, chief_complaint, determined_specialty, urgency_level,
        extracted_symptoms, created_at,
        session_messages(id, role, content, image_urls, created_at)
      )
    `)
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  }

  return NextResponse.json({ booking: data });
}
