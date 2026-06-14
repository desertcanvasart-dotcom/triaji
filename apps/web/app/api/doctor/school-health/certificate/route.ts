import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, PDFPage, PDFFont, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DoctorAccount {
  id: string;
  user_id: string;
  doctor_id: string;
  verification_status: 'pending' | 'verified' | 'rejected';
}

interface SchoolHealthRecord {
  id: string;
  patient_id: string;
  academic_year: string;
  school_name_ar: string | null;
  school_grade_ar: string | null;
  exam_date: string | null;
  examining_doctor: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  vision_right: string | null;
  vision_left: string | null;
  hearing_normal: boolean | null;
  dental_notes_ar: string | null;
  general_notes_ar: string | null;
  fit_for_school: boolean;
  restriction_ar: string | null;
}

// ─── Supabase Clients ───────────────────────────────────────────────────────

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

// ─── Auth ───────────────────────────────────────────────────────────────────

async function authenticateDoctor(request: NextRequest): Promise<DoctorAccount | null> {
  const accessToken =
    request.cookies.get('sb-access-token')?.value ??
    request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!accessToken) return null;

  const anonClient = getAnonClient();
  const {
    data: { user },
    error,
  } = await anonClient.auth.getUser(accessToken);
  if (error || !user) return null;

  const supabase = getServiceClient();
  const { data: doctorAccount } = await supabase
    .from('doctor_accounts')
    .select('id, user_id, doctor_id, verification_status')
    .eq('user_id', user.id)
    .single();

  if (!doctorAccount || doctorAccount.verification_status !== 'verified') return null;
  return doctorAccount as DoctorAccount;
}

// ─── PDF Constants ────────────────────────────────────────────────────────────

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 50;
const NAVY = rgb(0.102, 0.184, 0.290);
const TEAL = rgb(0.051, 0.478, 0.478);
const DARK_GRAY = rgb(0.2, 0.2, 0.2);
const LIGHT_GRAY = rgb(0.6, 0.6, 0.6);
const GREEN = rgb(0.06, 0.5, 0.25);
const AMBER = rgb(0.72, 0.5, 0.04);
const RED = rgb(0.7, 0.15, 0.15);

// ─── PDF Helpers ──────────────────────────────────────────────────────────────

/** Draws Arabic (or any) text right-aligned so it ends at x. */
function drawRtl(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = DARK_GRAY
): void {
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: x - textWidth, y, size, font, color });
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

// ─── POST /api/doctor/school-health/certificate?record_id=xxx ─────────────────
// Generates a school-health fitness certificate PDF for a saved record.
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate doctor
    const doctorAccount = await authenticateDoctor(request);
    if (!doctorAccount) {
      return NextResponse.json({ error: 'غير مصرح. يرجى تسجيل الدخول كطبيب' }, { status: 401 });
    }

    // 2. Resolve the record id (query string, with body fallback)
    let recordId = request.nextUrl.searchParams.get('record_id');
    if (!recordId) {
      const body = await request.json().catch(() => null);
      recordId = (body && (body.record_id as string | undefined)) ?? null;
    }
    if (!recordId) {
      return NextResponse.json({ error: 'record_id is required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // 3. Load the school health record
    const { data: record } = await supabase
      .from('school_health_records')
      .select(
        'id, patient_id, academic_year, school_name_ar, school_grade_ar, exam_date, examining_doctor, height_cm, weight_kg, vision_right, vision_left, hearing_normal, dental_notes_ar, general_notes_ar, fit_for_school, restriction_ar'
      )
      .eq('id', recordId)
      .single<SchoolHealthRecord>();

    if (!record) {
      return NextResponse.json({ error: 'School health record not found' }, { status: 404 });
    }

    // Patient name
    const { data: patient } = await supabase
      .from('patients')
      .select('name_ar')
      .eq('id', record.patient_id)
      .single();
    const patientName = (patient?.name_ar as string | null) ?? '—';

    // 4. Build the PDF
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const regularBytes = readFileSync(join(process.cwd(), 'public', 'fonts', 'Cairo-Regular.ttf'));
    const boldBytes = readFileSync(join(process.cwd(), 'public', 'fonts', 'Cairo-Bold.ttf'));
    const font = await pdfDoc.embedFont(regularBytes, { subset: false });
    const boldFont = await pdfDoc.embedFont(boldBytes, { subset: false });

    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN;
    const right = PAGE_WIDTH - MARGIN;

    // Title (Arabic, right-aligned) + English subtitle (left)
    drawRtl(page, 'شهادة لياقة صحية مدرسية', right, y, boldFont, 20, NAVY);
    page.drawText('School Health Fitness Certificate', { x: MARGIN, y: y - 22, size: 9, font, color: TEAL });
    drawRtl(page, 'منصة ترياچي الصحية', right, y - 22, font, 9, TEAL);
    y -= 44;

    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: right, y },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= 28;

    // Helper to draw a labelled row (Arabic label + value, right-aligned)
    const row = (label: string, value: string, valueColor = DARK_GRAY) => {
      drawRtl(page, label, right, y, boldFont, 11, NAVY);
      drawRtl(page, value, right - 170, y, font, 11, valueColor);
      y -= 22;
    };

    row('الاسم:', patientName);
    row('العام الدراسي:', record.academic_year ?? '—');
    row('المدرسة:', record.school_name_ar ?? '—');
    row('الصف الدراسي:', record.school_grade_ar ?? '—');
    row('تاريخ الكشف:', formatDate(record.exam_date));
    y -= 6;

    // Physical examination section
    drawRtl(page, 'الكشف البدني', right, y, boldFont, 13, TEAL);
    y -= 24;

    row('الطول (سم):', record.height_cm != null ? String(record.height_cm) : '—');
    row('الوزن (كجم):', record.weight_kg != null ? String(record.weight_kg) : '—');
    row('النظر — اليمنى:', record.vision_right ?? '—');
    row('النظر — اليسرى:', record.vision_left ?? '—');
    row(
      'السمع:',
      record.hearing_normal == null ? '—' : record.hearing_normal ? 'طبيعي' : 'يحتاج متابعة'
    );
    if (record.dental_notes_ar) row('ملاحظات الأسنان:', record.dental_notes_ar);
    if (record.general_notes_ar) row('ملاحظات عامة:', record.general_notes_ar);
    y -= 6;

    // Fitness assessment section
    drawRtl(page, 'تقييم اللياقة', right, y, boldFont, 13, TEAL);
    y -= 26;

    const fit = record.fit_for_school;
    const hasRestriction = fit && !!record.restriction_ar;
    const verdictText = !fit
      ? 'غير لائق للدراسة'
      : hasRestriction
        ? 'لائق للدراسة مع قيود'
        : 'لائق للدراسة';
    const verdictColor = !fit ? RED : hasRestriction ? AMBER : GREEN;

    page.drawRectangle({
      x: MARGIN,
      y: y - 8,
      width: PAGE_WIDTH - MARGIN * 2,
      height: 30,
      color: rgb(0.96, 0.96, 0.96),
    });
    drawRtl(page, verdictText, right - 10, y, boldFont, 14, verdictColor);
    y -= 38;

    if (record.restriction_ar) {
      const restrictionLabel = fit ? 'القيود:' : 'سبب عدم اللياقة:';
      drawRtl(page, restrictionLabel, right, y, boldFont, 11, NAVY);
      y -= 18;
      drawRtl(page, record.restriction_ar, right, y, font, 11, DARK_GRAY);
      y -= 22;
    }

    // Footer: examining doctor + issue date
    y = MARGIN + 56;
    page.drawLine({
      start: { x: MARGIN, y: y + 16 },
      end: { x: right, y: y + 16 },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85),
    });
    if (record.examining_doctor) {
      drawRtl(page, `الطبيب الفاحص: ${record.examining_doctor}`, right, y, font, 9, DARK_GRAY);
    }
    page.drawText(`Issued: ${new Date().toISOString().split('T')[0]}`, {
      x: MARGIN,
      y,
      size: 9,
      font,
      color: DARK_GRAY,
    });
    y -= 20;

    drawRtl(
      page,
      'هذه الشهادة صادرة من الطبيب المعالج وليست وثيقة حكومية رسمية',
      right,
      MARGIN,
      font,
      7,
      LIGHT_GRAY
    );

    const pdfBytes = await pdfDoc.save();

    // 5. Mark the record as having an issued certificate (best-effort)
    await supabase
      .from('school_health_records')
      .update({ certificate_issued: true })
      .eq('id', record.id);

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="school-health-certificate-${record.id}.pdf"`,
      },
    });
  } catch (err) {
    console.error('POST /api/doctor/school-health/certificate error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
