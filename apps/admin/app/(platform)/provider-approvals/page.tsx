'use client';

import { useState, useEffect, useCallback } from 'react';
import { showToast } from '@/components/ui/Toast';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface PendingProvider {
  id: string;
  name_en: string;
  name_ar: string;
  slug: string;
  tier: string;
  created_at: string;
  admin_user: { name: string; email: string; role: string } | null;
}

const TIER_LABEL: Record<string, string> = {
  basic: 'Hospital',
  premium: 'Hospital',
  clinic: 'Clinic',
  lab: 'Laboratory',
  radiology: 'Radiology',
  pharmacy: 'Pharmacy',
  insurance: 'Insurance',
};

export default function ProviderApprovalsPage() {
  const [pending, setPending] = useState<PendingProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingProvider | null>(null);
  const [rejecting, setRejecting] = useState(false);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/provider-approvals');
      const data = await res.json().catch(() => null);
      setPending(res.ok && data ? (data.pending ?? []) : []);
    } catch {
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  async function approve(p: PendingProvider) {
    setBusyId(p.id);
    const res = await fetch(`/api/admin/provider-approvals/${p.id}`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast(`${p.name_en} approved and activated.`, 'success');
      fetchPending();
    } else {
      showToast(data.error ?? 'Failed to approve.', 'error');
    }
    setBusyId(null);
  }

  async function reject() {
    if (!rejectTarget) return;
    setRejecting(true);
    const res = await fetch(`/api/admin/provider-approvals/${rejectTarget.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast('Registration rejected and removed.', 'success');
      fetchPending();
    } else {
      showToast(data.error ?? 'Failed to reject.', 'error');
    }
    setRejecting(false);
    setRejectTarget(null);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Provider Approvals</h1>
        <p className="text-sm text-gray-500 mt-1">
          Facilities that self-registered and are waiting to be activated. Approving turns on the
          tenant and its admin login and emails the facility.
        </p>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : pending.length === 0 ? (
        <EmptyState
          icon="✅"
          title="No pending providers"
          description="New facility registrations awaiting approval will show up here."
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="table-header px-6 py-3">Facility</th>
                  <th className="table-header px-6 py-3">Type</th>
                  <th className="table-header px-6 py-3">Contact</th>
                  <th className="table-header px-6 py-3">Requested</th>
                  <th className="table-header px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{p.name_en}</p>
                      <p className="text-xs text-gray-400">{p.slug}</p>
                    </td>
                    <td className="table-cell">
                      <span className="badge badge-gray">{TIER_LABEL[p.tier] ?? p.tier}</span>
                    </td>
                    <td className="table-cell">
                      {p.admin_user ? (
                        <div>
                          <p className="text-sm text-gray-900">{p.admin_user.name}</p>
                          <p className="text-xs text-gray-500" dir="ltr">{p.admin_user.email}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-600">no admin user</span>
                      )}
                    </td>
                    <td className="table-cell text-sm text-gray-500">
                      {new Date(p.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => approve(p)}
                          disabled={busyId === p.id}
                          className="btn-primary text-sm py-1.5 disabled:opacity-50"
                        >
                          {busyId === p.id ? '...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => setRejectTarget(p)}
                          disabled={busyId === p.id}
                          className="text-red-600 hover:text-red-800 text-sm font-medium px-2"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        onConfirm={reject}
        title="Reject registration?"
        message={
          rejectTarget
            ? `This permanently removes "${rejectTarget.name_en}" and its pending admin login. This can't be undone.`
            : ''
        }
        confirmLabel="Reject & remove"
        danger
        loading={rejecting}
      />
    </div>
  );
}
