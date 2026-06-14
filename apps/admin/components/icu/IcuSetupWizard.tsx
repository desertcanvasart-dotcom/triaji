'use client';

import { useState } from 'react';

interface UnitConfig {
  unit_type: string;
  label: string;
  unit_name_en: string;
  total_beds: number;
  floor_en: string;
  phone_direct: string;
  accepts_transfers: boolean;
}

const ICU_TYPES: { type: string; label: string }[] = [
  { type: 'general_icu', label: 'General ICU' },
  { type: 'ccu', label: 'Cardiac ICU (CCU)' },
  { type: 'nicu', label: 'Neonatal ICU (NICU)' },
  { type: 'picu', label: 'Paediatric ICU (PICU)' },
  { type: 'surgical_icu', label: 'Surgical ICU' },
  { type: 'neuro_icu', label: 'Neurological ICU' },
  { type: 'burns_icu', label: 'Burns ICU' },
  { type: 'respiratory_icu', label: 'Respiratory ICU' },
];

export default function IcuSetupWizard() {
  const [step, setStep] = useState(1);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [configs, setConfigs] = useState<Map<string, UnitConfig>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function toggleType(type: string, label: string) {
    const next = new Set(selectedTypes);
    if (next.has(type)) {
      next.delete(type);
      const nextConfigs = new Map(configs);
      nextConfigs.delete(type);
      setConfigs(nextConfigs);
    } else {
      next.add(type);
      const nextConfigs = new Map(configs);
      nextConfigs.set(type, {
        unit_type: type,
        label,
        unit_name_en: label,
        total_beds: 10,
        floor_en: '',
        phone_direct: '',
        accepts_transfers: true,
      });
      setConfigs(nextConfigs);
    }
    setSelectedTypes(next);
  }

  function updateConfig(type: string, field: keyof UnitConfig, value: string | number | boolean) {
    const nextConfigs = new Map(configs);
    const current = nextConfigs.get(type);
    if (current) {
      nextConfigs.set(type, { ...current, [field]: value });
      setConfigs(nextConfigs);
    }
  }

  async function handleActivate() {
    setSubmitting(true);
    setError('');

    try {
      const units = Array.from(configs.values());
      const results = [];

      for (const unit of units) {
        const res = await fetch('/api/admin/icu/units', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unit_type: unit.unit_type,
            unit_name_ar: unit.unit_name_en, // Use English name as AR placeholder
            unit_name_en: unit.unit_name_en,
            total_beds: unit.total_beds,
            floor_ar: unit.floor_en,
            floor_en: unit.floor_en,
            phone_direct: unit.phone_direct || null,
            accepts_transfers: unit.accepts_transfers,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Failed to create ${unit.label}`);
        }

        results.push(await res.json());
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate ICU system');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="text-6xl mb-4">&#10003;</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">ICU System Activated</h2>
        <p className="text-gray-500 mb-6">
          Your ICU units have been created. Bed counts will show as 0 until your team updates them.
        </p>
        <a
          href="/icu/beds"
          className="btn-primary inline-block"
        >
          Go to Bed Management
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress bar */}
      <div className="flex items-center justify-between mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                s <= step
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div
                className={`flex-1 h-0.5 mx-2 ${
                  s < step ? 'bg-teal-600' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Step 1: Select ICU types */}
      {step === 1 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            Which ICU units does your hospital have?
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Select all ICU unit types that apply to your hospital.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ICU_TYPES.map(({ type, label }) => (
              <button
                key={type}
                onClick={() => toggleType(type, label)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  selectedTypes.has(type)
                    ? 'border-teal-600 bg-teal-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      selectedTypes.has(type)
                        ? 'border-teal-600 bg-teal-600'
                        : 'border-gray-300'
                    }`}
                  >
                    {selectedTypes.has(type) && (
                      <span className="text-white text-xs">&#10003;</span>
                    )}
                  </div>
                  <span className="font-medium text-gray-900">{label}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={selectedTypes.size === 0}
              className="btn-primary"
            >
              Next: Configure Units
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Configure each unit */}
      {step === 2 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            Configure each unit
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Set the details for each ICU unit.
          </p>

          <div className="space-y-4">
            {Array.from(configs.entries()).map(([type, config]) => (
              <div
                key={type}
                className="bg-white rounded-xl border border-gray-200 p-5"
              >
                <h3 className="font-semibold text-gray-900 mb-4">{config.label}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Unit Name</label>
                    <input
                      type="text"
                      value={config.unit_name_en}
                      onChange={(e) => updateConfig(type, 'unit_name_en', e.target.value)}
                      className="input-field"
                      placeholder="e.g. General ICU"
                    />
                  </div>
                  <div>
                    <label className="label">Total Beds</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={config.total_beds}
                      onChange={(e) =>
                        updateConfig(type, 'total_beds', parseInt(e.target.value) || 1)
                      }
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label">Floor</label>
                    <input
                      type="text"
                      value={config.floor_en}
                      onChange={(e) => updateConfig(type, 'floor_en', e.target.value)}
                      className="input-field"
                      placeholder="e.g. 3rd Floor, Building A"
                    />
                  </div>
                  <div>
                    <label className="label">Direct Phone</label>
                    <input
                      type="text"
                      value={config.phone_direct}
                      onChange={(e) => updateConfig(type, 'phone_direct', e.target.value)}
                      className="input-field"
                      placeholder="e.g. +966-1-XXX-XXXX"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.accepts_transfers}
                        onChange={(e) =>
                          updateConfig(type, 'accepts_transfers', e.target.checked)
                        }
                        className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm text-gray-700">
                        Accepts external transfers
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="btn-secondary"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="btn-primary"
            >
              Next: Review
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm & Activate */}
      {step === 3 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            Confirm &amp; Activate
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Review your ICU configuration before activating.
          </p>

          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {Array.from(configs.values()).map((config) => (
              <div key={config.unit_type} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{config.unit_name_en}</p>
                  <p className="text-sm text-gray-500">
                    {config.floor_en || 'No floor specified'}
                    {config.phone_direct ? ` | ${config.phone_direct}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">{config.total_beds}</p>
                  <p className="text-xs text-gray-500">beds</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <p className="mb-1 font-medium">Important</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>Verified Triajji doctors will be able to see your available beds in real time.</li>
              <li>Bed counts will show as 0 until your team updates them.</li>
            </ul>
          </div>

          <div className="mt-8 flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="btn-secondary"
            >
              Back
            </button>
            <button
              onClick={handleActivate}
              disabled={submitting}
              className="btn-primary"
            >
              {submitting ? 'Activating...' : 'Activate ICU System'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
