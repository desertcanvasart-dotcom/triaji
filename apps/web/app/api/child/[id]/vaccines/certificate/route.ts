import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// ─── Helper: verify guardian access to child ────────────────────────────────
async function verifyGuardianAccess(guardianPatientId: string, childPatientId: string) {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('guardian_relationships')
    .select('id')
    .eq('guardian_patient_id', guardianPatientId)
    .eq('child_patient_id', childPatientId)
    .eq('can_view_records', true)
    .single();
  return !!data;
}

// ─── GET /api/child/[id]/vaccines/certificate ───────────────────────────────
// Generate and return a PDF vaccination certificate
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id: childId } = await params;

  const hasAccess = await verifyGuardianAccess(patient.patientId, childId);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const supabase = createServerClient();

  // Get child info
  const { data: childPatient } = await supabase
    .from('patients')
    .select('name_ar')
    .eq('id', childId)
    .single();

  const { data: profile } = await supabase
    .from('patient_profiles')
    .select('date_of_birth, biological_sex')
    .eq('patient_id', childId)
    .single();

  if (!childPatient || !profile) {
    return NextResponse.json({ error: 'Child not found' }, { status: 404 });
  }

  // Get all given vaccines
  const { data: givenVaccines } = await supabase
    .from('vaccination_schedule')
    .select(`
      *,
      vaccine:vaccine_catalog!vaccination_schedule_vaccine_code_fkey (
        name_ar,
        name_en,
        disease_ar,
        disease_en
      )
    `)
    .eq('patient_id', childId)
    .eq('status', 'given')
    .order('scheduled_age_months', { ascending: true })
    .order('dose_number', { ascending: true });

  // Build PDF
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_WIDTH = 595;
  const PAGE_HEIGHT = 842;
  const MARGIN = 50;
  const NAVY = rgb(0.102, 0.184, 0.290);
  const TEAL = rgb(0.051, 0.478, 0.478);
  const DARK_GRAY = rgb(0.2, 0.2, 0.2);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  // Title
  page.drawText('Vaccination Certificate', {
    x: MARGIN,
    y,
    size: 20,
    font: boldFont,
    color: NAVY,
  });
  y -= 30;

  page.drawText('Triajji Health Platform', {
    x: MARGIN,
    y,
    size: 10,
    font,
    color: TEAL,
  });
  y -= 30;

  // Divider
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  y -= 25;

  // Child info
  const childName = childPatient.name_ar ?? 'Unknown';
  const dob = profile.date_of_birth ?? '';
  const sex = profile.biological_sex === 'male' ? 'Male' : 'Female';

  page.drawText(`Name: ${childName}`, { x: MARGIN, y, size: 11, font: boldFont, color: DARK_GRAY });
  y -= 18;
  page.drawText(`Date of Birth: ${dob}`, { x: MARGIN, y, size: 10, font, color: DARK_GRAY });
  y -= 18;
  page.drawText(`Sex: ${sex}`, { x: MARGIN, y, size: 10, font, color: DARK_GRAY });
  y -= 18;
  page.drawText(`Generated: ${new Date().toISOString().split('T')[0]}`, {
    x: MARGIN, y, size: 10, font, color: DARK_GRAY,
  });
  y -= 30;

  // Table header
  const COL_VACCINE = MARGIN;
  const COL_DOSE = 240;
  const COL_DATE = 340;
  const COL_FACILITY = 430;

  page.drawRectangle({
    x: MARGIN - 5,
    y: y - 3,
    width: PAGE_WIDTH - MARGIN * 2 + 10,
    height: 18,
    color: rgb(0.95, 0.95, 0.95),
  });

  page.drawText('Vaccine', { x: COL_VACCINE, y, size: 9, font: boldFont, color: NAVY });
  page.drawText('Dose', { x: COL_DOSE, y, size: 9, font: boldFont, color: NAVY });
  page.drawText('Date', { x: COL_DATE, y, size: 9, font: boldFont, color: NAVY });
  page.drawText('Facility', { x: COL_FACILITY, y, size: 9, font: boldFont, color: NAVY });
  y -= 22;

  // Table rows
  for (const vacc of givenVaccines ?? []) {
    if (y < MARGIN + 40) {
      // New page
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }

    const vaccine = vacc.vaccine as Record<string, string> | null;
    const vaccineName = vaccine?.name_en ?? vacc.vaccine_code ?? '';
    const doseNum = `${vacc.dose_number ?? '-'}`;
    const givenDate = vacc.given_date ?? '-';
    const facility = vacc.given_at_facility ?? '-';

    // Truncate long names
    const truncatedName = vaccineName.length > 30 ? vaccineName.slice(0, 28) + '..' : vaccineName;

    page.drawText(truncatedName, { x: COL_VACCINE, y, size: 9, font, color: DARK_GRAY });
    page.drawText(doseNum, { x: COL_DOSE, y, size: 9, font, color: DARK_GRAY });
    page.drawText(givenDate, { x: COL_DATE, y, size: 9, font, color: DARK_GRAY });
    page.drawText(facility.slice(0, 20), { x: COL_FACILITY, y, size: 9, font, color: DARK_GRAY });
    y -= 16;
  }

  if (!givenVaccines || givenVaccines.length === 0) {
    page.drawText('No vaccines recorded yet.', {
      x: MARGIN,
      y,
      size: 10,
      font,
      color: DARK_GRAY,
    });
  }

  // Footer disclaimer
  y = MARGIN;
  page.drawText(
    'This certificate is generated by Triajji Health Platform and is not an official government document.',
    { x: MARGIN, y, size: 7, font, color: rgb(0.6, 0.6, 0.6) }
  );

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="vaccination-certificate-${childId}.pdf"`,
    },
  });
}
