import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

type ClinicMode = 'independent' | 'own_clinic' | 'existing_clinic';

interface RegisterBody {
  name_ar: string;
  syndicate_number: string;
  // Canonical names, with the register form's aliases accepted alongside.
  specialty_ar?: string;
  specialty?: string;
  governorate_id?: string;
  governorate?: string;
  clinic_name_ar?: string;
  clinic_name?: string;
  phone: string;
  email: string;
  password: string;
  clinic_mode?: ClinicMode;
  requested_clinic_name_en?: string;
  requested_clinic_address_ar?: string;
  requested_tenant_id?: string;
}

function validateBody(body: RegisterBody): string | null {
  if (!body.name_ar || body.name_ar.trim().length === 0) {
    return 'الاسم مطلوب';
  }

  if (!body.syndicate_number || !/^\d{4,8}$/.test(body.syndicate_number)) {
    return 'رقم النقابة يجب أن يكون من ٤ إلى ٨ أرقام';
  }

  if (!body.phone || !/^01[0125]\d{8}$/.test(body.phone)) {
    return 'رقم الهاتف غير صحيح. يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015 ويكون ١١ رقم';
  }

  if (!body.password || body.password.length < 8) {
    return 'كلمة المرور يجب أن تكون ٨ أحرف على الأقل';
  }

  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return 'البريد الإلكتروني غير صحيح';
  }

  const mode: ClinicMode = body.clinic_mode ?? 'independent';
  if (!['independent', 'own_clinic', 'existing_clinic'].includes(mode)) {
    return 'نوع العيادة غير صحيح';
  }
  if (mode === 'own_clinic' && !(body.clinic_name_ar ?? body.clinic_name)?.trim()) {
    return 'اسم العيادة مطلوب';
  }
  if (mode === 'existing_clinic' && !body.requested_tenant_id) {
    return 'اختر المنشأة اللي بتشتغل فيها';
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RegisterBody;

    const validationError = validateBody(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const supabase = getServiceClient();
    const clinicMode: ClinicMode = body.clinic_mode ?? 'independent';
    const specialtyAr = (body.specialty_ar ?? body.specialty)?.trim() || null;
    const clinicNameAr = (body.clinic_name_ar ?? body.clinic_name)?.trim() || null;

    // The form sends the governorate as an Arabic name; older clients may send
    // the id directly. Resolve either to a governorate_id.
    let governorateId: string | null = body.governorate_id || null;
    if (!governorateId && body.governorate) {
      const { data: gov } = await supabase
        .from('governorates')
        .select('id')
        .or(`name_ar.eq.${body.governorate},name_en.eq.${body.governorate}`)
        .limit(1)
        .single();
      governorateId = gov?.id ?? null;
    }

    // Joining an existing facility: it must be a real, active medical tenant.
    if (clinicMode === 'existing_clinic') {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, tier, is_active')
        .eq('id', body.requested_tenant_id)
        .single();
      if (!tenant || !tenant.is_active || !['clinic', 'basic', 'premium'].includes(tenant.tier)) {
        return NextResponse.json({ error: 'المنشأة المختارة غير متاحة' }, { status: 400 });
      }
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes('already been registered') || authError.message.includes('already exists')) {
        return NextResponse.json(
          { error: 'البريد الإلكتروني مسجل بالفعل' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'حدث خطأ أثناء إنشاء الحساب' },
        { status: 500 }
      );
    }

    const userId = authData.user.id;

    const baseRow = {
      id: userId,
      name_ar: body.name_ar.trim(),
      syndicate_number: body.syndicate_number,
      specialty_ar: specialtyAr,
      governorate_id: governorateId,
      clinic_name_ar: clinicNameAr,
      phone: body.phone,
      email: body.email,
      verification_status: 'pending',
    };

    const clinicIntent = {
      clinic_mode: clinicMode,
      requested_clinic_name_en: body.requested_clinic_name_en?.trim() || null,
      requested_clinic_address_ar: body.requested_clinic_address_ar?.trim() || null,
      requested_tenant_id: clinicMode === 'existing_clinic' ? body.requested_tenant_id : null,
    };

    let { data: doctorAccount, error: insertError } = await supabase
      .from('doctor_accounts')
      .insert({ ...baseRow, ...clinicIntent })
      .select()
      .single();

    // Graceful degradation until migration 064 is applied live: retry without
    // the clinic-intent columns rather than failing the whole registration.
    if (insertError && /column|clinic_mode|requested_/.test(insertError.message)) {
      console.warn('[doctor/register] clinic-intent columns missing (apply migration 064):', insertError.message);
      ({ data: doctorAccount, error: insertError } = await supabase
        .from('doctor_accounts')
        .insert(baseRow)
        .select()
        .single());
    }

    if (insertError) {
      // Clean up the auth user if doctor_accounts insert fails
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء تسجيل بيانات الطبيب' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'تم التسجيل بنجاح. حسابك قيد المراجعة.',
        doctorAccount,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}
