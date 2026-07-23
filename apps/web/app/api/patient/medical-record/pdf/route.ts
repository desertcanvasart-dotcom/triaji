import { NextResponse } from 'next/server';
import { PDFDocument, PDFPage, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';
import { buildMedicalRecord } from '@/lib/records/build-medical-record';
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN,
  NAVY,
  TEAL,
  DARK_GRAY,
  LIGHT_GRAY,
  drawSeparator,
  drawArabicText,
  type EmbeddedFonts,
} from '@/lib/pdf/generator';

export const dynamic = 'force-dynamic';

// ─── Local helpers ─────────────────────────────────────────────────────────
// A row of the medical record: English label/value on the left, Arabic on the
// right — mirroring the bilingual layout used by the clinical PDF generators.

function drawRow(
  page: PDFPage,
  fonts: EmbeddedFonts,
  y: number,
  en: string,
  ar: string,
): number {
  page.drawText(en, { x: MARGIN, y, size: 9, font: fonts.regular, color: DARK_GRAY });
  if (ar) {
    drawArabicText(page, ar, PAGE_WIDTH - MARGIN, y, fonts.regular, 9, DARK_GRAY);
  }
  return y - 15;
}

function drawSectionTitle(
  page: PDFPage,
  fonts: EmbeddedFonts,
  y: number,
  titleEn: string,
  titleAr: string,
): number {
  page.drawText(titleEn, { x: MARGIN, y, size: 12, font: fonts.bold, color: NAVY });
  drawArabicText(page, titleAr, PAGE_WIDTH - MARGIN, y, fonts.bold, 12, NAVY);
  drawSeparator(page, y - 6);
  return y - 22;
}

// ─── GET /api/patient/medical-record/pdf ─────────────────────────────────────
// Renders the authenticated patient's longitudinal medical record as a
// downloadable PDF. Reuses buildMedicalRecord (same data the dashboard shows)
// and the Cairo-font / bilingual layout established in lib/pdf/generator.ts.
export async function GET() {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data: patientRow } = await supabase
    .from('patients')
    .select('name_ar')
    .eq('id', patient.patientId)
    .single();

  const record = await buildMedicalRecord(
    supabase,
    patient.patientId,
    (patientRow?.name_ar as string) ?? 'مريض',
  );

  // ── PDF setup (Cairo fonts for Arabic shaping — same as generator.ts) ──
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const regular = await pdfDoc.embedFont(
    new Uint8Array(readFileSync(join(process.cwd(), 'public', 'fonts', 'Cairo-Regular.ttf'))),
    { subset: false },
  );
  const bold = await pdfDoc.embedFont(
    new Uint8Array(readFileSync(join(process.cwd(), 'public', 'fonts', 'Cairo-Bold.ttf'))),
    { subset: false },
  );
  const fonts: EmbeddedFonts = { regular, bold };

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  // Starts a fresh page when we're about to overflow the bottom margin.
  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN + 40) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  // ── Title ──
  page.drawText('Medical Record', { x: MARGIN, y, size: 20, font: bold, color: NAVY });
  drawArabicText(page, 'الملف الطبي', PAGE_WIDTH - MARGIN, y, bold, 20, NAVY);
  y -= 22;
  page.drawText('DoctorTrio Health Platform', { x: MARGIN, y, size: 10, font: regular, color: TEAL });
  drawArabicText(
    page,
    `تاريخ الإصدار: ${new Date().toISOString().split('T')[0]}`,
    PAGE_WIDTH - MARGIN,
    y,
    regular,
    9,
    DARK_GRAY,
  );
  y -= 14;
  drawSeparator(page, y);
  y -= 22;

  // ── Demographics & background risk ──
  y = drawSectionTitle(page, fonts, y, 'Patient & Background Risk', 'المريض والمخاطر الأساسية');
  y = drawRow(page, fonts, y, `Name: ${record.patient_name_ar}`, `الاسم: ${record.patient_name_ar}`);
  y = drawRow(
    page,
    fonts,
    y,
    `Background Risk Score (BRS): ${record.brs_score}`,
    `درجة المخاطر الأساسية: ${record.brs_score}`,
  );
  y = drawRow(
    page,
    fonts,
    y,
    `Active medications: ${record.active_medications_count}`,
    `الأدوية الحالية: ${record.active_medications_count}`,
  );
  y = drawRow(
    page,
    fonts,
    y,
    `Upcoming appointments: ${record.upcoming_appointments_count}`,
    `المواعيد القادمة: ${record.upcoming_appointments_count}`,
  );
  if (record.days_since_last_lab !== null) {
    y = drawRow(
      page,
      fonts,
      y,
      `Days since last lab: ${record.days_since_last_lab}`,
      `أيام منذ آخر تحليل: ${record.days_since_last_lab}`,
    );
  }
  y -= 8;

  // ── Allergies ──
  ensureSpace(40);
  y = drawSectionTitle(page, fonts, y, 'Allergies', 'الحساسية');
  if (record.allergies.length === 0) {
    y = drawRow(page, fonts, y, 'None recorded', 'لا يوجد');
  } else {
    for (const a of record.allergies) {
      ensureSpace(20);
      y = drawRow(page, fonts, y, `• ${a.name_en}`, `${a.name_ar} •`);
    }
  }
  y -= 8;

  // ── Chronic conditions ──
  ensureSpace(40);
  y = drawSectionTitle(page, fonts, y, 'Chronic Conditions', 'الأمراض المزمنة');
  if (record.chronic_conditions.length === 0) {
    y = drawRow(page, fonts, y, 'None recorded', 'لا يوجد');
  } else {
    for (const c of record.chronic_conditions) {
      ensureSpace(20);
      const since = c.since ? ` (${c.since})` : '';
      y = drawRow(page, fonts, y, `• ${c.name_en}${since}`, `${c.name_ar}${since} •`);
    }
  }
  y -= 8;

  // ── Medications ──
  ensureSpace(40);
  y = drawSectionTitle(page, fonts, y, 'Medications', 'الأدوية');
  if (record.medications.length === 0) {
    y = drawRow(page, fonts, y, 'None recorded', 'لا يوجد');
  } else {
    for (const m of record.medications) {
      ensureSpace(20);
      const dose = [m.dose, m.frequency_en].filter(Boolean).join(' — ');
      const enLine = dose ? `• ${m.drug_name_en} (${dose})` : `• ${m.drug_name_en}`;
      const arDose = [m.dose, m.frequency_ar].filter(Boolean).join(' — ');
      const arLine = arDose ? `${m.drug_name_ar} (${arDose}) •` : `${m.drug_name_ar} •`;
      y = drawRow(page, fonts, y, enLine, arLine);
    }
  }
  y -= 8;

  // ── Recent lab results ──
  ensureSpace(40);
  y = drawSectionTitle(page, fonts, y, 'Recent Lab Results', 'أحدث التحاليل');
  if (record.latest_results.length === 0) {
    y = drawRow(page, fonts, y, 'None recorded', 'لا يوجد');
  } else {
    for (const r of record.latest_results) {
      ensureSpace(20);
      const flag = r.isAbnormal ? ' [!]' : '';
      const valueStr = [r.value, r.unit].filter(Boolean).join(' ');
      const en = `• ${r.testNameEn}: ${valueStr}${flag} (${r.date})`;
      const ar = `${r.testNameAr}: ${valueStr}${flag} •`;
      y = drawRow(page, fonts, y, en, ar);
    }
  }

  // ── Footer disclaimer ──
  page.drawText(
    'Generated by DoctorTrio Health Platform. Not an official medical document.',
    { x: MARGIN, y: MARGIN, size: 7, font: regular, color: LIGHT_GRAY },
  );

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="medical-record.pdf"',
    },
  });
}
