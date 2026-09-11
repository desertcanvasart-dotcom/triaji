import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { redis } from '@/lib/cache/redis';
import { sendEmail } from '@triaji/shared/lib/email/client';

export const dynamic = 'force-dynamic';

/**
 * Public provider self-registration.
 *
 * Creates a PENDING facility (tenant `is_active=false`) plus a pending admin
 * user (`is_active=false`), so nothing self-activates — a platform admin
 * reviews and activates the tenant + user before the facility can sign in
 * (the admin auth gate requires `admin_users.is_active = true`). Mirrors the
 * doctor self-registration flow: service-role writes, rollback on failure, and
 * a Resend acknowledgement email.
 */

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

type FacilityType = 'hospital' | 'clinic' | 'lab' | 'radiology' | 'pharmacy' | 'insurance';

/** facility type → tenant tier + the admin role that lands in the right panel */
const TYPE_MAP: Record<FacilityType, { tier: string; role: string }> = {
  hospital:  { tier: 'basic',     role: 'tenant_admin' },
  clinic:    { tier: 'clinic',    role: 'clinic_owner' },
  lab:       { tier: 'lab',       role: 'lab_owner' },
  radiology: { tier: 'radiology', role: 'lab_owner' },
  pharmacy:  { tier: 'pharmacy',  role: 'pharmacy_owner' },
  insurance: { tier: 'insurance', role: 'insurance_admin' },
};

interface Body {
  facility_name?: string;
  facility_type?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  governorate_id?: string;
  password?: string;
  locale?: 'ar' | 'en';
}

const RATE_SECONDS = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `provider-${Math.random().toString(36).slice(2, 8)}`;
}

function ackHtml(locale: 'ar' | 'en', name: string, facility: string): string {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const body =
    locale === 'ar'
      ? `<p>أهلاً ${name}،</p>
         <p>استلمنا طلب تسجيل <strong>${facility}</strong> في دكتور تريو. فريقنا هيراجع الطلب ويفعّل حسابك خلال 24 ساعة.</p>
         <p>بعد التفعيل هتقدر تسجّل دخولك على لوحة التحكم بنفس البريد وكلمة المرور اللي سجّلت بيهم.</p>`
      : `<p>Hi ${name},</p>
         <p>We received the registration request for <strong>${facility}</strong> on DoctorTrio. Our team will review it and activate your account within 24 hours.</p>
         <p>Once activated, you can sign in to your dashboard with the email and password you registered.</p>`;
  return `<div dir="${dir}" style="font-family:Tahoma,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1A2F4A;line-height:1.7">
  <h2 style="color:#0d9488;margin:0 0 16px">دكتور تريو</h2>
  ${body}
  <p style="margin-top:24px;font-size:12px;color:#94a3b8">${locale === 'ar' ? 'رسالة تلقائية من منصة دكتور تريو.' : 'This is an automated message from the DoctorTrio platform.'}</p>
</div>`;
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const locale = body.locale === 'en' ? 'en' : 'ar';
  const t = (ar: string, en: string) => (locale === 'en' ? en : ar);

  const facilityName = (body.facility_name ?? '').trim();
  const contactName = (body.contact_name ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const phone = (body.phone ?? '').trim();
  const password = body.password ?? '';
  const type = body.facility_type as FacilityType;

  if (facilityName.length < 3) return NextResponse.json({ error: t('اسم المؤسسة مطلوب', 'Facility name is required') }, { status: 400 });
  if (!type || !TYPE_MAP[type]) return NextResponse.json({ error: t('اختر نوع المؤسسة', 'Choose a facility type') }, { status: 400 });
  if (!contactName) return NextResponse.json({ error: t('اسم المسؤول مطلوب', 'Contact name is required') }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: t('البريد الإلكتروني غير صحيح', 'Invalid email address') }, { status: 400 });
  if (!/^01[0-9]{9}$/.test(phone)) return NextResponse.json({ error: t('رقم موبايل مصري غير صحيح', 'Invalid Egyptian phone number') }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: t('كلمة المرور 8 أحرف على الأقل', 'Password must be at least 8 characters') }, { status: 400 });

  // Rate-limit per email
  const rlKey = `provider-register:${email}`;
  if (await redis.get(rlKey)) {
    return NextResponse.json({ error: t('استنى دقيقة وحاول تاني', 'Please wait a minute and try again') }, { status: 429 });
  }
  await redis.set(rlKey, '1', { ex: RATE_SECONDS });

  const { tier, role } = TYPE_MAP[type];
  const supabase = getServiceClient();

  // Unique slug
  let slug = slugify(facilityName);
  for (let i = 0; i < 5; i++) {
    const { data: exists } = await supabase.from('tenants').select('id').eq('slug', slug).maybeSingle();
    if (!exists) break;
    slug = `${slugify(facilityName)}-${Math.random().toString(36).slice(2, 5)}`;
  }

  // Pending tenant
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({ name_ar: facilityName, name_en: facilityName, slug, tier, is_active: false })
    .select()
    .single();
  if (tenantError || !tenant) {
    return NextResponse.json({ error: t('حصل خطأ، حاول تاني', 'Something went wrong, please try again') }, { status: 500 });
  }

  // tenant_config (governorate is best-effort to survive schema drift)
  const cfgBase: Record<string, unknown> = { tenant_id: tenant.id, primary_color: '#0D7A7A', booking_mode: 'native' };
  const { error: cfgError } = await supabase
    .from('tenant_config')
    .insert({ ...cfgBase, default_governorate_id: body.governorate_id || null });
  if (cfgError) {
    await supabase.from('tenant_config').insert(cfgBase);
  }

  // Auth user (email pre-confirmed so Supabase sends nothing)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: contactName, provider_registration: true },
  });
  if (authError || !authData?.user) {
    await supabase.from('tenant_config').delete().eq('tenant_id', tenant.id);
    await supabase.from('tenants').delete().eq('id', tenant.id);
    // Existing email → generic success (don't reveal whether an account exists)
    if (/already.*registered|already.*exists|email.*taken/i.test(authError?.message ?? '')) {
      return NextResponse.json({ success: true, pending: true });
    }
    return NextResponse.json({ error: t('حصل خطأ، حاول تاني', 'Something went wrong, please try again') }, { status: 500 });
  }
  const userId = authData.user.id;

  // Pending admin user — is_active=false blocks sign-in until a platform admin approves
  const adminBase = { id: userId, tenant_id: tenant.id, role, name: contactName, email, is_active: false };
  let { error: adminError } = await supabase.from('admin_users').insert({ ...adminBase, phone });
  if (adminError && /phone/.test(adminError.message)) {
    ({ error: adminError } = await supabase.from('admin_users').insert(adminBase));
  }
  if (adminError) {
    await supabase.auth.admin.deleteUser(userId).catch(() => undefined);
    await supabase.from('tenant_config').delete().eq('tenant_id', tenant.id);
    await supabase.from('tenants').delete().eq('id', tenant.id);
    return NextResponse.json({ error: adminError.message }, { status: 500 });
  }

  // Acknowledgement email (best-effort)
  await sendEmail({
    to: email,
    subject: t('استلمنا طلب تسجيل مؤسستك في دكتور تريو', 'We received your DoctorTrio facility registration'),
    html: ackHtml(locale, contactName, facilityName),
  }).catch(() => undefined);

  return NextResponse.json({ success: true, pending: true });
}
