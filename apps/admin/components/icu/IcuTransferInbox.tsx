'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

interface TransferRequest {
  id: string;
  status: 'requested' | 'acknowledged' | 'accepted' | 'declined' | 'en_route' | 'completed' | 'cancelled';
  requesting_doctor_name: string;
  requesting_doctor_specialty: string | null;
  requesting_doctor_phone: string | null;
  patient_name: string;
  patient_age: number | null;
  patient_sex: string | null;
  diagnosis_ar: string | null;
  diagnosis_en: string | null;
  clinical_summary_ar: string | null;
  clinical_summary_en: string | null;
  urgency: 'routine' | 'urgent' | 'emergent';
  eta_minutes: number | null;
  icu_unit_id: string | null;
  receiving_tenant_id: string;
  bed_assigned_ar: string | null;
  receiving_contact_phone: string | null;
  decline_reason_ar: string | null;
  created_at: string;
  updated_at: string;
  icu_unit: {
    id: string;
    unit_name_ar: string;
    unit_name_en: string | null;
    unit_type: string;
    available_beds: number;
    total_beds: number;
  } | null;
}

type StatusTab = 'all' | 'requested' | 'accepted' | 'en_route';

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'requested', label: 'Requested' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'en_route', label: 'En Route' },
];

interface ActionState {
  transferId: string;
  action: 'accept' | 'decline';
}

export default function IcuTransferInbox({ tenantId }: { tenantId: string }) {
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Accept form
  const [bedAssignment, setBedAssignment] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Decline form
  const [declineReason, setDeclineReason] = useState('');

  const fetchTransfers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/icu/transfers');
      if (!res.ok) throw new Error('Failed to fetch transfers');
      const data = await res.json();
      setTransfers(data.transfers as TransferRequest[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transfers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransfers();

    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel(`icu_transfers:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'icu_transfer_requests',
          filter: `receiving_tenant_id=eq.${tenantId}`,
        },
        () => {
          fetchTransfers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, fetchTransfers]);

  const filteredTransfers = transfers.filter((t) => {
    if (activeTab === 'all') return true;
    return t.status === activeTab;
  });

  async function handleAcknowledge(transferId: string) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/icu/transfers/${transferId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'acknowledge' }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to acknowledge');
      }
      fetchTransfers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAccept(transferId: string) {
    if (!bedAssignment || !contactPhone) {
      setError('Bed assignment and contact phone are required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/icu/transfers/${transferId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept',
          bed_assigned_ar: bedAssignment,
          receiving_contact_phone: contactPhone,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to accept');
      }
      setActionState(null);
      setBedAssignment('');
      setContactPhone('');
      fetchTransfers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecline(transferId: string) {
    if (!declineReason) {
      setError('Decline reason is required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/icu/transfers/${transferId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'decline',
          decline_reason_ar: declineReason,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to decline');
      }
      setActionState(null);
      setDeclineReason('');
      fetchTransfers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setSubmitting(false);
    }
  }

  function getTimeSince(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function getStatusBadge(status: TransferRequest['status']) {
    switch (status) {
      case 'requested':
        return (
          <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded-full">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            Requested
          </span>
        );
      case 'acknowledged':
        return (
          <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-1 rounded-full">
            Acknowledged
          </span>
        );
      case 'accepted':
        return (
          <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
            Accepted
          </span>
        );
      case 'en_route':
        return (
          <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded-full">
            En Route
          </span>
        );
      case 'declined':
        return (
          <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-1 rounded-full">
            Declined
          </span>
        );
      case 'completed':
        return (
          <span className="bg-teal-100 text-teal-700 text-xs font-semibold px-2 py-1 rounded-full">
            Completed
          </span>
        );
      case 'cancelled':
        return (
          <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-1 rounded-full">
            Cancelled
          </span>
        );
      default:
        return null;
    }
  }

  function getUrgencyBadge(urgency: TransferRequest['urgency']) {
    switch (urgency) {
      case 'emergent':
        return <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">EMERGENT</span>;
      case 'urgent':
        return <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded">URGENT</span>;
      case 'routine':
        return <span className="bg-gray-200 text-gray-700 text-xs font-medium px-2 py-0.5 rounded">Routine</span>;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-gray-500">Loading transfer requests...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transfer Requests</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage incoming ICU transfer requests.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {STATUS_TABS.map(({ key, label }) => {
          const count = key === 'all'
            ? transfers.length
            : transfers.filter((t) => t.status === key).length;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {filteredTransfers.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          No transfer requests found.
        </div>
      )}

      {/* Transfer cards */}
      <div className="space-y-4">
        {filteredTransfers.map((transfer) => {
          const isActionTarget = actionState?.transferId === transfer.id;

          return (
            <div
              key={transfer.id}
              className="bg-white rounded-xl border border-gray-200 p-5"
            >
              {/* Top row: status, time, urgency */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getStatusBadge(transfer.status)}
                  {getUrgencyBadge(transfer.urgency)}
                  {transfer.eta_minutes && (
                    <span className="text-xs text-gray-500">
                      ETA: {transfer.eta_minutes} min
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {getTimeSince(transfer.created_at)}
                </span>
              </div>

              {/* Doctor info */}
              <div className="mb-2">
                <p className="text-sm text-gray-500">
                  Requesting doctor:{' '}
                  <span className="font-medium text-gray-900">
                    {transfer.requesting_doctor_name}
                  </span>
                  {transfer.requesting_doctor_specialty && (
                    <span className="text-gray-400">
                      {' '}
                      ({transfer.requesting_doctor_specialty})
                    </span>
                  )}
                </p>
              </div>

              {/* Patient info */}
              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <p className="font-medium text-gray-900 text-sm">
                  {transfer.patient_name}
                  {transfer.patient_age && `, ${transfer.patient_age}y`}
                  {transfer.patient_sex && `, ${transfer.patient_sex}`}
                </p>
                {(transfer.diagnosis_en || transfer.diagnosis_ar) && (
                  <p className="text-sm text-gray-700 mt-1">
                    Diagnosis: {transfer.diagnosis_en || transfer.diagnosis_ar}
                  </p>
                )}
                {(transfer.clinical_summary_en || transfer.clinical_summary_ar) && (
                  <p className="text-sm text-gray-600 mt-1">
                    {transfer.clinical_summary_en || transfer.clinical_summary_ar}
                  </p>
                )}
              </div>

              {/* Target unit */}
              {transfer.icu_unit && (
                <p className="text-xs text-gray-500 mb-3">
                  Target unit:{' '}
                  <span className="font-medium">
                    {transfer.icu_unit.unit_name_en || transfer.icu_unit.unit_name_ar}
                  </span>
                  {' '}({transfer.icu_unit.available_beds}/{transfer.icu_unit.total_beds} beds available)
                </p>
              )}

              {/* Accepted info */}
              {transfer.status === 'accepted' && transfer.bed_assigned_ar && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 text-sm">
                  <p className="text-green-800">
                    Bed assigned: <span className="font-semibold">{transfer.bed_assigned_ar}</span>
                  </p>
                  {transfer.receiving_contact_phone && (
                    <p className="text-green-700">Contact: {transfer.receiving_contact_phone}</p>
                  )}
                </div>
              )}

              {/* Declined info */}
              {transfer.status === 'declined' && transfer.decline_reason_ar && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3 text-sm">
                  <p className="text-gray-700">
                    Decline reason: {transfer.decline_reason_ar}
                  </p>
                </div>
              )}

              {/* Actions for requested/acknowledged status */}
              {(transfer.status === 'requested' || transfer.status === 'acknowledged') && !isActionTarget && (
                <div className="flex gap-2 mt-3">
                  {transfer.status === 'requested' && (
                    <button
                      onClick={() => handleAcknowledge(transfer.id)}
                      disabled={submitting}
                      className="text-sm px-4 py-2 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg font-medium hover:bg-yellow-100 disabled:opacity-50"
                    >
                      Acknowledge
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setActionState({ transferId: transfer.id, action: 'accept' });
                      setBedAssignment('');
                      setContactPhone('');
                    }}
                    className="text-sm px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg font-medium hover:bg-green-100"
                  >
                    Accept &mdash; Assign Bed
                  </button>
                  <button
                    onClick={() => {
                      setActionState({ transferId: transfer.id, action: 'decline' });
                      setDeclineReason('');
                    }}
                    className="text-sm px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg font-medium hover:bg-red-100"
                  >
                    Decline
                  </button>
                </div>
              )}

              {/* Accept form */}
              {isActionTarget && actionState.action === 'accept' && (
                <div className="mt-3 border border-green-200 rounded-lg p-4 bg-green-50">
                  <h4 className="text-sm font-semibold text-green-800 mb-3">Accept Transfer</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="label">Bed Assignment</label>
                      <input
                        type="text"
                        value={bedAssignment}
                        onChange={(e) => setBedAssignment(e.target.value)}
                        placeholder="e.g. Bed 7 - North wing"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Contact Phone for Arrival</label>
                      <input
                        type="text"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="e.g. +966-1-XXX-XXXX"
                        className="input-field"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setActionState(null)}
                        className="btn-secondary text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleAccept(transfer.id)}
                        disabled={submitting || !bedAssignment || !contactPhone}
                        className="btn-primary text-sm disabled:opacity-50"
                      >
                        {submitting ? 'Accepting...' : 'Confirm Acceptance'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Decline form */}
              {isActionTarget && actionState.action === 'decline' && (
                <div className="mt-3 border border-red-200 rounded-lg p-4 bg-red-50">
                  <h4 className="text-sm font-semibold text-red-800 mb-3">Decline Transfer</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="label">Decline Reason</label>
                      <textarea
                        value={declineReason}
                        onChange={(e) => setDeclineReason(e.target.value)}
                        placeholder="Enter reason for declining this transfer request..."
                        rows={3}
                        className="input-field"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setActionState(null)}
                        className="btn-secondary text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDecline(transfer.id)}
                        disabled={submitting || !declineReason}
                        className="btn-primary text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50"
                      >
                        {submitting ? 'Declining...' : 'Confirm Decline'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
