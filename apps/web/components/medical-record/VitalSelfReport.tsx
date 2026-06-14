'use client';

import { useState } from 'react';
import { t, type Lang } from '@triaji/shared/i18n';

interface VitalSelfReportProps {
  lang: Lang;
  onSaved: () => void;
}

export default function VitalSelfReport({ lang, onSaved }: VitalSelfReportProps) {
  const isRtl = lang === 'ar';
  const [weight, setWeight] = useState('');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [glucose, setGlucose] = useState('');
  const [glucoseContext, setGlucoseContext] = useState<'fasting' | 'after_meal'>('fasting');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const vitals: Record<string, unknown>[] = [];

      if (weight.trim()) {
        vitals.push({ type: 'weight', value: parseFloat(weight), unit: 'kg' });
      }
      if (systolic.trim() && diastolic.trim()) {
        vitals.push({
          type: 'blood_pressure',
          systolic: parseInt(systolic, 10),
          diastolic: parseInt(diastolic, 10),
          unit: 'mmHg',
        });
      }
      if (glucose.trim()) {
        vitals.push({
          type: 'blood_glucose',
          value: parseFloat(glucose),
          unit: 'mg/dL',
          context: glucoseContext,
        });
      }

      if (vitals.length === 0) return;

      const res = await fetch('/api/patient/vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ vitals }),
      });

      if (res.ok) {
        setSaved(true);
        setWeight('');
        setSystolic('');
        setDiastolic('');
        setGlucose('');
        onSaved();
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // Silent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'}>
      <h3 className="text-base font-bold text-gray-900 mb-3">
        {t('medicalRecord.logVitals', lang)}
      </h3>
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        {/* Weight */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('vitals.weight', lang)} (kg)
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="70"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            dir="ltr"
          />
        </div>

        {/* Blood Pressure */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('vitals.bloodPressure', lang)} (mmHg)
          </label>
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <input
                type="number"
                inputMode="numeric"
                value={systolic}
                onChange={(e) => setSystolic(e.target.value)}
                placeholder={t('vitals.systolic', lang)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                dir="ltr"
              />
            </div>
            <span className="text-gray-400 font-bold">/</span>
            <div className="flex-1">
              <input
                type="number"
                inputMode="numeric"
                value={diastolic}
                onChange={(e) => setDiastolic(e.target.value)}
                placeholder={t('vitals.diastolic', lang)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        {/* Blood Glucose */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('vitals.bloodGlucose', lang)} (mg/dL)
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={glucose}
            onChange={(e) => setGlucose(e.target.value)}
            placeholder="100"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 mb-2"
            dir="ltr"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setGlucoseContext('fasting')}
              className={`flex-1 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                glucoseContext === 'fasting'
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-teal-400'
              }`}
            >
              {t('vitals.fasting', lang)}
            </button>
            <button
              type="button"
              onClick={() => setGlucoseContext('after_meal')}
              className={`flex-1 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                glucoseContext === 'after_meal'
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-teal-400'
              }`}
            >
              {t('vitals.afterMeal', lang)}
            </button>
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving || (!weight.trim() && !systolic.trim() && !glucose.trim())}
          className="w-full bg-teal-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {saving
            ? t('common.loading', lang)
            : saved
              ? '\u2713'
              : t('vitals.save', lang)}
        </button>
      </div>
    </div>
  );
}
