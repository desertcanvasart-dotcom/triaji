'use client';

import { useMemo } from 'react';
import type { CatalogOption } from './StepMedicalHistory';
import type { FamilyHistoryOption } from './StepFamilyHistory';

/* ─── Governorate lookup (mirrors StepBasicInfo) ─── */
const GOVERNORATE_MAP: Record<string, string> = {
  cairo: 'القاهرة',
  giza: 'الجيزة',
  qalyubia: 'القليوبية',
  alexandria: 'الإسكندرية',
  beheira: 'البحيرة',
  kafr_el_sheikh: 'كفر الشيخ',
  gharbia: 'الغربية',
  dakahlia: 'الدقهلية',
  damietta: 'دمياط',
  monufia: 'المنوفية',
  sharqia: 'الشرقية',
  port_said: 'بورسعيد',
  ismailia: 'الإسماعيلية',
  suez: 'السويس',
  luxor: 'الأقصر',
  aswan: 'أسوان',
  sohag: 'سوهاج',
  qena: 'قنا',
  asyut: 'أسيوط',
  minya: 'المنيا',
  beni_suef: 'بني سويف',
  fayoum: 'الفيوم',
  north_sinai: 'شمال سيناء',
  south_sinai: 'جنوب سيناء',
  matrouh: 'مطروح',
  red_sea: 'البحر الأحمر',
  new_valley: 'الوادي الجديد',
};

/* ─── Enum → Arabic maps ─── */
const WORK_TYPE_MAP: Record<string, string> = {
  office: 'عمل مكتبي',
  manual_construction: 'عمل يدوي',
  healthcare: 'قطاع طبي',
  education: 'تعليم',
  transportation: 'نقل',
  agriculture: 'زراعة',
  retail_sales: 'تجارة',
  industrial_factory: 'صناعة',
  domestic: 'أعمال منزلية',
  student: 'طالب',
  retired: 'متقاعد',
  unemployed: 'غير عامل',
};

const WORK_SCHEDULE_MAP: Record<string, string> = {
  day: 'نهاري',
  night: 'ليلي',
  irregular: 'غير منتظم',
};

const ACTIVITY_LEVEL_MAP: Record<string, string> = {
  low: 'خامل',
  moderate: 'معتدل',
  high: 'نشيط',
};

const SMOKING_MAP: Record<string, string> = {
  never: 'لا يدخن',
  current: 'يدخن',
  former: 'أقلع',
};

const BP_MAP: Record<string, string> = {
  none: 'لا يوجد',
  controlled: 'مضبوط',
  uncontrolled: 'غير مضبوط',
  unknown: 'غير معروف',
};

const DIABETES_MAP: Record<string, string> = {
  none: 'لا يوجد',
  type1: 'النوع الأول',
  type2: 'النوع الثاني',
  unknown: 'غير معروف',
};

const CONDITION_STATUS_MAP: Record<string, string> = {
  none: 'لا يوجد',
  known: 'نعم',
  unknown: 'غير معروف',
};

const RELATION_MAP: Record<string, string> = {
  father: 'الأب',
  mother: 'الأم',
  sibling: 'أخ / أخت',
};

const PREGNANCY_MAP: Record<string, string> = {
  not_pregnant: 'لست حاملاً',
  pregnant: 'حامل',
  breastfeeding: 'مرضعة',
  trying_to_conceive: 'تحاول الحمل',
};

const MENSTRUAL_MAP: Record<string, string> = {
  regular: 'منتظمة',
  irregular: 'غير منتظمة',
  absent: 'منقطعة',
};

const MENOPAUSE_MAP: Record<string, string> = {
  pre_menopause: 'قبل سن اليأس',
  peri_menopause: 'في مرحلة الانتقال',
  post_menopause: 'بعد سن اليأس',
  not_applicable: 'لا ينطبق',
};

/* ─── BMI ─── */
function calcBMI(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

function getBMICategoryAr(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'نحيف', color: 'text-yellow-500' };
  if (bmi < 25) return { label: 'طبيعي \u2713', color: 'text-green-600' };
  if (bmi < 30) return { label: 'زيادة وزن', color: 'text-orange-500' };
  if (bmi < 35) return { label: 'سمنة درجة أولى', color: 'text-red-400' };
  return { label: 'سمنة مفرطة', color: 'text-red-600' };
}

/* ─── Types ─── */
export interface OnboardingFormData {
  // Step 0 - BasicInfo
  age: number | null;
  biological_sex: 'male' | 'female' | null;
  governorate_id: string | null;
  // Step 1 - Physical
  height_cm: number | null;
  weight_kg: number | null;
  // Step 2 - Work
  work_type: string | null;
  work_schedule: string | null;
  activity_level: string | null;
  // Step 3 - Clinical
  smoking_status: string;
  cigarettes_per_day: number | null;
  smoking_years: number | null;
  blood_pressure: string;
  bp_on_medication: boolean;
  diabetes_type: string;
  diabetes_control: string;
  diabetes_treatment: string;
  heart_condition: string;
  previous_heart_attack: boolean;
  heart_surgery: boolean;
  kidney_disease: string;
  liver_disease: string;
  // Step 4 - Medical History
  allergies: Array<{ code: string; notes_ar?: string }>;
  chronic_conditions: Array<{ code: string; notes_ar?: string; diagnosed_year?: number }>;
  medications: Array<{
    drug_name_ar: string;
    drug_name_en?: string;
    dose?: string;
    frequency_ar?: string;
    for_condition_ar?: string;
  }>;
  surgeries: Array<{ code: string; year_approximate?: number; notes_ar?: string }>;
  // Step 5 - Family History
  family_history: Array<{ condition_code: string; relation: string }>;
  // Step 6 - Reproductive
  pregnancy_status: string | null;
  previous_pregnancies: number | null;
  menstrual_regularity: string | null;
  menopause_status: string | null;
  last_menstrual_period_approx: string | null;
}

interface ReviewCatalogs {
  allergyOptions: CatalogOption[];
  conditionOptions: CatalogOption[];
  surgeryOptions: CatalogOption[];
  familyHistoryOptions: FamilyHistoryOption[];
}

interface StepReviewProps {
  data: OnboardingFormData;
  onEdit: (step: number) => void;
  catalogs: ReviewCatalogs;
}

/* ─── Helpers ─── */
function resolveCode(code: string, options: { code: string; name_ar: string }[]): string {
  return options.find((o) => o.code === code)?.name_ar ?? code;
}

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/* ─── Section component ─── */
function ReviewSection({
  title,
  stepNumber,
  onEdit,
  children,
}: {
  title: string;
  stepNumber: number;
  onEdit: (step: number) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <button
          type="button"
          onClick={() => onEdit(stepNumber)}
          className="text-xs font-medium text-teal-700 hover:text-teal-800 hover:underline transition-colors"
        >
          تعديل
        </button>
      </div>
      <div className="px-4 py-3 text-sm text-gray-700 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 font-medium text-start">{value || 'لا يوجد'}</span>
    </div>
  );
}

const EMPTY = <span className="text-gray-400">لا يوجد</span>;

/* ─── Main Component ─── */
export default function StepReview({ data, onEdit, catalogs }: StepReviewProps) {
  /* BMI calculation */
  const bmiInfo = useMemo(() => {
    if (data.height_cm && data.weight_kg) {
      const bmi = calcBMI(data.height_cm, data.weight_kg);
      const cat = getBMICategoryAr(bmi);
      return { value: bmi.toFixed(1), ...cat };
    }
    return null;
  }, [data.height_cm, data.weight_kg]);

  /* Group family history by relation */
  const familyByRelation = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    for (const entry of data.family_history) {
      const relationLabel = RELATION_MAP[entry.relation] ?? entry.relation;
      if (!grouped[relationLabel]) grouped[relationLabel] = [];
      const condName = resolveCode(entry.condition_code, catalogs.familyHistoryOptions);
      grouped[relationLabel].push(condName);
    }
    return grouped;
  }, [data.family_history, catalogs.familyHistoryOptions]);

  const isFemale = data.biological_sex === 'female';

  return (
    <div className="flex flex-col gap-4" dir="rtl">
      <div className="text-center mb-2">
        <h2 className="text-lg font-bold text-gray-900">مراجعة البيانات</h2>
        <p className="text-sm text-gray-500 mt-1">تأكد من صحة المعلومات قبل الحفظ</p>
      </div>

      {/* ── Step 0: المعلومات الأساسية ── */}
      <ReviewSection title="المعلومات الأساسية" stepNumber={0} onEdit={onEdit}>
        <Row label="العمر" value={data.age != null ? `${data.age} سنة` : null} />
        <Row
          label="الجنس"
          value={data.biological_sex === 'male' ? 'ذكر' : data.biological_sex === 'female' ? 'أنثى' : null}
        />
        <Row
          label="المحافظة"
          value={data.governorate_id ? (GOVERNORATE_MAP[data.governorate_id] ?? data.governorate_id) : null}
        />
      </ReviewSection>

      {/* ── Step 1: القياسات ── */}
      <ReviewSection title="القياسات" stepNumber={1} onEdit={onEdit}>
        <Row label="الطول" value={data.height_cm != null ? `${data.height_cm} سم` : null} />
        <Row label="الوزن" value={data.weight_kg != null ? `${data.weight_kg} كجم` : null} />
        {bmiInfo && (
          <Row
            label="مؤشر كتلة الجسم"
            value={
              <span>
                <span dir="ltr">{bmiInfo.value}</span>
                {' — '}
                <span className={bmiInfo.color}>{bmiInfo.label}</span>
              </span>
            }
          />
        )}
      </ReviewSection>

      {/* ── Step 2: العمل والنشاط ── */}
      <ReviewSection title="العمل والنشاط" stepNumber={2} onEdit={onEdit}>
        <Row label="طبيعة العمل" value={data.work_type ? WORK_TYPE_MAP[data.work_type] : null} />
        <Row label="الوردية" value={data.work_schedule ? WORK_SCHEDULE_MAP[data.work_schedule] : null} />
        <Row label="النشاط البدني" value={data.activity_level ? ACTIVITY_LEVEL_MAP[data.activity_level] : null} />
      </ReviewSection>

      {/* ── Step 3: الحالة الصحية ── */}
      <ReviewSection title="الحالة الصحية" stepNumber={3} onEdit={onEdit}>
        <Row
          label="التدخين"
          value={
            data.smoking_status ? (
              <span>
                {SMOKING_MAP[data.smoking_status] ?? data.smoking_status}
                {(data.smoking_status === 'current' || data.smoking_status === 'former') && (
                  <>
                    {data.cigarettes_per_day != null && ` — ${data.cigarettes_per_day} سيجارة/يوم`}
                    {data.smoking_years != null && ` — ${data.smoking_years} سنة`}
                  </>
                )}
              </span>
            ) : null
          }
        />
        <Row
          label="ضغط الدم"
          value={
            data.blood_pressure ? (
              <span>
                {BP_MAP[data.blood_pressure] ?? data.blood_pressure}
                {data.bp_on_medication && ' (على علاج)'}
              </span>
            ) : null
          }
        />
        <Row
          label="سكر الدم"
          value={
            data.diabetes_type ? (
              <span>
                {DIABETES_MAP[data.diabetes_type] ?? data.diabetes_type}
                {data.diabetes_control && data.diabetes_type !== 'none' && ` — ${data.diabetes_control === 'controlled' ? 'مضبوط' : data.diabetes_control === 'uncontrolled' ? 'غير مضبوط' : 'غير معروف'}`}
                {data.diabetes_treatment && data.diabetes_type !== 'none' && ` (${data.diabetes_treatment === 'tablets' ? 'أقراص' : data.diabetes_treatment === 'insulin' ? 'أنسولين' : data.diabetes_treatment === 'both' ? 'كلاهما' : data.diabetes_treatment})`}
              </span>
            ) : null
          }
        />
        <Row
          label="أمراض القلب"
          value={
            data.heart_condition ? (
              <span>
                {CONDITION_STATUS_MAP[data.heart_condition] ?? data.heart_condition}
                {data.heart_condition === 'known' && data.previous_heart_attack && ' — نوبة قلبية سابقة'}
                {data.heart_condition === 'known' && data.heart_surgery && ' — عملية قلب سابقة'}
              </span>
            ) : null
          }
        />
        <Row label="أمراض الكلى" value={data.kidney_disease ? (CONDITION_STATUS_MAP[data.kidney_disease] ?? data.kidney_disease) : null} />
        <Row label="أمراض الكبد" value={data.liver_disease ? (CONDITION_STATUS_MAP[data.liver_disease] ?? data.liver_disease) : null} />
      </ReviewSection>

      {/* ── Step 4: التاريخ المرضي ── */}
      <ReviewSection title="التاريخ المرضي" stepNumber={4} onEdit={onEdit}>
        {/* Allergies */}
        <div className="py-1">
          <span className="text-gray-500">الحساسية: </span>
          {isEmpty(data.allergies)
            ? EMPTY
            : (
              <span className="text-gray-900 font-medium">
                {data.allergies
                  .map((a) => {
                    const name = resolveCode(a.code, catalogs.allergyOptions);
                    return a.notes_ar ? `${name} (${a.notes_ar})` : name;
                  })
                  .join('، ')}
              </span>
            )}
        </div>

        {/* Chronic conditions */}
        <div className="py-1">
          <span className="text-gray-500">أمراض مزمنة: </span>
          {isEmpty(data.chronic_conditions)
            ? EMPTY
            : (
              <span className="text-gray-900 font-medium">
                {data.chronic_conditions
                  .map((c) => {
                    const name = resolveCode(c.code, catalogs.conditionOptions);
                    const parts = [name];
                    if (c.notes_ar) parts.push(c.notes_ar);
                    if (c.diagnosed_year) parts.push(`${c.diagnosed_year}`);
                    return parts.length > 1 ? `${name} (${parts.slice(1).join(' — ')})` : name;
                  })
                  .join('، ')}
              </span>
            )}
        </div>

        {/* Medications */}
        <div className="py-1">
          <span className="text-gray-500">الأدوية: </span>
          {isEmpty(data.medications)
            ? EMPTY
            : (
              <div className="mt-1 flex flex-col gap-1">
                {data.medications.map((med, idx) => (
                  <div key={idx} className="text-gray-900 font-medium">
                    {med.drug_name_ar}
                    {med.dose && ` — ${med.dose}`}
                    {med.frequency_ar && ` (${med.frequency_ar})`}
                    {med.for_condition_ar && ` — ل${med.for_condition_ar}`}
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* Surgeries */}
        <div className="py-1">
          <span className="text-gray-500">عمليات سابقة: </span>
          {isEmpty(data.surgeries)
            ? EMPTY
            : (
              <span className="text-gray-900 font-medium">
                {data.surgeries
                  .map((s) => {
                    const name = resolveCode(s.code, catalogs.surgeryOptions);
                    const suffix = s.year_approximate ? ` (${s.year_approximate})` : '';
                    const notesSuffix = s.notes_ar ? ` — ${s.notes_ar}` : '';
                    return `${name}${suffix}${notesSuffix}`;
                  })
                  .join('، ')}
              </span>
            )}
        </div>
      </ReviewSection>

      {/* ── Step 5: التاريخ العائلي ── */}
      <ReviewSection title="التاريخ العائلي" stepNumber={5} onEdit={onEdit}>
        {isEmpty(data.family_history) ? (
          <div className="py-1">{EMPTY}</div>
        ) : (
          <div className="flex flex-col gap-1">
            {Object.entries(familyByRelation).map(([relation, conditions]) => (
              <div key={relation} className="py-1">
                <span className="text-gray-900 font-medium">{relation}: </span>
                <span className="text-gray-700">{conditions.join('، ')}</span>
              </div>
            ))}
          </div>
        )}
      </ReviewSection>

      {/* ── Step 6: الصحة الإنجابية (female only) ── */}
      {isFemale && (
        <ReviewSection title="الصحة الإنجابية" stepNumber={6} onEdit={onEdit}>
          <Row
            label="حالة الحمل"
            value={data.pregnancy_status ? (PREGNANCY_MAP[data.pregnancy_status] ?? data.pregnancy_status) : null}
          />
          <Row
            label="عدد مرات الحمل"
            value={data.previous_pregnancies != null ? `${data.previous_pregnancies}` : null}
          />
          <Row
            label="انتظام الدورة"
            value={data.menstrual_regularity ? (MENSTRUAL_MAP[data.menstrual_regularity] ?? data.menstrual_regularity) : null}
          />
          <Row
            label="سن اليأس"
            value={data.menopause_status ? (MENOPAUSE_MAP[data.menopause_status] ?? data.menopause_status) : null}
          />
        </ReviewSection>
      )}
    </div>
  );
}
