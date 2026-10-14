import { NextRequest, NextResponse } from 'next/server';
import { authenticateDoctorAccount, getDoctorServiceClient } from '@/lib/auth/doctor-account';

export const dynamic = 'force-dynamic';

const T = {
  unauthorized: { ar: 'غير مصرح. يرجى تسجيل الدخول', en: 'Not signed in' },
  notFound: { ar: 'الإجازة دي مش موجودة', en: 'Time off not found' },
  failed: { ar: 'حدث خطأ غير متوقع', en: 'Something went wrong, please try again' },
} as const;

/** DELETE /api/doctor/time-off/[id] — remove the doctor's own block; its slots reappear. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'ar';
  const { id } = await params;

  const account = await authenticateDoctorAccount(request, { requireVerified: true });
  if (!account || !account.doctor_id) {
    return NextResponse.json({ error: T.unauthorized[locale] }, { status: 401 });
  }

  const { data, error } = await getDoctorServiceClient()
    .from('doctor_time_off')
    .delete()
    .eq('id', id)
    .eq('doctor_id', account.doctor_id)
    .select('id');

  if (error) {
    console.error('[doctor/time-off] delete failed:', error.message);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: T.notFound[locale] }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
