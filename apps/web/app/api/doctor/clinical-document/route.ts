import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { DocumentType, DoctorAssets, DocumentMeta, DocumentData } from '@/lib/pdf/generator';
import { checkDrugInteractions } from '@/lib/interactions/checker';
import type { InteractionOverride, InteractionResult } from '@triaji/shared/types';

export const dynamic = 'force-dynamic';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DoctorAccount {
  id: string;
  doctor_id: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  name_ar: string;
  name_en: string | null;
  specialty_ar: string;
  syndicate_number: string;
  clinic_name_ar: string | null;
  clinic_name_en: string | null;
  clinic_address_ar: string | null;
  clinic_address_en: string | null;
  clinic_phone: string | null;
  signature_url: string | null;
  stamp_url: string | null;
  use_text_stamp: boolean;
}

interface RequestBody {
  bookingId: string;
  documentType: DocumentType;
  data: DocumentData;
  overrides?: InteractionOverride[];
}

interface Booking {
  id: string;
  patient_id: string;
  doctor_id: string;
  session_id: string | null;
}

interface Patient {
  id: string;
  phone_number: string;
  name_ar: string | null;
  patient_profiles: { date_of_birth: string | null }[] | null;
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
  const accessToken = request.cookies.get('sb-access-token')?.value
    ?? request.headers.get('Authorization')?.replace('Bearer ', '');
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
  return doctorAccount as DoctorAccount;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

function buildDoctorAssets(account: DoctorAccount): DoctorAssets {
  return {
    name_ar: account.name_ar,
    name_en: account.name_en,
    specialty_ar: account.specialty_ar,
    syndicate_number: account.syndicate_number,
    clinic_name_ar: account.clinic_name_ar,
    clinic_name_en: account.clinic_name_en,
    clinic_address_ar: account.clinic_address_ar,
    clinic_address_en: account.clinic_address_en,
    clinic_phone: account.clinic_phone,
    signature_url: account.signature_url,
    stamp_url: account.stamp_url,
    use_text_stamp: account.use_text_stamp,
  };
}

// ─── POST Handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate doctor
    const doctorAccount = await authenticateDoctor(request);
    if (!doctorAccount) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول' },
        { status: 401 }
      );
    }

    // 2. Parse body
    const body = (await request.json()) as RequestBody;
    const { bookingId, documentType, data, overrides: providedOverrides } = body;

    if (!bookingId || !documentType || !data) {
      return NextResponse.json(
        { error: 'بيانات ناقصة: bookingId, documentType, data مطلوبين' },
        { status: 400 }
      );
    }

    const validTypes: DocumentType[] = ['prescription', 'lab_order', 'imaging_order', 'consultation_summary'];
    if (!validTypes.includes(documentType)) {
      return NextResponse.json(
        { error: 'نوع المستند غير صالح' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // 3. Verify doctor owns this booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, patient_id, doctor_id, session_id')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'الحجز غير موجود' },
        { status: 404 }
      );
    }

    const typedBooking = booking as Booking;

    if (typedBooking.doctor_id !== doctorAccount.doctor_id) {
      return NextResponse.json(
        { error: 'غير مصرح بالوصول لهذا الحجز' },
        { status: 403 }
      );
    }

    // 3b. Interaction check for prescriptions
    if (documentType === 'prescription' && 'items' in data) {
      const prescriptionDrugs = (data.items as Array<{
        medication_name_ar?: string;
        medication_name_en?: string;
      }>).filter((item) => item.medication_name_ar || item.medication_name_en);

      if (prescriptionDrugs.length > 0) {
        // Load patient's existing medications
        const { data: patientProfile } = await supabase
          .from('patient_profiles')
          .select('id')
          .eq('patient_id', typedBooking.patient_id)
          .single();

        let existingMeds: { drug_name_ar: string; drug_name_en: string | null }[] = [];
        if (patientProfile) {
          const { data: meds } = await supabase
            .from('patient_medications')
            .select('drug_name_ar, drug_name_en')
            .eq('patient_profile_id', (patientProfile as { id: string }).id);
          existingMeds = (meds ?? []) as typeof existingMeds;
        }

        // Check each prescription item against existing meds + other prescription items
        const allInteractions: InteractionResult[] = [];

        for (let i = 0; i < prescriptionDrugs.length; i++) {
          const newDrug = prescriptionDrugs[i];
          if (!newDrug) continue;
          const otherPrescriptionDrugs = prescriptionDrugs
            .filter((_, j) => j !== i)
            .map((d) => ({
              nameAr: d.medication_name_ar ?? '',
              nameEn: d.medication_name_en ?? null,
            }));

          const existingDrugsForCheck = [
            ...existingMeds.map((m) => ({
              nameAr: m.drug_name_ar,
              nameEn: m.drug_name_en,
            })),
            ...otherPrescriptionDrugs,
          ];

          if (existingDrugsForCheck.length === 0) continue;

          const result = await checkDrugInteractions(
            {
              nameAr: newDrug.medication_name_ar ?? '',
              nameEn: newDrug.medication_name_en ?? null,
            },
            existingDrugsForCheck
          );

          allInteractions.push(...result.interactions);
        }

        // Check for blockers (contraindicated/major)
        const blockers = allInteractions.filter(
          (i) => i.severity === 'contraindicated' || i.severity === 'major'
        );

        if (blockers.length > 0 && (!providedOverrides || providedOverrides.length === 0)) {
          // Return 409 with interactions — doctor must provide overrides
          return NextResponse.json(
            {
              error: 'يوجد تفاعلات دوائية خطيرة يجب التعامل معها قبل الحفظ',
              errorEn: 'Serious drug interactions found — provide override reasons to proceed',
              interactions: allInteractions,
              blockers,
            },
            { status: 409 }
          );
        }

        // Log all interactions to interaction_check_log
        for (const interaction of allInteractions) {
          const overrideForThis = providedOverrides?.find(
            (o) =>
              (o.drugA === interaction.drugA && o.drugB === interaction.drugB) ||
              (o.drugA === interaction.drugB && o.drugB === interaction.drugA)
          );

          await supabase.from('interaction_check_log').insert({
            patient_id: typedBooking.patient_id,
            doctor_account_id: doctorAccount.id,
            new_drug_name_en: interaction.drugA,
            checked_against_drugs: [interaction.drugB],
            interactions_found: [interaction],
            highest_severity: interaction.severity,
            doctor_acknowledged: true,
            acknowledgement_at: new Date().toISOString(),
            override_reason_ar: overrideForThis?.overrideReasonAr ?? null,
            check_source: interaction.source,
          });
        }
      }
    }

    // 4. Generate document number
    const { count } = await supabase
      .from('health_records')
      .select('id', { count: 'exact', head: true })
      .eq('doctor_authored', true);
    const seq = (count ?? 0) + 1;
    const docNumber = `TRJ-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;

    // 5. Get patient info
    const { data: patient } = await supabase
      .from('patients')
      .select('id, phone_number, name_ar, patient_profiles(date_of_birth)')
      .eq('id', typedBooking.patient_id)
      .single();

    const typedPatient = patient as Patient | null;
    const patientDob = typedPatient?.patient_profiles?.[0]?.date_of_birth ?? null;

    // 6. Build PDF assets
    const doctorAssets = buildDoctorAssets(doctorAccount);
    const meta: DocumentMeta = {
      document_number: docNumber,
      date: new Date(),
      patient_name: typedPatient?.name_ar ?? null,
      patient_age: patientDob ? calculateAge(patientDob) : null,
    };

    // 7. Generate PDF
    const { generateClinicalPDF } = await import('@/lib/pdf/generator');
    const pdfBytes = await generateClinicalPDF(documentType, data, doctorAssets, meta);

    // 8. Upload PDF to Supabase Storage
    const storagePath = `${typedBooking.patient_id}/${docNumber}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('clinical-documents')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('PDF upload failed:', uploadError);
      return NextResponse.json(
        { error: 'فشل في رفع ملف PDF' },
        { status: 500 }
      );
    }

    // 9. Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('clinical-documents')
      .getPublicUrl(storagePath);
    const pdfUrl = publicUrlData.publicUrl;

    // 10. Create health_records entry
    const { data: healthRecord, error: recordError } = await supabase
      .from('health_records')
      .insert({
        patient_id: typedBooking.patient_id,
        record_type: documentType,
        // file_* are NOT NULL on health_records; the generated PDF is the file.
        file_url: pdfUrl,
        file_name: `${docNumber}.pdf`,
        mime_type: 'application/pdf',
        doctor_authored: true,
        authored_by: doctorAccount.id,
        booking_id: bookingId,
        document_type: documentType,
        document_number: docNumber,
        pdf_url: pdfUrl,
      })
      .select('id')
      .single();

    if (recordError) {
      console.error('Health record insert failed:', recordError);
      return NextResponse.json(
        { error: 'فشل في حفظ السجل الطبي' },
        { status: 500 }
      );
    }

    // 11. Create child items based on document type
    const recordId = (healthRecord as { id: string }).id;

    if (documentType === 'prescription' && 'items' in data) {
      const prescriptionItems = (data.items as Array<{
        medication_name_ar?: string;
        medication_name_en?: string;
        dosage?: string;
        frequency?: string;
        duration?: string;
        notes?: string;
      }>).map((item) => ({
        health_record_id: recordId,
        medication_name_ar: item.medication_name_ar ?? null,
        medication_name_en: item.medication_name_en ?? null,
        dosage: item.dosage ?? null,
        frequency: item.frequency ?? null,
        duration: item.duration ?? null,
        notes: item.notes ?? null,
      }));
      if (prescriptionItems.length > 0) {
        await supabase.from('prescription_items').insert(prescriptionItems);
      }
    }

    if (documentType === 'lab_order' && 'items' in data) {
      const labItems = (data.items as Array<{
        test_name_ar?: string;
        test_name_en?: string;
        urgency?: string;
        notes?: string;
      }>).map((item) => ({
        health_record_id: recordId,
        test_name_ar: item.test_name_ar ?? null,
        test_name_en: item.test_name_en ?? null,
        urgency: item.urgency ?? null,
        notes: item.notes ?? null,
      }));
      if (labItems.length > 0) {
        await supabase.from('lab_order_items').insert(labItems);
      }
    }

    if (documentType === 'imaging_order' && 'items' in data) {
      const imagingItems = (data.items as Array<{
        modality?: string;
        body_part_ar?: string;
        body_part_en?: string;
        clinical_indication?: string;
        notes?: string;
      }>).map((item) => ({
        health_record_id: recordId,
        modality: item.modality ?? null,
        body_part_ar: item.body_part_ar ?? null,
        body_part_en: item.body_part_en ?? null,
        clinical_indication: item.clinical_indication ?? null,
        notes: item.notes ?? null,
      }));
      if (imagingItems.length > 0) {
        await supabase.from('imaging_order_items').insert(imagingItems);
      }
    }

    if (documentType === 'consultation_summary' && typedBooking.session_id) {
      const summaryData = data as {
        diagnosis_ar?: string;
        diagnosis_en?: string;
        treatment_plan_ar?: string;
        treatment_plan_en?: string;
        follow_up_notes_ar?: string;
        follow_up_notes_en?: string;
      };
      await supabase
        .from('session_summaries')
        .update({
          doctor_diagnosis_ar: summaryData.diagnosis_ar ?? null,
          doctor_diagnosis_en: summaryData.diagnosis_en ?? null,
          doctor_treatment_plan_ar: summaryData.treatment_plan_ar ?? null,
          doctor_treatment_plan_en: summaryData.treatment_plan_en ?? null,
          doctor_follow_up_ar: summaryData.follow_up_notes_ar ?? null,
          doctor_follow_up_en: summaryData.follow_up_notes_en ?? null,
        })
        .eq('session_id', typedBooking.session_id);
    }

    // 12. WhatsApp delivery (optional, non-blocking)
    let whatsappSent = false;

    const whatsappToken = process.env['WHATSAPP_TOKEN'];
    const whatsappPhoneId = process.env['WHATSAPP_PHONE_NUMBER_ID'];
    const patientPhone = typedPatient?.phone_number;

    if (whatsappToken && whatsappPhoneId && patientPhone) {
      try {
        // Create a signed URL for temporary access (60 min)
        const { data: signedUrlData } = await supabase.storage
          .from('clinical-documents')
          .createSignedUrl(storagePath, 3600);

        if (signedUrlData?.signedUrl) {
          const documentTitleAr = documentType === 'prescription' ? 'روشتة طبية'
            : documentType === 'lab_order' ? 'طلب تحاليل'
            : documentType === 'imaging_order' ? 'طلب أشعة'
            : 'ملخص الكشف';

          const response = await fetch(
            `https://graph.facebook.com/v18.0/${whatsappPhoneId}/messages`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${whatsappToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: patientPhone,
                type: 'document',
                document: {
                  link: signedUrlData.signedUrl,
                  caption: `${documentTitleAr} - ${docNumber}\nمن د. ${doctorAccount.name_ar}`,
                  filename: `${docNumber}.pdf`,
                },
              }),
            }
          );

          if (response.ok) {
            whatsappSent = true;

            // Update health record with WhatsApp status
            await supabase
              .from('health_records')
              .update({
                whatsapp_sent: true,
                whatsapp_sent_at: new Date().toISOString(),
              })
              .eq('id', recordId);
          }
        }
      } catch (e) {
        console.error('WhatsApp delivery failed:', e);
      }
    }

    // 13. Return success response
    return NextResponse.json({
      documentNumber: docNumber,
      pdfUrl,
      whatsappSent,
    });
  } catch (error) {
    console.error('Clinical document creation failed:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}
