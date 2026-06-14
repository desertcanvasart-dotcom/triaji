'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import GPNoteForm from '@/components/care/GPNoteForm';
import ProtocolSection from '@/components/care/ProtocolSection';
import ReferralSection from '@/components/care/ReferralSection';
import { use } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PatientInfo {
  id: string;
  phone: string;
  nameAr: string | null;
  nameEn: string | null;
  dateOfBirth: string | null;
  preferredLanguage: string;
}

interface ProfileBase {
  age: number | null;
  biological_sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  bmi: number | null;
  smoking_status: string | null;
  blood_pressure: string | null;
  diabetes_type: string | null;
  diabetes_control: string | null;
  heart_condition: string | null;
  kidney_disease: string | null;
  liver_disease: string | null;
  risk_level: string | null;
  background_risk_score: number | null;
}

interface PatientDetail {
  patient: PatientInfo;
  accessType: 'gp' | 'grant';
  grantScope: string | null;
  profile: {
    base: ProfileBase;
    allergies: unknown[];
    chronicConditions: unknown[];
    medications: unknown[];
    surgeries: unknown[];
    familyHistory: unknown[];
  } | null;
  vitals: unknown[];
  followUps: unknown[];
  labResults: unknown[];
  prescriptions: unknown[];
  protocols: {
    id: string;
    protocolId: string;
    enrolledAt: string;
    compliancePct: number | null;
    nameAr: string | null;
    nameEn: string | null;
    conditionCode: string | null;
  }[];
  alerts: {
    id: string;
    alertType: string;
    severity: string;
    messageAr: string;
    messageEn: string;
    createdAt: string;
    resolvedAt: string | null;
  }[];
  gpNotes: {
    id: string;
    note_ar: string;
    note_en: string | null;
    created_at: string;
    doctor_account_id: string;
  }[];
  referrals: {
    id: string;
    referred_to_specialty_ar: string | null;
    referred_to_specialty_en: string | null;
    reason_ar: string | null;
    reason_en: string | null;
    status: string;
    created_at: string;
  }[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function maskPhone(phone: string): string {
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-3)}`;
}

function getRiskBadge(level: string | null): { label: string; className: string } {
  switch (level) {
    case 'high': return { label: 'High Risk', className: 'bg-red-100 text-red-700' };
    case 'medium': return { label: 'Medium Risk', className: 'bg-amber-100 text-amber-700' };
    case 'low': return { label: 'Low Risk', className: 'bg-green-100 text-green-700' };
    default: return { label: 'Unassessed', className: 'bg-gray-100 text-gray-600' };
  }
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="p-6 md:p-8 animate-pulse space-y-6" dir="ltr">
      <div className="h-8 bg-gray-200 rounded w-1/3" />
      <div className="h-32 bg-gray-100 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-40 bg-gray-100 rounded-xl" />)}
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function GPPatientDetailPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPatientDetail() {
      try {
        const res = await fetch(`/api/doctor/patients/${patientId}`);
        if (res.status === 401) {
          router.replace('/en/doctor/login');
          return;
        }
        if (res.status === 403) {
          setError('You do not have access to this patient');
          return;
        }
        if (!res.ok) {
          setError('Failed to load patient data');
          return;
        }
        const result = await res.json();
        setData(result);
      } catch {
        setError('Failed to load patient data');
      } finally {
        setLoading(false);
      }
    }

    fetchPatientDetail();
  }, [patientId, router]);

  const handleNoteAdded = useCallback((note: { id: string; note_ar: string; note_en: string | null; created_at: string; doctor_account_id?: string }) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        gpNotes: [{ ...note, doctor_account_id: note.doctor_account_id ?? '' }, ...prev.gpNotes],
      };
    });
  }, []);

  if (loading) return <DetailSkeleton />;

  if (error) {
    return (
      <div className="p-6 md:p-8" dir="ltr">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg text-sm"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { patient, profile, alerts, protocols, referrals, gpNotes, vitals, followUps } = data;
  const base = profile?.base;
  const risk = getRiskBadge(base?.risk_level ?? null);
  const unresolvedAlerts = alerts.filter(a => !a.resolvedAt);
  const displayName = patient.nameEn || patient.nameAr || maskPhone(patient.phone);

  return (
    <div className="p-6 md:p-8 space-y-6" dir="ltr">
      {/* Back button + header */}
      <div className="flex items-center gap-4">
        <Link
          href="/en/doctor/patients"
          className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1A2F4A]">{displayName}</h1>
          <p className="text-sm text-gray-500">
            {base?.age ? `${base.age} y/o` : ''}
            {base?.age && base?.biological_sex ? ' - ' : ''}
            {base?.biological_sex === 'male' ? 'Male' : base?.biological_sex === 'female' ? 'Female' : ''}
          </p>
        </div>
        <span className={`px-3 py-1 text-xs font-medium rounded-full ${risk.className} ml-auto`}>
          {risk.label}
          {base?.background_risk_score ? ` (${base.background_risk_score})` : ''}
        </span>
      </div>

      {/* Alerts banner */}
      {unresolvedAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            {unresolvedAlerts.length} alert{unresolvedAlerts.length > 1 ? 's' : ''} requiring attention
          </h3>
          <div className="space-y-2">
            {unresolvedAlerts.slice(0, 5).map(alert => (
              <div key={alert.id} className={`flex items-start gap-2 text-sm ${
                alert.severity === 'critical' ? 'text-red-700' : 'text-amber-700'
              }`}>
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  alert.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'
                }`} />
                <span>{alert.messageEn || alert.messageAr}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Patient profile summary */}
      {base && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-bold text-[#1A2F4A] mb-4">Health Profile</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {base.blood_pressure && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-gray-500 text-xs">Blood Pressure</p>
                <p className="font-bold text-[#1A2F4A]">{base.blood_pressure}</p>
              </div>
            )}
            {base.bmi && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-gray-500 text-xs">BMI</p>
                <p className="font-bold text-[#1A2F4A]">{base.bmi}</p>
              </div>
            )}
            {base.diabetes_type && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-gray-500 text-xs">Diabetes</p>
                <p className="font-bold text-[#1A2F4A]">{base.diabetes_type}</p>
              </div>
            )}
            {base.smoking_status && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-gray-500 text-xs">Smoking</p>
                <p className="font-bold text-[#1A2F4A]">
                  {base.smoking_status === 'current' ? 'Current' : base.smoking_status === 'former' ? 'Former' : 'Non-smoker'}
                </p>
              </div>
            )}
          </div>

          {/* Chronic conditions */}
          {profile?.chronicConditions && (profile.chronicConditions as { condition_name_en?: string; condition_name_ar?: string }[]).length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-2">Chronic Conditions</p>
              <div className="flex flex-wrap gap-1">
                {(profile.chronicConditions as { condition_name_en?: string; condition_name_ar?: string; id: string }[]).map(c => (
                  <span key={c.id} className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full">
                    {c.condition_name_en ?? c.condition_name_ar ?? ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Medications */}
          {profile?.medications && (profile.medications as { medication_name_en?: string; medication_name_ar?: string }[]).length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-2">Current Medications</p>
              <div className="flex flex-wrap gap-1">
                {(profile.medications as { medication_name_en?: string; medication_name_ar?: string; id: string }[]).map(m => (
                  <span key={m.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                    {m.medication_name_en ?? m.medication_name_ar ?? ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Protocols + GP Notes */}
        <div className="space-y-6">
          <ProtocolSection protocols={protocols} lang="en" />
          <GPNoteForm
            patientId={patientId}
            notes={gpNotes}
            lang="en"
            onNoteAdded={handleNoteAdded}
          />
        </div>

        {/* Right: Vitals, Follow-ups, Referrals */}
        <div className="space-y-6">
          {/* Vitals summary */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-bold text-[#1A2F4A] mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              Vitals
            </h3>
            {(vitals as { vital_type: string; value: number; unit: string; measured_at: string }[]).length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {(vitals as { vital_type: string; value: number; unit: string; measured_at: string }[]).slice(0, 6).map((v, i) => (
                  <div key={i} className="p-2.5 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">{v.vital_type}</p>
                    <p className="font-bold text-[#1A2F4A] text-sm">{v.value} {v.unit}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-4 text-sm">No readings available</p>
            )}
          </section>

          {/* Follow-ups */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-bold text-[#1A2F4A] mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Follow-ups
            </h3>
            {(followUps as { id: string; follow_up_date: string; reason_en?: string | null; reason_ar?: string | null; status: string }[]).length > 0 ? (
              <div className="space-y-2">
                {(followUps as { id: string; follow_up_date: string; reason_en?: string | null; reason_ar?: string | null; status: string }[]).slice(0, 5).map(fu => (
                  <div key={fu.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-[#1A2F4A]">
                        {new Date(fu.follow_up_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      {(fu.reason_en || fu.reason_ar) && (
                        <p className="text-xs text-gray-500">{fu.reason_en ?? fu.reason_ar}</p>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      fu.status === 'completed' ? 'bg-green-100 text-green-700' :
                      fu.status === 'overdue' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {fu.status === 'completed' ? 'Completed' : fu.status === 'overdue' ? 'Overdue' : 'Scheduled'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-4 text-sm">No follow-ups</p>
            )}
          </section>

          <ReferralSection referrals={referrals} lang="en" />
        </div>
      </div>
    </div>
  );
}
