'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

interface Branch {
  id: string;
  name_ar: string;
  name_en: string | null;
}

interface Doctor {
  id: string;
  name_ar: string;
  name_en: string | null;
  specialty: string | null;
}

type Step = 'identity' | 'copy_settings' | 'assign_doctors';

const STEPS: { key: Step; label: string; number: number }[] = [
  { key: 'identity', label: 'Branch Identity', number: 1 },
  { key: 'copy_settings', label: 'Copy Settings', number: 2 },
  { key: 'assign_doctors', label: 'Assign Doctors', number: 3 },
];

export default function AddBranchWizard({ chainId }: { chainId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('identity');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Identity
  const [branchNameAr, setBranchNameAr] = useState('');
  const [branchNameEn, setBranchNameEn] = useState('');
  const [address, setAddress] = useState('');
  const [governorateId, setGovernorateId] = useState('');
  const [phone, setPhone] = useState('');

  // Step 2: Copy settings
  const [existingBranches, setExistingBranches] = useState<Branch[]>([]);
  const [copyFromBranchId, setCopyFromBranchId] = useState('');

  // Step 3: Assign doctors
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorIds, setSelectedDoctorIds] = useState<string[]>([]);

  const getAuthHeaders = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    return (token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' }) as HeadersInit;
  }, []);

  // Fetch existing branches for copy-from dropdown
  useEffect(() => {
    async function load() {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/admin/chain/${chainId}/branches`, { headers });
        if (res.ok) {
          const data = await res.json();
          setExistingBranches(data.branches ?? []);
        }
      } catch {
        // ignore
      }
    }
    load();
  }, [chainId, getAuthHeaders]);

  // Fetch doctors for assignment
  useEffect(() => {
    async function load() {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/admin/chain/${chainId}/doctors`, { headers });
        if (res.ok) {
          const data = await res.json();
          setDoctors(data.doctors ?? []);
        }
      } catch {
        // ignore
      }
    }
    load();
  }, [chainId, getAuthHeaders]);

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  function goNext() {
    if (step === 'identity') {
      if (!branchNameAr.trim()) {
        setError('Branch name (Arabic) is required.');
        return;
      }
      setError('');
      setStep('copy_settings');
    } else if (step === 'copy_settings') {
      setStep('assign_doctors');
    }
  }

  function goBack() {
    if (step === 'copy_settings') setStep('identity');
    if (step === 'assign_doctors') setStep('copy_settings');
  }

  function toggleDoctor(doctorId: string) {
    setSelectedDoctorIds((prev) =>
      prev.includes(doctorId)
        ? prev.filter((id) => id !== doctorId)
        : [...prev, doctorId]
    );
  }

  async function handleSubmit() {
    setLoading(true);
    setError('');

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/chain/${chainId}/branches`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          branch_name_ar: branchNameAr.trim(),
          branch_name_en: branchNameEn.trim() || null,
          address: address.trim() || null,
          governorate_id: governorateId || null,
          phone: phone.trim() || null,
          copy_from_branch_id: copyFromBranchId || null,
          doctor_ids: selectedDoctorIds.length > 0 ? selectedDoctorIds : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to create branch.');
        setLoading(false);
        return;
      }

      router.push('/chain/branches');
      router.refresh();
    } catch {
      setError('An unexpected error occurred.');
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step Indicator */}
      <div className="flex items-center justify-center mb-8">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                i <= currentStepIndex
                  ? 'bg-violet-600 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {s.number}
            </div>
            <span
              className={`ml-2 text-sm font-medium ${
                i <= currentStepIndex ? 'text-violet-700' : 'text-gray-400'
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={`w-12 h-0.5 mx-3 ${
                  i < currentStepIndex ? 'bg-violet-600' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-4 py-2.5 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Step 1: Identity */}
        {step === 'identity' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Branch Identity</h2>

            <div>
              <label htmlFor="branch_name_ar" className="block text-sm font-medium text-gray-700 mb-1">
                Branch Name (Arabic) *
              </label>
              <input
                id="branch_name_ar"
                type="text"
                value={branchNameAr}
                onChange={(e) => setBranchNameAr(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                placeholder="e.g. فرع المعادي"
                dir="rtl"
                required
              />
            </div>

            <div>
              <label htmlFor="branch_name_en" className="block text-sm font-medium text-gray-700 mb-1">
                Branch Name (English)
              </label>
              <input
                id="branch_name_en"
                type="text"
                value={branchNameEn}
                onChange={(e) => setBranchNameEn(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                placeholder="e.g. Maadi Branch"
              />
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                id="address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                placeholder="Full address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="governorate" className="block text-sm font-medium text-gray-700 mb-1">
                  Governorate ID
                </label>
                <input
                  id="governorate"
                  type="text"
                  value={governorateId}
                  onChange={(e) => setGovernorateId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  placeholder="e.g. cairo"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  placeholder="01XXXXXXXXX"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Copy Settings */}
        {step === 'copy_settings' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Copy Settings</h2>
            <p className="text-sm text-gray-500 mb-4">
              Optionally copy configuration from an existing branch. This includes booking mode,
              working hours, and other tenant settings.
            </p>

            {existingBranches.length > 0 ? (
              <div>
                <label htmlFor="copy_from" className="block text-sm font-medium text-gray-700 mb-1">
                  Copy from branch
                </label>
                <select
                  id="copy_from"
                  value={copyFromBranchId}
                  onChange={(e) => setCopyFromBranchId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                >
                  <option value="">Don&apos;t copy (start fresh)</option>
                  {existingBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name_ar} {b.name_en ? `(${b.name_en})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-500 text-center">
                No existing branches to copy from. This will be your first branch.
              </div>
            )}
          </div>
        )}

        {/* Step 3: Assign Doctors */}
        {step === 'assign_doctors' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Assign Doctors</h2>
            <p className="text-sm text-gray-500 mb-4">
              Select doctors to assign to this new branch. You can change assignments later.
            </p>

            {doctors.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {doctors.map((doctor) => (
                  <label
                    key={doctor.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedDoctorIds.includes(doctor.id)
                        ? 'border-violet-300 bg-violet-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedDoctorIds.includes(doctor.id)}
                      onChange={() => toggleDoctor(doctor.id)}
                      className="w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{doctor.name_ar}</p>
                      {doctor.specialty && (
                        <p className="text-xs text-gray-500">{doctor.specialty}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-500 text-center">
                No doctors found in this chain yet. You can assign doctors later.
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
          {currentStepIndex > 0 ? (
            <button
              onClick={goBack}
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step === 'assign_doctors' ? (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-violet-600 text-white px-6 py-2.5 rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Branch'}
            </button>
          ) : (
            <button
              onClick={goNext}
              className="bg-violet-600 text-white px-6 py-2.5 rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
