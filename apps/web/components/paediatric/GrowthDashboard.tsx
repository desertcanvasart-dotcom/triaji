'use client';

import { useState, useEffect, useCallback } from 'react';
import { t, type Lang } from '@triaji/shared/i18n';
import type { GrowthMeasurement, WhoGrowthReference } from '@triaji/shared/types/paediatric';
import GrowthChart from './GrowthChart';

interface GrowthDashboardProps {
  childId: string;
  lang: Lang;
}

type MeasureTab = 'weight' | 'height' | 'head_circ';

export default function GrowthDashboard({ childId, lang }: GrowthDashboardProps) {
  const isRtl = lang === 'ar';
  const [activeTab, setActiveTab] = useState<MeasureTab>('weight');
  const [measurements, setMeasurements] = useState<GrowthMeasurement[]>([]);
  const [reference, setReference] = useState<WhoGrowthReference[]>([]);
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [newWeight, setNewWeight] = useState('');
  const [newHeight, setNewHeight] = useState('');
  const [newHeadCirc, setNewHeadCirc] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/child/${childId}/growth`);
      const data = await res.json();
      if (res.ok) {
        setMeasurements(data.measurements ?? []);
        setReference(data.reference ?? []);
        setSex(data.sex ?? 'male');
        setDateOfBirth(data.dateOfBirth ?? '');
      }
    } catch {
      setError(t('common.error', lang));
    } finally {
      setLoading(false);
    }
  }, [childId, lang]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Check if child is under 2 for head circ tab
  const ageMonths = dateOfBirth
    ? Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
    : 0;
  const showHeadCirc = ageMonths < 24;

  // Latest measurement summary
  const latest = measurements.length > 0 ? measurements[measurements.length - 1] : null;

  const handleSaveMeasurement = async () => {
    if (!newWeight && !newHeight) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/child/${childId}/growth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weight_kg: newWeight ? Number(newWeight) : undefined,
          height_cm: newHeight ? Number(newHeight) : undefined,
          head_circ_cm: newHeadCirc ? Number(newHeadCirc) : undefined,
          measured_at: newDate,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? t('common.error', lang));
        setSaving(false);
        return;
      }

      // Reset form and refresh
      setNewWeight('');
      setNewHeight('');
      setNewHeadCirc('');
      setShowAddForm(false);
      setSaving(false);
      await fetchData();
    } catch {
      setError(t('common.error', lang));
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">{t('common.loading', lang)}</div>
      </div>
    );
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">
        {t('paediatric.growthChart', lang)}
      </h1>

      {/* Current stats summary */}
      {latest && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {latest.weight_kg !== null && (
            <div className="rounded-lg bg-teal-50 p-3 text-center">
              <div className="text-xs text-gray-500">
                {t('paediatric.weightForAge', lang)}
              </div>
              <div className="mt-1 text-lg font-bold text-teal-700">
                {latest.weight_kg} <span className="text-xs font-normal">kg</span>
              </div>
              {latest.weight_percentile !== null && (
                <div className="mt-0.5 text-xs text-gray-500">
                  P{latest.weight_percentile}
                </div>
              )}
            </div>
          )}
          {latest.height_cm !== null && (
            <div className="rounded-lg bg-blue-50 p-3 text-center">
              <div className="text-xs text-gray-500">
                {t('paediatric.heightForAge', lang)}
              </div>
              <div className="mt-1 text-lg font-bold text-blue-700">
                {latest.height_cm} <span className="text-xs font-normal">cm</span>
              </div>
              {latest.height_percentile !== null && (
                <div className="mt-0.5 text-xs text-gray-500">
                  P{latest.height_percentile}
                </div>
              )}
            </div>
          )}
          {latest.bmi !== null && (
            <div className="rounded-lg bg-purple-50 p-3 text-center">
              <div className="text-xs text-gray-500">BMI</div>
              <div className="mt-1 text-lg font-bold text-purple-700">
                {latest.bmi}
              </div>
              {latest.bmi_percentile !== null && (
                <div className="mt-0.5 text-xs text-gray-500">
                  P{latest.bmi_percentile}
                </div>
              )}
            </div>
          )}
          {latest.head_circ_cm !== null && showHeadCirc && (
            <div className="rounded-lg bg-orange-50 p-3 text-center">
              <div className="text-xs text-gray-500">
                {t('paediatric.headCirc', lang)}
              </div>
              <div className="mt-1 text-lg font-bold text-orange-700">
                {latest.head_circ_cm} <span className="text-xs font-normal">cm</span>
              </div>
              {latest.head_circ_percentile !== null && (
                <div className="mt-0.5 text-xs text-gray-500">
                  P{latest.head_circ_percentile}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setActiveTab('weight')}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            activeTab === 'weight'
              ? 'bg-white text-teal-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('paediatric.weightForAge', lang)}
        </button>
        <button
          onClick={() => setActiveTab('height')}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            activeTab === 'height'
              ? 'bg-white text-teal-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('paediatric.heightForAge', lang)}
        </button>
        {showHeadCirc && (
          <button
            onClick={() => setActiveTab('head_circ')}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              activeTab === 'head_circ'
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('paediatric.headCirc', lang)}
          </button>
        )}
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <GrowthChart
          patientId={childId}
          sex={sex}
          dateOfBirth={dateOfBirth}
          measure={activeTab}
          measurements={measurements}
          reference={reference}
          lang={lang}
        />
      </div>

      {/* Add measurement button / form */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="mt-4 w-full rounded-lg bg-teal-600 py-3 text-white font-semibold hover:bg-teal-700 transition-colors"
        >
          {t('paediatric.addMeasurement', lang)}
        </button>
      ) : (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 space-y-4">
          <h3 className="font-semibold text-gray-900">
            {t('paediatric.addMeasurement', lang)}
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                {t('paediatric.weightForAge', lang)} (kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                placeholder="e.g. 8.5"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                {t('paediatric.heightForAge', lang)} (cm)
              </label>
              <input
                type="number"
                step="0.1"
                value={newHeight}
                onChange={(e) => setNewHeight(e.target.value)}
                placeholder="e.g. 72"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>
            {showHeadCirc && (
              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  {t('paediatric.headCirc', lang)} (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={newHeadCirc}
                  onChange={(e) => setNewHeadCirc(e.target.value)}
                  placeholder="e.g. 44"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                {t('paediatric.dateOfBirth', lang)}
              </label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('common.cancel', lang)}
            </button>
            <button
              type="button"
              onClick={handleSaveMeasurement}
              disabled={saving || (!newWeight && !newHeight)}
              className="flex-1 rounded-lg bg-teal-600 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-teal-700"
            >
              {saving ? t('common.loading', lang) : t('paediatric.saveMeasurement', lang)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
