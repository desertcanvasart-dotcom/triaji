'use client';

import { useState, useCallback } from 'react';
import { t, type Lang } from '@triaji/shared/i18n';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SchoolHealthFormProps {
  patientId: string;
  patientName: string;
  lang: Lang;
}

type FitnessStatus = 'fit' | 'fit_with_restrictions' | 'not_fit';

// ─── Constants ──────────────────────────────────────────────────────────────

const GRADES: { value: string; labelAr: string; labelEn: string }[] = [
  { value: 'kg1', labelAr: 'KG1', labelEn: 'KG1' },
  { value: 'kg2', labelAr: 'KG2', labelEn: 'KG2' },
  { value: 'grade_1_primary', labelAr: 'الصف الأول الابتدائي', labelEn: 'Grade 1 (Primary)' },
  { value: 'grade_2_primary', labelAr: 'الصف الثاني الابتدائي', labelEn: 'Grade 2 (Primary)' },
  { value: 'grade_3_primary', labelAr: 'الصف الثالث الابتدائي', labelEn: 'Grade 3 (Primary)' },
  { value: 'grade_4_primary', labelAr: 'الصف الرابع الابتدائي', labelEn: 'Grade 4 (Primary)' },
  { value: 'grade_5_primary', labelAr: 'الصف الخامس الابتدائي', labelEn: 'Grade 5 (Primary)' },
  { value: 'grade_6_primary', labelAr: 'الصف السادس الابتدائي', labelEn: 'Grade 6 (Primary)' },
  { value: 'grade_1_prep', labelAr: 'الصف الأول الإعدادي', labelEn: 'Grade 1 (Preparatory)' },
  { value: 'grade_2_prep', labelAr: 'الصف الثاني الإعدادي', labelEn: 'Grade 2 (Preparatory)' },
  { value: 'grade_3_prep', labelAr: 'الصف الثالث الإعدادي', labelEn: 'Grade 3 (Preparatory)' },
  { value: 'grade_1_sec', labelAr: 'الصف الأول الثانوي', labelEn: 'Grade 1 (Secondary)' },
  { value: 'grade_2_sec', labelAr: 'الصف الثاني الثانوي', labelEn: 'Grade 2 (Secondary)' },
  { value: 'grade_3_sec', labelAr: 'الصف الثالث الثانوي', labelEn: 'Grade 3 (Secondary)' },
];

function getAcademicYears(): string[] {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let i = 0; i < 3; i++) {
    const start = currentYear - i;
    years.push(`${start}/${start + 1}`);
  }
  return years;
}

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-[Cairo] focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500';
const labelClass = 'block text-sm font-medium text-gray-700 font-[Cairo] mb-1';

// ─── Strings ────────────────────────────────────────────────────────────────

const STRINGS = {
  title: { ar: 'كشف صحة مدرسية', en: 'School Health Exam' },
  patientLabel: { ar: 'المريض', en: 'Patient' },
  physicalExam: { ar: 'الكشف البدني', en: 'Physical Examination' },
  height: { ar: 'الطول (سم)', en: 'Height (cm)' },
  weight: { ar: 'الوزن (كجم)', en: 'Weight (kg)' },
  visionRight: { ar: 'النظر — العين اليمنى', en: 'Vision — Right eye' },
  visionLeft: { ar: 'النظر — العين اليسرى', en: 'Vision — Left eye' },
  hearingNormal: { ar: 'السمع طبيعي', en: 'Hearing normal' },
  yes: { ar: 'نعم', en: 'Yes' },
  no: { ar: 'لا', en: 'No' },
  dentalNotes: { ar: 'ملاحظات الأسنان', en: 'Dental notes' },
  generalNotes: { ar: 'ملاحظات عامة', en: 'General notes' },
  fitnessAssessment: { ar: 'تقييم اللياقة', en: 'Fitness Assessment' },
  restriction: { ar: 'القيود', en: 'Restrictions' },
  reasonNotFit: { ar: 'سبب عدم اللياقة', en: 'Reason not fit' },
  examDate: { ar: 'تاريخ الكشف', en: 'Exam date' },
  saving: { ar: 'جاري الحفظ...', en: 'Saving...' },
  saveAndIssue: { ar: 'حفظ وإصدار شهادة', en: 'Save & issue certificate' },
  saveOnly: { ar: 'حفظ فقط', en: 'Save only' },
  successMsg: { ar: 'تم حفظ كشف الصحة المدرسية بنجاح', en: 'School health record saved successfully' },
  errorMsg: { ar: 'حدث خطأ أثناء الحفظ', en: 'Error saving record' },
  visionPlaceholder: { ar: 'مثال: 6/6', en: 'e.g. 6/6' },
} as const;

// ─── Component ──────────────────────────────────────────────────────────────

export default function SchoolHealthForm({ patientId, patientName, lang }: SchoolHealthFormProps) {
  const isRtl = lang === 'ar';
  const academicYears = getAcademicYears();

  // Form state
  const [academicYear, setAcademicYear] = useState(academicYears[0]);
  const [schoolName, setSchoolName] = useState('');
  const [grade, setGrade] = useState(GRADES[0]!.value);
  const [examDate, setExamDate] = useState(new Date().toISOString().split('T')[0]);
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [visionRight, setVisionRight] = useState('');
  const [visionLeft, setVisionLeft] = useState('');
  const [hearingNormal, setHearingNormal] = useState<boolean | null>(null);
  const [dentalNotes, setDentalNotes] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [fitnessStatus, setFitnessStatus] = useState<FitnessStatus>('fit');
  const [restriction, setRestriction] = useState('');
  const [notFitReason, setNotFitReason] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const s = useCallback((key: keyof typeof STRINGS) => STRINGS[key][lang], [lang]);

  const getGradeLabel = useCallback(
    (g: (typeof GRADES)[number]) => (lang === 'ar' ? g.labelAr : g.labelEn),
    [lang]
  );

  const handleSubmit = async (issueCertificate: boolean) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    const selectedGrade = GRADES.find((g) => g.value === grade);

    try {
      const res = await fetch('/api/doctor/school-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          academic_year: academicYear,
          school_name_ar: schoolName,
          school_grade_ar: selectedGrade?.labelAr ?? grade,
          exam_date: examDate,
          height_cm: heightCm ? parseFloat(heightCm) : undefined,
          weight_kg: weightKg ? parseFloat(weightKg) : undefined,
          vision_right: visionRight || undefined,
          vision_left: visionLeft || undefined,
          hearing_normal: hearingNormal,
          dental_notes_ar: dentalNotes || undefined,
          general_notes_ar: generalNotes || undefined,
          fit_for_school: fitnessStatus === 'fit' || fitnessStatus === 'fit_with_restrictions',
          restriction_ar: fitnessStatus === 'fit_with_restrictions'
            ? restriction
            : fitnessStatus === 'not_fit'
              ? notFitReason
              : undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(json.error ?? 'Failed');
      }

      const record = await res.json();

      // If issue certificate requested, trigger PDF generation
      if (issueCertificate && record.id) {
        try {
          await fetch(`/api/doctor/school-health/certificate?record_id=${record.id}`, {
            method: 'POST',
          });
        } catch {
          // Certificate generation is best-effort; record is already saved
        }
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : s('errorMsg'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">🏫</span>
        <div>
          <h2 className="text-lg font-bold text-gray-900 font-[Cairo]">{s('title')}</h2>
          <p className="text-sm text-gray-500 font-[Cairo]">
            {s('patientLabel')}: {patientName}
          </p>
        </div>
      </div>

      {/* Academic info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>{t('paediatric.academicYear', lang)}</label>
          <select className={inputClass} value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
            {academicYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t('paediatric.schoolName', lang)}</label>
          <input
            type="text"
            dir={isRtl ? 'rtl' : 'ltr'}
            className={inputClass}
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>{t('paediatric.schoolGrade', lang)}</label>
          <select className={inputClass} value={grade} onChange={(e) => setGrade(e.target.value)}>
            {GRADES.map((g) => (
              <option key={g.value} value={g.value}>{getGradeLabel(g)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Exam date */}
      <div className="max-w-xs">
        <label className={labelClass}>{s('examDate')}</label>
        <input
          type="date"
          className={inputClass}
          value={examDate}
          onChange={(e) => setExamDate(e.target.value)}
        />
      </div>

      {/* Physical exam section */}
      <div>
        <h3 className="text-base font-bold text-gray-800 font-[Cairo] mb-3">{s('physicalExam')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Height */}
          <div>
            <label className={labelClass}>{s('height')}</label>
            <input
              type="number"
              step="0.1"
              min="50"
              max="200"
              className={inputClass}
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
            />
          </div>
          {/* Weight */}
          <div>
            <label className={labelClass}>{s('weight')}</label>
            <input
              type="number"
              step="0.1"
              min="5"
              max="150"
              className={inputClass}
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
            />
          </div>
          {/* Vision right */}
          <div>
            <label className={labelClass}>{s('visionRight')}</label>
            <input
              type="text"
              dir="ltr"
              className={`${inputClass} text-left`}
              placeholder={s('visionPlaceholder')}
              value={visionRight}
              onChange={(e) => setVisionRight(e.target.value)}
            />
          </div>
          {/* Vision left */}
          <div>
            <label className={labelClass}>{s('visionLeft')}</label>
            <input
              type="text"
              dir="ltr"
              className={`${inputClass} text-left`}
              placeholder={s('visionPlaceholder')}
              value={visionLeft}
              onChange={(e) => setVisionLeft(e.target.value)}
            />
          </div>
        </div>

        {/* Hearing */}
        <div className="mt-4">
          <label className={labelClass}>{s('hearingNormal')}</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="hearing"
                className="accent-teal-600"
                checked={hearingNormal === true}
                onChange={() => setHearingNormal(true)}
              />
              <span className="text-sm font-[Cairo]">{s('yes')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="hearing"
                className="accent-teal-600"
                checked={hearingNormal === false}
                onChange={() => setHearingNormal(false)}
              />
              <span className="text-sm font-[Cairo]">{s('no')}</span>
            </label>
          </div>
        </div>

        {/* Dental notes */}
        <div className="mt-4">
          <label className={labelClass}>{s('dentalNotes')}</label>
          <textarea
            dir={isRtl ? 'rtl' : 'ltr'}
            className={`${inputClass} min-h-[60px]`}
            value={dentalNotes}
            onChange={(e) => setDentalNotes(e.target.value)}
          />
        </div>

        {/* General notes */}
        <div className="mt-4">
          <label className={labelClass}>{s('generalNotes')}</label>
          <textarea
            dir={isRtl ? 'rtl' : 'ltr'}
            className={`${inputClass} min-h-[60px]`}
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
          />
        </div>
      </div>

      {/* Fitness assessment */}
      <div>
        <h3 className="text-base font-bold text-gray-800 font-[Cairo] mb-3">{s('fitnessAssessment')}</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="fitness"
              className="accent-teal-600"
              checked={fitnessStatus === 'fit'}
              onChange={() => setFitnessStatus('fit')}
            />
            <span className="text-sm font-[Cairo] font-medium text-green-700">
              {t('paediatric.fitForSchool', lang)}
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="fitness"
              className="accent-teal-600"
              checked={fitnessStatus === 'fit_with_restrictions'}
              onChange={() => setFitnessStatus('fit_with_restrictions')}
            />
            <span className="text-sm font-[Cairo] font-medium text-yellow-700">
              {t('paediatric.fitWithRestrictions', lang)}
            </span>
          </label>

          {fitnessStatus === 'fit_with_restrictions' && (
            <div className="mr-7">
              <label className={labelClass}>{s('restriction')}</label>
              <textarea
                dir={isRtl ? 'rtl' : 'ltr'}
                className={`${inputClass} min-h-[60px]`}
                value={restriction}
                onChange={(e) => setRestriction(e.target.value)}
              />
            </div>
          )}

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="fitness"
              className="accent-teal-600"
              checked={fitnessStatus === 'not_fit'}
              onChange={() => setFitnessStatus('not_fit')}
            />
            <span className="text-sm font-[Cairo] font-medium text-red-700">
              {t('paediatric.notFit', lang)}
            </span>
          </label>

          {fitnessStatus === 'not_fit' && (
            <div className="mr-7">
              <label className={labelClass}>{s('reasonNotFit')}</label>
              <textarea
                dir={isRtl ? 'rtl' : 'ltr'}
                className={`${inputClass} min-h-[60px]`}
                value={notFitReason}
                onChange={(e) => setNotFitReason(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Success / Error messages */}
      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-[Cairo]">
          {s('successMsg')}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-[Cairo]">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={loading || !schoolName}
          className="flex-1 rounded-lg border-2 border-teal-600 text-teal-600 py-2.5 font-[Cairo] font-semibold text-sm hover:bg-teal-50 transition-colors disabled:opacity-50"
        >
          {loading ? s('saving') : s('saveOnly')}
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={loading || !schoolName}
          className="flex-1 rounded-lg bg-teal-600 text-white py-2.5 font-[Cairo] font-semibold text-sm hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          {loading ? s('saving') : t('paediatric.issueCertificate', lang)}
        </button>
      </div>
    </div>
  );
}
