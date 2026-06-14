import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

interface RegisterBody {
  name_ar: string;
  syndicate_number: string;
  specialty_ar: string;
  governorate_id: string;
  clinic_name_ar: string;
  phone: string;
  email: string;
  password: string;
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

    const { data: doctorAccount, error: insertError } = await supabase
      .from('doctor_accounts')
      .insert({
        user_id: userId,
        name_ar: body.name_ar.trim(),
        syndicate_number: body.syndicate_number,
        specialty_ar: body.specialty_ar?.trim() || null,
        governorate_id: body.governorate_id || null,
        clinic_name_ar: body.clinic_name_ar?.trim() || null,
        phone: body.phone,
        email: body.email,
        verification_status: 'pending',
      })
      .select()
      .single();

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
