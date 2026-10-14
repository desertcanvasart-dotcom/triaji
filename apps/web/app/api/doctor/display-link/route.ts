import { NextRequest, NextResponse } from 'next/server';
import { authenticateDoctorWorkspace } from '@/lib/auth/doctor-account';
import { createDisplayToken } from '@/lib/display-token';

export const dynamic = 'force-dynamic';

/** GET /api/doctor/display-link?locale= — the signed-in doctor's waiting-room screen URL. */
export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'ar';
  const account = await authenticateDoctorWorkspace(request);
  if (!account || !account.doctor_id) {
    return NextResponse.json({ error: locale === 'en' ? 'Not signed in' : 'غير مصرح' }, { status: 401 });
  }

  return NextResponse.json({ path: `/${locale}/display/${createDisplayToken(account.doctor_id)}` });
}
