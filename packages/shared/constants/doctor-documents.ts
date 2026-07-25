/**
 * Verification documents a doctor uploads after registering, while their
 * account sits pending. Shared so the doctor portal and the admin review
 * queue agree on the set, the labels, and what is required.
 */

export const DOCTOR_DOCUMENT_TYPES = [
  'syndicate_card',
  'national_id',
  'degree',
  'specialty_certificate',
  'clinic_license',
  'commercial_register',
  'tax_card',
] as const;

export type DoctorDocumentType = (typeof DOCTOR_DOCUMENT_TYPES)[number];

export type DoctorDocumentStatus = 'pending' | 'approved' | 'rejected';

export interface DoctorDocumentSpec {
  type: DoctorDocumentType;
  label_ar: string;
  label_en: string;
  hint_ar: string;
  hint_en: string;
  /** Required before an account can be approved. */
  required: boolean;
  /** Only asked of doctors registering their own clinic. */
  clinicOnly: boolean;
}

export const DOCTOR_DOCUMENT_SPECS: DoctorDocumentSpec[] = [
  {
    type: 'syndicate_card',
    label_ar: 'كارنيه النقابة',
    label_en: 'Syndicate card',
    hint_ar: 'صورة واضحة من كارنيه نقابة الأطباء، ساري الصلاحية',
    hint_en: 'A clear photo of your Medical Syndicate card, still valid',
    required: true,
    clinicOnly: false,
  },
  {
    type: 'national_id',
    label_ar: 'بطاقة الرقم القومي',
    label_en: 'National ID',
    hint_ar: 'الوجهين، والبيانات تكون مقروءة',
    hint_en: 'Both sides, with the details legible',
    required: true,
    clinicOnly: false,
  },
  {
    type: 'degree',
    label_ar: 'شهادة التخرج',
    label_en: 'Medical degree',
    hint_ar: 'شهادة البكالوريوس من كلية الطب',
    hint_en: 'Your MBBCh / medical school certificate',
    required: true,
    clinicOnly: false,
  },
  {
    type: 'specialty_certificate',
    label_ar: 'شهادة التخصص',
    label_en: 'Specialty certificate',
    hint_ar: 'ماچستير أو دكتوراه أو زمالة — اختياري',
    hint_en: 'Masters, doctorate or fellowship — optional',
    required: false,
    clinicOnly: false,
  },
  {
    type: 'clinic_license',
    label_ar: 'ترخيص العيادة',
    label_en: 'Clinic licence',
    hint_ar: 'ترخيص مزاولة النشاط الصادر لعيادتك',
    hint_en: 'The operating licence issued for your clinic',
    required: true,
    clinicOnly: true,
  },
  {
    type: 'commercial_register',
    label_ar: 'السجل التجاري',
    label_en: 'Commercial register',
    hint_ar: 'مستخرج حديث — اختياري',
    hint_en: 'A recent extract — optional',
    required: false,
    clinicOnly: true,
  },
  {
    type: 'tax_card',
    label_ar: 'البطاقة الضريبية',
    label_en: 'Tax card',
    hint_ar: 'اختياري',
    hint_en: 'Optional',
    required: false,
    clinicOnly: true,
  },
];

/** Upload limits, enforced on both the client and the API. */
export const DOCTOR_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024; // 10MB
export const DOCTOR_DOCUMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

/** The specs that apply to a given registration. */
export function specsForClinicMode(clinicMode: string | null | undefined): DoctorDocumentSpec[] {
  const ownsClinic = clinicMode === 'own_clinic';
  return DOCTOR_DOCUMENT_SPECS.filter((s) => !s.clinicOnly || ownsClinic);
}

export function documentLabel(type: DoctorDocumentType, lang: 'ar' | 'en'): string {
  const spec = DOCTOR_DOCUMENT_SPECS.find((s) => s.type === type);
  if (!spec) return type;
  return lang === 'ar' ? spec.label_ar : spec.label_en;
}
