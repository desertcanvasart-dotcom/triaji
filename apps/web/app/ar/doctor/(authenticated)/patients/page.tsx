'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PatientProtocol {
  protocolId: string;
  enrolledAt: string;
  nameAr: string | null;
  nameEn: string | null;
  conditionCode: string | null;
}

interface PatientCard {
  id: string;
  relationshipId: string;
  assignedAt: string;
  nameAr: string | null;
  nameEn: string | null;
  phone: string;
  dateOfBirth: string | null;
  biologicalSex: string | null;
  profile: {
    age: number | null;
    bmi: number | null;
    bloodPressure: string | null;
    diabetesType: string | null;
    riskLevel: string | null;
    brs: number | null;
  } | null;
  protocols: PatientProtocol[];
  unresolvedAlerts: number;
  overdueFollowUps: number;
  needsAttention: boolean;
}

interface PanelData {
  patients: PatientCard[];
  stats: {
    total: number;
    needsAttention: number;
    overdueFollowUps: number;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function maskPhone(phone: string): string {
  if (phone.length < 7) return phone;
  const first3 = phone.slice(0, 3);
  const last3 = phone.slice(-3);
  return `${first3}****${last3}`;
}

function getRiskBadge(level: string | null): { label: string; className: string } {
  switch (level) {
    case 'high': return { label: 'خطر عالي', className: 'bg-red-100 text-red-700' };
    case 'medium': return { label: 'خطر متوسط', className: 'bg-amber-100 text-amber-700' };
    case 'low': return { label: 'خطر منخفض', className: 'bg-green-100 text-green-700' };
    default: return { label: 'غير محدد', className: 'bg-gray-100 text-gray-600' };
  }
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function PanelSkeleton() {
  return (
    <div className="p-6 md:p-8 animate-pulse space-y-6">
      <div className="h-8 bg-gray-200 rounded w-1/3" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-40 bg-gray-100 rounded-xl" />)}
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function GPPatientPanelPage() {
  const router = useRouter();
  const [data, setData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'attention'>('all');

  useEffect(() => {
    async function fetchPatients() {
      try {
        const res = await fetch('/api/doctor/patients');
        if (res.status === 401) {
          router.replace('/ar/doctor/login');
          return;
        }
        if (!res.ok) {
          setError('حصل مشكلة في تحميل المرضى');
          return;
        }
        const result = await res.json();

        // Guard: no GP relationships → redirect to dashboard
        if (!result.patients || result.patients.length === 0) {
          router.replace('/ar/doctor/dashboard');
          return;
        }

        setData(result);
      } catch {
        setError('حصل مشكلة في تحميل المرضى');
      } finally {
        setLoading(false);
      }
    }

    fetchPatients();
  }, [router]);

  if (loading) return <PanelSkeleton />;

  if (error) {
    return (
      <div className="p-6 md:p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            حاول تاني
          </button>
        </div>
      </div>
    );
  }

  const stats = data?.stats ?? { total: 0, needsAttention: 0, overdueFollowUps: 0 };
  const patients = data?.patients ?? [];
  const filteredPatients = filter === 'attention'
    ? patients.filter(p => p.needsAttention)
    : patients;

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1A2F4A]">المرضى المتابعين</h1>
        <p className="text-gray-500 mt-1">لوحة متابعة مرضى طبيب العائلة</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-[#1A2F4A]">{stats.total}</p>
              <p className="text-sm text-gray-500">مريض نشط</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setFilter(filter === 'attention' ? 'all' : 'attention')}
          className={`bg-white rounded-xl border p-5 text-start transition-colors ${
            filter === 'attention' ? 'border-amber-400 bg-amber-50' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700">{stats.needsAttention}</p>
              <p className="text-sm text-gray-500">يحتاج متابعة</p>
            </div>
          </div>
        </button>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700">{stats.overdueFollowUps}</p>
              <p className="text-sm text-gray-500">متابعة متأخرة</p>
            </div>
          </div>
        </div>
      </div>

      {/* Patient cards */}
      {filteredPatients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-lg">
            {filter === 'attention' ? 'لا يوجد مرضى يحتاجون متابعة عاجلة' : 'لا يوجد مرضى'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPatients.map(patient => {
            const risk = getRiskBadge(patient.profile?.riskLevel ?? null);

            return (
              <Link
                key={patient.id}
                href={`/ar/doctor/patients/${patient.id}`}
                className={`block bg-white rounded-xl border p-5 hover:shadow-md transition-shadow ${
                  patient.needsAttention ? 'border-amber-300 border-r-4 border-r-amber-500' : 'border-gray-200'
                }`}
              >
                {/* Patient header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#1A2F4A] rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">
                        {patient.nameAr ? patient.nameAr.charAt(0) : '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-[#1A2F4A] text-sm">
                        {patient.nameAr ?? maskPhone(patient.phone)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {patient.profile?.age ? `${patient.profile.age} سنة` : ''}
                        {patient.profile?.age && patient.biologicalSex ? ' - ' : ''}
                        {patient.biologicalSex === 'male' ? 'ذكر' : patient.biologicalSex === 'female' ? 'أنثى' : ''}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${risk.className}`}>
                    {risk.label}
                  </span>
                </div>

                {/* Protocols */}
                {patient.protocols.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {patient.protocols.map(p => (
                      <span key={p.protocolId} className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full">
                        {p.nameAr ?? p.conditionCode ?? ''}
                      </span>
                    ))}
                  </div>
                )}

                {/* Alerts row */}
                <div className="flex items-center gap-4 text-xs">
                  {patient.unresolvedAlerts > 0 && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 9v2m0 4h.01" />
                      </svg>
                      {patient.unresolvedAlerts} تنبيه
                    </span>
                  )}
                  {patient.overdueFollowUps > 0 && (
                    <span className="flex items-center gap-1 text-red-600">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 8v4l3 3" />
                      </svg>
                      {patient.overdueFollowUps} متابعة متأخرة
                    </span>
                  )}
                  {patient.profile?.bmi && (
                    <span className="text-gray-400">
                      BMI: {patient.profile.bmi}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
