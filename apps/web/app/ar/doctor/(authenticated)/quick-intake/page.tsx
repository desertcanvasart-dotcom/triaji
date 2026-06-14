'use client';

import { useState, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

type BiologicalSex = 'male' | 'female';

interface ChronicCondition {
  key: string;
  label: string;
  checked: boolean;
}

interface IntakeForm {
  sex: BiologicalSex | null;
  age: string;
  isSmoker: boolean;
  chronicConditions: ChronicCondition[];
  symptoms: string;
}

interface RedFlag {
  flag: string;
  explanation: string;
}

interface IntakeResult {
  urgency_level: string;
  urgency_label_ar: string;
  specialty_name_ar: string;
  risk_factors: string[];
  summary_ar: string;
  next_steps: string[];
  red_flags: RedFlag[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const INITIAL_CONDITIONS: ChronicCondition[] = [
  { key: 'hypertension', label: 'ضغط دم مرتفع', checked: false },
  { key: 'diabetes', label: 'سكري', checked: false },
  { key: 'heart_disease', label: 'أمراض قلب', checked: false },
];

const INITIAL_FORM: IntakeForm = {
  sex: null,
  age: '',
  isSmoker: false,
  chronicConditions: INITIAL_CONDITIONS.map((c) => ({ ...c })),
  symptoms: '',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getUrgencyStyle(level: string): { bg: string; text: string; border: string } {
  switch (level) {
    case 'emergency':
      return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' };
    case 'urgent':
      return { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' };
    case 'semi_urgent':
      return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' };
    case 'routine':
      return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' };
  }
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function QuickIntakePage() {
  const [form, setForm] = useState<IntakeForm>({ ...INITIAL_FORM });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<IntakeResult | null>(null);

  const isFormValid = form.sex !== null && form.age.trim() !== '' && form.symptoms.trim() !== '';

  function updateSex(sex: BiologicalSex) {
    setForm((prev) => ({ ...prev, sex }));
  }

  function updateAge(age: string) {
    const cleaned = age.replace(/\D/g, '');
    setForm((prev) => ({ ...prev, age: cleaned }));
  }

  function toggleSmoker() {
    setForm((prev) => ({ ...prev, isSmoker: !prev.isSmoker }));
  }

  function toggleCondition(key: string) {
    setForm((prev) => ({
      ...prev,
      chronicConditions: prev.chronicConditions.map((c) =>
        c.key === key ? { ...c, checked: !c.checked } : c
      ),
    }));
  }

  function updateSymptoms(symptoms: string) {
    setForm((prev) => ({ ...prev, symptoms }));
  }

  const handleSubmit = useCallback(async () => {
    if (!isFormValid) return;

    setIsSubmitting(true);
    setError('');
    setResult(null);

    try {
      const payload = {
        biological_sex: form.sex,
        age: parseInt(form.age, 10),
        is_smoker: form.isSmoker,
        chronic_conditions: form.chronicConditions
          .filter((c) => c.checked)
          .map((c) => c.key),
        symptoms_text: form.symptoms.trim(),
      };

      const res = await fetch('/api/doctor/quick-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setError('تعذر إجراء التقييم. حاول تاني.');
        return;
      }

      const data = (await res.json()) as IntakeResult;
      setResult(data);
    } catch {
      setError('مفيش اتصال بالسيرفر');
    } finally {
      setIsSubmitting(false);
    }
  }, [form, isFormValid]);

  function handleReset() {
    setForm({
      ...INITIAL_FORM,
      chronicConditions: INITIAL_CONDITIONS.map((c) => ({ ...c })),
    });
    setResult(null);
    setError('');
  }

  return (
    <div className="p-6 sm:p-8 max-w-2xl mx-auto space-y-6 pb-12">
      {/* Print styles */}
      <style>{`
        @media print {
          nav, aside, button, textarea, input, .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
          section { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1A2F4A]">فرز سريع</h1>
        <p className="text-sm text-gray-500 mt-1">
          تقييم سريع لمريض زائر بدون موعد مسبق
        </p>
      </div>

      {/* Show form or result */}
      {!result ? (
        <div className="space-y-6">
          {/* Step 1: Basic info */}
          <section className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
            <h2 className="text-lg font-bold text-[#1A2F4A]">معلومات أساسية</h2>

            {/* Sex */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الجنس</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => updateSex('male')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                    form.sex === 'male'
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  ذكر
                </button>
                <button
                  type="button"
                  onClick={() => updateSex('female')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                    form.sex === 'female'
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  أنثى
                </button>
              </div>
            </div>

            {/* Age */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                العمر التقريبي
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={form.age}
                onChange={(e) => updateAge(e.target.value)}
                placeholder="مثلا: 45"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none transition-colors focus:border-teal-500 bg-white"
              />
            </div>

            {/* Smoker */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                هل المريض مدخن؟
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { if (!form.isSmoker) toggleSmoker(); }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                    form.isSmoker
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  نعم
                </button>
                <button
                  type="button"
                  onClick={() => { if (form.isSmoker) toggleSmoker(); }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                    !form.isSmoker
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  لا
                </button>
              </div>
            </div>

            {/* Chronic conditions */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                هل عنده ضغط أو سكري أو قلب؟
              </label>
              <div className="space-y-2">
                {form.chronicConditions.map((condition) => (
                  <label
                    key={condition.key}
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-gray-300 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={condition.checked}
                      onChange={() => toggleCondition(condition.key)}
                      className="w-5 h-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm font-medium text-[#1A2F4A]">{condition.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          {/* Step 2: Symptoms */}
          <section className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-[#1A2F4A]">الأعراض</h2>
            <textarea
              value={form.symptoms}
              onChange={(e) => updateSymptoms(e.target.value)}
              placeholder="مثال: صداع شديد من الصبح مع حمى وألم في الرقبة"
              rows={5}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none transition-colors focus:border-teal-500 bg-white resize-y leading-relaxed"
            />
            <p className="text-xs text-gray-400">اكتب أعراض المريض بالعربي</p>
          </section>

          {/* Error */}
          {error && (
            <div className="bg-red-50 text-red-700 rounded-xl p-3 text-sm">{error}</div>
          )}

          {/* Step 3: Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className="w-full bg-teal-600 text-white font-bold py-4 rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
          >
            {isSubmitting ? 'جارٍ التحليل...' : 'ابدأ التقييم الفوري'}
          </button>
        </div>
      ) : (
        /* Step 4: Result display */
        <div className="space-y-6">
          <section className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
            <h2 className="text-lg font-bold text-[#1A2F4A]">نتيجة التقييم</h2>

            {/* Urgency badge */}
            <div className="flex justify-center">
              <div
                className={`px-8 py-4 rounded-2xl border-2 text-center ${getUrgencyStyle(result.urgency_level).bg} ${getUrgencyStyle(result.urgency_level).text} ${getUrgencyStyle(result.urgency_level).border}`}
              >
                <span className="text-xs font-medium block mb-1">درجة الإلحاح</span>
                <span className="text-2xl font-bold block">{result.urgency_label_ar}</span>
              </div>
            </div>

            {/* Specialty */}
            <div className="bg-teal-50 rounded-xl p-4 text-center">
              <span className="text-sm text-gray-600 block mb-1">التخصص الموصى به</span>
              <span className="text-lg font-bold text-teal-700">{result.specialty_name_ar}</span>
            </div>

            {/* Risk factors */}
            {result.risk_factors.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2">عوامل الخطورة</h3>
                <div className="flex flex-wrap gap-2">
                  {result.risk_factors.map((factor) => (
                    <span
                      key={factor}
                      className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full text-xs font-medium"
                    >
                      {factor}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-2">ملخص التقييم</h3>
              <p className="text-sm text-[#1A2F4A] leading-relaxed bg-gray-50 rounded-xl p-4">
                {result.summary_ar}
              </p>
            </div>

            {/* Next steps */}
            {result.next_steps.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2">الخطوات المقترحة</h3>
                <ol className="space-y-2 pr-4">
                  {result.next_steps.map((step, idx) => (
                    <li key={idx} className="flex gap-3 text-sm text-[#1A2F4A]">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Red flags */}
            {result.red_flags.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-red-800">علامات تحذيرية</h3>
                <ul className="space-y-2">
                  {result.red_flags.map((rf, idx) => (
                    <li key={idx} className="text-sm text-red-700">
                      <span className="font-semibold">{rf.flag}</span>
                      {rf.explanation && (
                        <span className="text-red-600"> — {rf.explanation}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Action buttons */}
          <div className="flex gap-3 no-print">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 border-2 border-teal-600 text-teal-600 font-semibold py-3 rounded-xl hover:bg-teal-50 transition-colors"
            >
              طباعة الملخص
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 bg-teal-600 text-white font-semibold py-3 rounded-xl hover:bg-teal-700 transition-colors"
            >
              تقييم جديد
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
