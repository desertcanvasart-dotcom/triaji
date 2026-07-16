import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

interface QuickIntakeBody {
  sex: 'male' | 'female';
  age: number;
  is_smoker: boolean;
  conditions: string[];
  symptoms_text: string;
}

interface TriageResult {
  urgency: 'emergency' | 'urgent' | 'routine';
  specialty_ar: string;
  risk_factors: string[];
  summary_ar: string;
  suggested_next_steps: string[];
  red_flags: string[];
}

const QUICK_INTAKE_SYSTEM_PROMPT = `أنت نظام فرز طبي متخصص. سيعطيك الطبيب معلومات مريضه مباشرة.
مهمتك: تحليل هذه المعلومات وإعطاء تقييم طبي منظم في رد واحد.

لا تطرح أسئلة. حلل ما هو موجود وأعط نتيجة واضحة.

أعط النتيجة بتنسيق JSON فقط بدون أي نص إضافي:
{
  "urgency": "emergency|urgent|routine",
  "specialty_ar": "اسم التخصص بالعربي",
  "risk_factors": ["عامل خطورة 1", "عامل خطورة 2"],
  "summary_ar": "ملخص الحالة للطبيب في 2-3 جمل",
  "suggested_next_steps": ["خطوة 1", "خطوة 2"],
  "red_flags": ["أي علامات خطيرة إن وجدت — اتركها فارغة لو مفيش"]
}`;

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

async function authenticateDoctor(request: NextRequest) {
  const accessToken =
    request.cookies.get('sb-access-token')?.value ??
    request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!accessToken) return null;

  const anonClient = getAnonClient();
  const { data: { user }, error } = await anonClient.auth.getUser(accessToken);
  if (error || !user) return null;

  const supabase = getServiceClient();
  const { data: doctorAccount } = await supabase
    .from('doctor_accounts')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!doctorAccount || doctorAccount.verification_status !== 'verified') return null;
  return doctorAccount;
}

function buildPatientDescription(body: QuickIntakeBody): string {
  const sexAr = body.sex === 'male' ? 'ذكر' : 'أنثى';
  const smokerAr = body.is_smoker ? 'مدخن' : 'غير مدخن';

  const conditionsMap: Record<string, string> = {
    blood_pressure: 'ضغط دم',
    diabetes: 'سكري',
    heart: 'أمراض قلب',
  };

  const conditionsAr = body.conditions.length > 0
    ? body.conditions.map((c) => conditionsMap[c] ?? c).join('، ')
    : 'لا يوجد أمراض مزمنة';

  return `بيانات المريض:
- الجنس: ${sexAr}
- العمر: ${body.age} سنة
- التدخين: ${smokerAr}
- أمراض مزمنة: ${conditionsAr}

الأعراض التي يشكو منها:
${body.symptoms_text}`;
}

/** POST /api/doctor/quick-intake — single-pass triage analysis */
export async function POST(request: NextRequest) {
  const doctorAccount = await authenticateDoctor(request);
  if (!doctorAccount) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  const body: QuickIntakeBody = await request.json();

  // Validate
  if (!body.symptoms_text || body.symptoms_text.trim().length < 5) {
    return NextResponse.json(
      { error: 'يرجى كتابة وصف الأعراض (5 حروف على الأقل)' },
      { status: 400 }
    );
  }

  if (!body.age || body.age < 0 || body.age > 150) {
    return NextResponse.json(
      { error: 'يرجى إدخال عمر صحيح' },
      { status: 400 }
    );
  }

  const anthropicKey = process.env['ANTHROPIC_API_KEY'];
  if (!anthropicKey) {
    return NextResponse.json(
      { error: 'خطأ في إعدادات الخادم' },
      { status: 500 }
    );
  }

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const patientDescription = buildPatientDescription(body);

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      system: QUICK_INTAKE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: patientDescription,
        },
      ],
    });

    const responseText =
      message.content[0]?.type === 'text' ? message.content[0].text : '';

    // Parse JSON from response (handle potential markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'خطأ في تحليل النتيجة' },
        { status: 500 }
      );
    }

    const result: TriageResult = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ result });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Quick intake error:', errorMessage);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء التحليل. يرجى المحاولة مرة أخرى.' },
      { status: 500 }
    );
  }
}
