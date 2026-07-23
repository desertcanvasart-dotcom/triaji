import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Create a clinic tenant (+ default config + clinic_owner admin access) for a
 * doctor who registered with clinic_mode 'own_clinic'. Returns the tenant id.
 */
async function provisionClinicTenant(
  supabase: SupabaseClient,
  doctorAccount: {
    id: string;
    name_ar: string;
    email: string | null;
    syndicate_number: string;
    clinic_name_ar: string | null;
    requested_clinic_name_en?: string | null;
  }
): Promise<{ tenantId: string } | { error: string }> {
  const nameAr = doctorAccount.clinic_name_ar ?? `عيادة ${doctorAccount.name_ar}`;
  const nameEn = doctorAccount.requested_clinic_name_en ?? `Dr. ${doctorAccount.syndicate_number} Clinic`;

  let base = slugify(nameEn);
  if (!base) base = `clinic-${doctorAccount.syndicate_number}`;

  // Find a free slug: base, base-2, base-3, …
  let slug = base;
  for (let i = 2; i <= 10; i++) {
    const { data: taken } = await supabase.from('tenants').select('id').eq('slug', slug).maybeSingle();
    if (!taken) break;
    slug = `${base}-${i}`;
  }

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({ name_ar: nameAr, name_en: nameEn, slug, tier: 'clinic', is_active: true })
    .select('id')
    .single();

  if (tenantError || !tenant) {
    return { error: `Clinic tenant creation failed: ${tenantError?.message}` };
  }

  await supabase.from('tenant_config').insert({
    tenant_id: tenant.id,
    primary_color: '#0D7A7A',
    welcome_message_ar: 'أهلاً بيك في ترياچي! أنا هنا أساعدك تلاقي الدكتور المناسب.',
    booking_mode: 'native',
  });

  // Same login gets clinic-owner access to the admin panel.
  const { error: adminUserError } = await supabase.from('admin_users').upsert(
    {
      id: doctorAccount.id,
      tenant_id: tenant.id,
      role: 'clinic_owner',
      name: doctorAccount.name_ar,
      email: doctorAccount.email ?? '',
      is_active: true,
    },
    { onConflict: 'id' }
  );

  if (adminUserError) {
    return { error: `Clinic created (${slug}) but admin access failed: ${adminUserError.message}` };
  }

  return { tenantId: tenant.id };
}

/** POST /api/admin/doctor-verification/[id]/approve — verify a doctor */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { admin } = authResult;
  if (admin.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Platform admin access required.' },
      { status: 403 }
    );
  }

  const { id } = await params;
  const supabase = createAdminClient();

  // Fetch the doctor account
  const { data: doctorAccount, error: fetchError } = await supabase
    .from('doctor_accounts')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !doctorAccount) {
    return NextResponse.json(
      { error: 'Doctor account not found.' },
      { status: 404 }
    );
  }

  if (doctorAccount.verification_status === 'verified') {
    return NextResponse.json(
      { error: 'Doctor is already verified.' },
      { status: 400 }
    );
  }

  // Update status to verified
  const { error: updateError } = await supabase
    .from('doctor_accounts')
    .update({
      verification_status: 'verified',
      verified_at: new Date().toISOString(),
      verified_by: admin.id,
      rejection_reason: null,
    })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    );
  }

  // If self-registered, create a matching doctors record
  let clinicNote = '';
  if (doctorAccount.self_registered && !doctorAccount.doctor_id) {
    // Resolve the clinic intent declared at registration (columns exist once
    // migration 064 is applied; undefined reads as 'independent' before that).
    const clinicMode: string = doctorAccount.clinic_mode ?? 'independent';
    let tenantId: string | null = null;

    if (clinicMode === 'own_clinic') {
      const provisioned = await provisionClinicTenant(supabase, doctorAccount);
      if ('error' in provisioned) {
        return NextResponse.json(
          { error: `Doctor verified, but: ${provisioned.error}` },
          { status: 500 }
        );
      }
      tenantId = provisioned.tenantId;
      clinicNote = ' Clinic tenant created with admin access for the doctor.';
    } else if (clinicMode === 'existing_clinic' && doctorAccount.requested_tenant_id) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, is_active')
        .eq('id', doctorAccount.requested_tenant_id)
        .single();
      if (tenant?.is_active) {
        tenantId = tenant.id;
        clinicNote = ' Doctor linked to the requested facility.';
      }
    }

    // Look up specialty_id from the Arabic or English name (the English
    // register form submits English specialty names).
    const { data: specialty } = await supabase
      .from('specialties')
      .select('id')
      .or(`name_ar.eq.${doctorAccount.specialty_ar},name_en.eq.${doctorAccount.specialty_ar}`)
      .limit(1)
      .maybeSingle();

    const { data: newDoctor, error: doctorError } = await supabase
      .from('doctors')
      .insert({
        tenant_id: tenantId,
        name_ar: doctorAccount.name_ar,
        name_en: doctorAccount.name_en,
        specialty_id: specialty?.id,
        governorate_id: doctorAccount.governorate_id,
        clinic_address_ar: doctorAccount.requested_clinic_address_ar ?? doctorAccount.clinic_name_ar,
        is_active: true,
        accepting_new_patients: true,
        available_for_booking: true,
      })
      .select('id')
      .single();

    if (newDoctor) {
      await supabase
        .from('doctor_accounts')
        .update({ doctor_id: newDoctor.id })
        .eq('id', id);
    } else {
      // doctors.specialty_id / governorate_id are NOT NULL — an unmatched
      // specialty name or a registration without a governorate lands here.
      // The account is verified either way; tell the admin the bookable
      // profile still needs manual creation instead of failing silently.
      clinicNote += ` WARNING: bookable doctor profile was NOT created (${
        doctorError?.message ?? 'unknown error'
      }) — likely an unmatched specialty ("${doctorAccount.specialty_ar}") or missing governorate. Create the doctors record manually.`;
    }
  }

  return NextResponse.json({ success: true, message: `Doctor verified successfully.${clinicNote}` });
}
