import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function getAnonClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

interface DoctorAccountRow {
  id: string;
  doctor_id: string | null;
  name_ar: string;
  email: string | null;
  syndicate_number: string;
  verification_status: string;
}

async function authenticateDoctor(request: NextRequest): Promise<DoctorAccountRow | null> {
  const accessToken = request.cookies.get('sb-access-token')?.value
    ?? request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!accessToken) return null;

  const anonClient = getAnonClient();
  const { data: { user }, error } = await anonClient.auth.getUser(accessToken);
  if (error || !user) return null;

  const supabase = getServiceClient();
  const { data: doctorAccount } = await supabase
    .from('doctor_accounts')
    .select('id, doctor_id, name_ar, email, syndicate_number, verification_status')
    .eq('id', user.id)
    .single();

  if (!doctorAccount || doctorAccount.verification_status !== 'verified') return null;
  return doctorAccount as DoctorAccountRow;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function currentClinic(supabase: SupabaseClient, doctorId: string | null) {
  if (!doctorId) return null;
  const { data: doctor } = await supabase
    .from('doctors')
    .select('tenant_id')
    .eq('id', doctorId)
    .single();
  if (!doctor?.tenant_id) return null;
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name_ar, name_en, slug, tier')
    .eq('id', doctor.tenant_id)
    .single();
  return tenant ?? null;
}

/** GET /api/doctor/clinic — the verified doctor's current facility, if any */
export async function GET(request: NextRequest) {
  const account = await authenticateDoctor(request);
  if (!account) {
    return NextResponse.json({ error: 'غير مسجل' }, { status: 401 });
  }
  const supabase = getServiceClient();
  const clinic = await currentClinic(supabase, account.doctor_id);
  return NextResponse.json({ clinic, canCreate: !clinic && !!account.doctor_id });
}

/**
 * POST /api/doctor/clinic — create the doctor's own clinic tenant.
 * Body: { clinic_name_ar: string, clinic_name_en?: string, address_ar?: string }
 *
 * Provisions a clinic tenant + default config, grants this login clinic_owner
 * access to the admin panel, and attaches the doctor's bookable profile to it.
 */
export async function POST(request: NextRequest) {
  const account = await authenticateDoctor(request);
  if (!account) {
    return NextResponse.json({ error: 'غير مسجل' }, { status: 401 });
  }
  if (!account.doctor_id) {
    return NextResponse.json({ error: 'حسابك لسه مش مرتبط بملف طبيب' }, { status: 400 });
  }

  let body: { clinic_name_ar?: string; clinic_name_en?: string; address_ar?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const nameAr = body.clinic_name_ar?.trim();
  if (!nameAr) {
    return NextResponse.json({ error: 'اسم العيادة مطلوب' }, { status: 400 });
  }

  const supabase = getServiceClient();

  const existing = await currentClinic(supabase, account.doctor_id);
  if (existing) {
    return NextResponse.json({ error: 'أنت مرتبط بمنشأة بالفعل', clinic: existing }, { status: 409 });
  }

  const nameEn = body.clinic_name_en?.trim() || `Dr. ${account.syndicate_number} Clinic`;
  let base = slugify(nameEn);
  if (!base) base = `clinic-${account.syndicate_number}`;

  let slug = base;
  for (let i = 2; i <= 10; i++) {
    const { data: taken } = await supabase.from('tenants').select('id').eq('slug', slug).maybeSingle();
    if (!taken) break;
    slug = `${base}-${i}`;
  }

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({ name_ar: nameAr, name_en: nameEn, slug, tier: 'clinic', is_active: true })
    .select('id, name_ar, name_en, slug, tier')
    .single();

  if (tenantError || !tenant) {
    return NextResponse.json({ error: `تعذر إنشاء العيادة: ${tenantError?.message}` }, { status: 500 });
  }

  await supabase.from('tenant_config').insert({
    tenant_id: tenant.id,
    primary_color: '#0D7A7A',
    welcome_message_ar: 'أهلاً بيك في دكتور تريو! أنا هنا أساعدك تلاقي الدكتور المناسب.',
    booking_mode: 'native',
  });

  const { error: adminUserError } = await supabase.from('admin_users').upsert(
    {
      id: account.id,
      tenant_id: tenant.id,
      role: 'clinic_owner',
      name: account.name_ar,
      email: account.email ?? '',
      is_active: true,
    },
    { onConflict: 'id' }
  );

  if (adminUserError) {
    return NextResponse.json(
      { error: `اتعملت العيادة لكن حصل خطأ في صلاحيات الإدارة: ${adminUserError.message}` },
      { status: 500 }
    );
  }

  await supabase
    .from('doctors')
    .update({
      tenant_id: tenant.id,
      ...(body.address_ar?.trim() ? { clinic_address_ar: body.address_ar.trim() } : {}),
    })
    .eq('id', account.doctor_id);

  // Record the mode on the account too. PostgREST reports a missing column as
  // a result error, not a throw — ignored until migration 064 is live.
  await supabase.from('doctor_accounts').update({ clinic_mode: 'own_clinic' }).eq('id', account.id);

  return NextResponse.json({ success: true, clinic: tenant }, { status: 201 });
}
