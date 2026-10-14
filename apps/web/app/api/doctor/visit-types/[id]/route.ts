import { NextRequest, NextResponse } from 'next/server';
import { authenticateDoctorAccount, getDoctorServiceClient } from '@/lib/auth/doctor-account';
import { toVisitType } from '@/lib/doctor/visit-types';

export const dynamic = 'force-dynamic';

/**
 * PATCH  /api/doctor/visit-types/[id] — { name?, price_egp?, duration_minutes?, is_default? }
 * DELETE /api/doctor/visit-types/[id] — slots, walk-ins and invoices that used it
 *        keep their data; their link is cleared (ON DELETE SET NULL).
 * Doctor only.
 */

const T = {
  unauthorized: { ar: 'غير مصرح. يرجى تسجيل الدخول', en: 'Not signed in' },
  notFound: { ar: 'نوع الكشف ده مش موجود', en: 'Visit type not found' },
  name: { ar: 'اكتب اسم نوع الكشف', en: 'Name the visit type' },
  price: { ar: 'السعر لازم يكون رقم موجب', en: 'Price must be a positive number' },
  duration: { ar: 'المدة لازم تكون بين 5 و 240 دقيقة', en: 'Duration must be between 5 and 240 minutes' },
  failed: { ar: 'حدث خطأ غير متوقع', en: 'Something went wrong, please try again' },
} as const;

async function ownType(request: NextRequest, id: string) {
  const account = await authenticateDoctorAccount(request, { requireVerified: true });
  if (!account || !account.doctor_id) return { account: null, type: null };
  const { data: type } = await getDoctorServiceClient()
    .from('doctor_visit_types')
    .select('id, is_default')
    .eq('id', id)
    .eq('doctor_id', account.doctor_id)
    .maybeSingle();
  return { account, type };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let locale: 'ar' | 'en' = 'ar';
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    locale = body.locale === 'en' ? 'en' : 'ar';

    const { account, type } = await ownType(request, id);
    if (!account) return NextResponse.json({ error: T.unauthorized[locale] }, { status: 401 });
    if (!type) return NextResponse.json({ error: T.notFound[locale] }, { status: 404 });

    const update: Record<string, unknown> = {};
    if ('name' in body) {
      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 60) : '';
      if (!name) return NextResponse.json({ error: T.name[locale] }, { status: 400 });
      update.name = name;
    }
    if ('price_egp' in body) {
      const price = body.price_egp === '' || body.price_egp == null ? null : Number(body.price_egp);
      if (price !== null && (!Number.isFinite(price) || price < 0)) {
        return NextResponse.json({ error: T.price[locale] }, { status: 400 });
      }
      update.price_egp = price === null ? null : Math.round(price * 100) / 100;
    }
    if ('duration_minutes' in body) {
      const d = Number(body.duration_minutes);
      if (!Number.isInteger(d) || d < 5 || d > 240) return NextResponse.json({ error: T.duration[locale] }, { status: 400 });
      update.duration_minutes = d;
    }

    const supabase = getDoctorServiceClient();
    if (body.is_default === true) {
      await supabase
        .from('doctor_visit_types')
        .update({ is_default: false })
        .eq('doctor_id', account.doctor_id as string)
        .eq('is_default', true);
      update.is_default = true;
    }

    const { data, error } = await supabase.from('doctor_visit_types').update(update).eq('id', id).select('*').single();
    if (error) {
      console.error('[visit-types] update failed:', error.message);
      return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
    }
    return NextResponse.json({ visit_type: toVisitType(data as Record<string, unknown>) });
  } catch (err) {
    console.error('[visit-types] PATCH failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'ar';
  const { id } = await params;
  const { account, type } = await ownType(request, id);
  if (!account) return NextResponse.json({ error: T.unauthorized[locale] }, { status: 401 });
  if (!type) return NextResponse.json({ error: T.notFound[locale] }, { status: 404 });

  const supabase = getDoctorServiceClient();
  const { error } = await supabase.from('doctor_visit_types').delete().eq('id', id);
  if (error) {
    console.error('[visit-types] delete failed:', error.message);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }

  // Keep exactly one default when the default goes away.
  if (type.is_default) {
    const { data: next } = await supabase
      .from('doctor_visit_types')
      .select('id')
      .eq('doctor_id', account.doctor_id as string)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next) await supabase.from('doctor_visit_types').update({ is_default: true }).eq('id', next.id);
  }

  return NextResponse.json({ success: true });
}
