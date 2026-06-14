'use client';

import { useState } from 'react';
import { showToast } from '@/components/ui/Toast';

interface CallbackRow {
  id: string;
  tenant_id: string | null;
  patient_phone: string;
  trigger_reason: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  scheduled_for: string;
  last_attempted_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
}

interface CallbacksPanelProps {
  callbacks: CallbackRow[];
}

// ─── Status Labels & Badges ─────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; labelAr: string; style: string }> = {
  scheduled:      { label: 'Scheduled',      labelAr: 'مجدول',         style: 'bg-amber-100 text-amber-800' },
  attempting:     { label: 'Calling...',      labelAr: 'جارٍ الاتصال',  style: 'bg-blue-100 text-blue-800 animate-pulse' },
  completed:      { label: 'Completed',       labelAr: 'مكتمل',        style: 'bg-green-100 text-green-800' },
  failed:         { label: 'Failed',          labelAr: 'فشل',          style: 'bg-red-100 text-red-800' },
  whatsapp_sent:  { label: 'WhatsApp Sent',   labelAr: 'واتساب أُرسل', style: 'bg-teal-100 text-teal-800' },
  cancelled:      { label: 'Cancelled',       labelAr: 'ملغى',         style: 'bg-gray-100 text-gray-600' },
};

const TRIGGER_LABELS: Record<string, string> = {
  incomplete_session: 'Incomplete session',
  no_audio:           'No audio detected',
  missed_call:        'Missed call',
};

function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return phone.slice(0, 3) + '*'.repeat(phone.length - 6) + phone.slice(-3);
}

export default function CallbacksPanel({ callbacks }: CallbacksPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [localCallbacks, setLocalCallbacks] = useState(callbacks);

  const activeCount = localCallbacks.filter(
    (cb) => cb.status === 'scheduled' || cb.status === 'attempting'
  ).length;

  const handleCancel = async (callbackId: string) => {
    setCancellingId(callbackId);

    try {
      const res = await fetch('/api/admin/callbacks/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callbackId }),
      });

      if (res.ok) {
        setLocalCallbacks((prev) =>
          prev.map((cb) =>
            cb.id === callbackId ? { ...cb, status: 'cancelled' } : cb
          )
        );
        showToast('Callback cancelled', 'success');
      } else {
        showToast('Failed to cancel callback', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setCancellingId(null);
    }
  };

  if (localCallbacks.length === 0) return null;

  return (
    <div className="card mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Callbacks</h2>
          {activeCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              {activeCount} active
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Trigger</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Scheduled</th>
                <th className="text-center py-2 px-3 text-xs font-medium text-gray-500 uppercase">Attempts</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {localCallbacks.map((cb) => {
                const statusInfo = STATUS_LABELS[cb.status] ?? {
                  label: cb.status,
                  labelAr: cb.status,
                  style: 'bg-gray-100 text-gray-600',
                };

                return (
                  <tr key={cb.id} className="border-b border-gray-100">
                    <td className="py-2 px-3 text-gray-900 font-mono text-xs">
                      {maskPhone(cb.patient_phone)}
                    </td>
                    <td className="py-2 px-3 text-gray-600 text-xs">
                      {TRIGGER_LABELS[cb.trigger_reason] ?? cb.trigger_reason}
                    </td>
                    <td className="py-2 px-3 text-gray-600 text-xs">
                      {new Date(cb.scheduled_for).toLocaleString('en-EG', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2 px-3 text-center text-gray-600">
                      {cb.attempt_count}/{cb.max_attempts}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.style}`}
                      >
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      {cb.status === 'scheduled' && (
                        <button
                          onClick={() => handleCancel(cb.id)}
                          disabled={cancellingId === cb.id}
                          className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          {cancellingId === cb.id ? 'Cancelling...' : 'Cancel'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
