'use client';

import { useState, useEffect, useCallback } from 'react';
import { showToast } from '@/components/ui/Toast';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';

interface DoctorRegistration {
  id: string;
  name_ar: string;
  name_en: string | null;
  syndicate_number: string;
  specialty_ar: string;
  phone: string;
  email: string;
  clinic_name_ar: string | null;
  verification_status: 'pending' | 'verified' | 'rejected' | 'suspended';
  rejection_reason: string | null;
  self_registered: boolean;
  created_at: string;
  governorates: { name_ar: string; name_en: string } | null;
}

export default function DoctorVerificationPage() {
  const [registrations, setRegistrations] = useState<DoctorRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status: statusFilter });
    const res = await fetch(`/api/admin/doctor-verification?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setRegistrations(data.registrations ?? []);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  async function handleApprove(id: string) {
    const res = await fetch(`/api/admin/doctor-verification/${id}/approve`, {
      method: 'POST',
    });
    if (res.ok) {
      showToast('Doctor verified successfully.', 'success');
      fetchRegistrations();
    } else {
      const data = await res.json();
      showToast(data.error ?? 'Failed to verify doctor.', 'error');
    }
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) {
      showToast('Please provide a rejection reason.', 'error');
      return;
    }

    const res = await fetch(`/api/admin/doctor-verification/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectReason }),
    });
    if (res.ok) {
      showToast('Registration rejected.', 'success');
      setRejectingId(null);
      setRejectReason('');
      fetchRegistrations();
    } else {
      const data = await res.json();
      showToast(data.error ?? 'Failed to reject.', 'error');
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'badge-amber',
      verified: 'badge-green',
      rejected: 'badge-red',
      suspended: 'badge-gray',
    };
    const labelMap: Record<string, string> = {
      pending: 'Pending',
      verified: 'Verified',
      rejected: 'Rejected',
      suspended: 'Suspended',
    };
    return (
      <span className={`badge ${map[status] ?? 'badge-gray'}`}>
        {labelMap[status] ?? status}
      </span>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Doctor Verification</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review and verify doctor registrations ({total} total)
          </p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-6">
        {['pending', 'verified', 'rejected', 'all'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              statusFilter === s
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {s === 'pending' ? 'Pending' :
             s === 'verified' ? 'Verified' :
             s === 'rejected' ? 'Rejected' : 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={7} />
      ) : registrations.length === 0 ? (
        <EmptyState
          icon="✅"
          title="No registrations"
          description={statusFilter === 'pending'
            ? 'No pending doctor registrations to review.'
            : 'No registrations match this filter.'}
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="table-header px-6 py-3">Name</th>
                  <th className="table-header px-6 py-3">Syndicate #</th>
                  <th className="table-header px-6 py-3">Specialty</th>
                  <th className="table-header px-6 py-3">Governorate</th>
                  <th className="table-header px-6 py-3">Phone</th>
                  <th className="table-header px-6 py-3">Registered</th>
                  <th className="table-header px-6 py-3">Status</th>
                  <th className="table-header px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((reg) => (
                  <tr key={reg.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900" dir="rtl">
                          {reg.name_ar}
                        </p>
                        <p className="text-xs text-gray-500">{reg.email}</p>
                      </div>
                    </td>
                    <td className="table-cell font-mono">{reg.syndicate_number}</td>
                    <td className="table-cell" dir="rtl">{reg.specialty_ar}</td>
                    <td className="table-cell">{reg.governorates?.name_en ?? '—'}</td>
                    <td className="table-cell" dir="ltr">{reg.phone}</td>
                    <td className="table-cell text-xs">
                      {new Date(reg.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="table-cell">{statusBadge(reg.verification_status)}</td>
                    <td className="px-6 py-4">
                      {reg.verification_status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(reg.id)}
                            className="text-green-600 hover:text-green-800 text-sm font-medium"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectingId(reg.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {reg.verification_status === 'rejected' && reg.rejection_reason && (
                        <p className="text-xs text-red-600">{reg.rejection_reason}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Reject Registration
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Please provide a reason for rejection. This will be sent to the doctor.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Rejection reason..."
              rows={3}
              className="input-field w-full mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setRejectingId(null);
                  setRejectReason('');
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(rejectingId)}
                className="btn-danger"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
