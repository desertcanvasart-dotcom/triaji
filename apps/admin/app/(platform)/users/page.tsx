'use client';

import { useState, useEffect, useCallback } from 'react';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import LoadError from '@/components/ui/LoadError';
import { getRoleBadge } from '@/lib/auth/types';
import type { AdminRole } from '@/lib/auth/types';

interface AdminUserRow {
  id: string;
  tenant_id: string | null;
  chain_id: string | null;
  branch_tenant_id: string | null;
  role: AdminRole;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  tenant_name: string | null;
  branch_tenant_name: string | null;
  chain_name: string | null;
}

interface TenantOption {
  id: string;
  name_en: string;
  tier: string;
}

interface ChainOption {
  id: string;
  name_en: string;
}

const ROLE_GROUPS: { label: string; roles: AdminRole[] }[] = [
  { label: 'Platform', roles: ['platform_admin'] },
  { label: 'Hospital / ICU', roles: ['tenant_admin', 'tenant_manager', 'icu_coordinator'] },
  { label: 'Clinic', roles: ['clinic_owner', 'clinic_receptionist', 'clinic_billing', 'clinic_doctor'] },
  { label: 'Lab', roles: ['lab_owner', 'lab_receptionist', 'lab_technician', 'lab_billing'] },
  { label: 'Pharmacy', roles: ['pharmacy_owner', 'pharmacy_staff', 'pharmacy_billing'] },
  { label: 'Insurance', roles: ['insurance_admin', 'insurance_reviewer', 'insurance_finance'] },
  { label: 'Chain', roles: ['chain_owner', 'branch_manager'] },
];

function roleNeedsTenant(role: AdminRole): boolean {
  return role !== 'platform_admin' && role !== 'chain_owner' && role !== 'branch_manager';
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showInvite, setShowInvite] = useState(false);

  // Invite form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<AdminRole>('tenant_admin');
  const [tenantId, setTenantId] = useState('');
  const [chainId, setChainId] = useState('');
  const [branchTenantId, setBranchTenantId] = useState('');
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [chains, setChains] = useState<ChainOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [invitedEmail, setInvitedEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowLink, setRowLink] = useState<{ id: string; link: string } | null>(null);
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        setLoadError(data?.error ?? 'Could not load users.');
        setUsers([]);
        return;
      }
      setUsers(data.users ?? []);
    } catch {
      setLoadError('Could not reach the server.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Load tenant/chain options once the invite form is opened.
  useEffect(() => {
    if (!showInvite) return;
    if (tenants.length === 0) {
      fetch('/api/admin/tenants')
        .then((r) => (r.ok ? r.json() : { tenants: [] }))
        .then((d) => setTenants(d.tenants ?? []));
    }
    if (chains.length === 0) {
      fetch('/api/admin/chains')
        .then((r) => (r.ok ? r.json() : { chains: [] }))
        .then((d) => setChains(d.chains ?? []));
    }
  }, [showInvite, tenants.length, chains.length]);

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setInviteLink('');
    setSubmitting(true);

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        phone: phone.trim() || null,
        role,
        tenant_id: roleNeedsTenant(role) ? tenantId || null : null,
        chain_id: role === 'chain_owner' || role === 'branch_manager' ? chainId || null : null,
        branch_tenant_id: role === 'branch_manager' ? branchTenantId || null : null,
      }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setFormError(data.error ?? 'Invite failed.');
      return;
    }

    setInviteLink(data.invite_link ?? '');
    setInvitedEmail(email);
    setName('');
    setEmail('');
    setPhone('');
    setTenantId('');
    setChainId('');
    setBranchTenantId('');
    fetchUsers();
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function resendLink(user: AdminUserRow) {
    setRowBusy(user.id);
    setRowLink(null);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: user.name,
        email: user.email,
        // The invite upsert rewrites the row — carry the mobile through so
        // regenerating a link doesn't wipe it.
        phone: user.phone,
        role: user.role,
        tenant_id: user.tenant_id,
        chain_id: user.chain_id,
        branch_tenant_id: user.branch_tenant_id,
      }),
    });
    const data = await res.json();
    setRowBusy(null);
    if (res.ok && data.invite_link) {
      setRowLink({ id: user.id, link: data.invite_link });
    }
  }

  async function savePhone(user: AdminUserRow) {
    setRowBusy(user.id);
    setPhoneError('');
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, phone: phoneDraft.trim() || null }),
    });
    const data = await res.json();
    setRowBusy(null);
    if (!res.ok) {
      setPhoneError(data.error ?? 'Could not save the mobile.');
      return;
    }
    setEditingPhone(null);
    fetchUsers();
  }

  async function toggleActive(user: AdminUserRow) {
    setRowBusy(user.id);
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, is_active: !user.is_active }),
    });
    setRowBusy(null);
    if (res.ok) fetchUsers();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <button className="btn-primary" onClick={() => setShowInvite(!showInvite)}>
          {showInvite ? 'Close' : 'Invite User'}
        </button>
      </div>

      {showInvite && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Invite a new user</h2>
          <form onSubmit={submitInvite} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              className="input-field"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className="input-field"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className="input-field"
              type="tel"
              inputMode="tel"
              placeholder="Mobile (optional) — 01XXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <select
              className="input-field"
              value={role}
              onChange={(e) => setRole(e.target.value as AdminRole)}
            >
              {ROLE_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.roles.map((r) => (
                    <option key={r} value={r}>
                      {getRoleBadge(r).label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            {roleNeedsTenant(role) && (
              <select
                className="input-field"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                required
              >
                <option value="">Select tenant…</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name_en} ({t.tier})
                  </option>
                ))}
              </select>
            )}

            {(role === 'chain_owner' || role === 'branch_manager') && (
              <select
                className="input-field"
                value={chainId}
                onChange={(e) => setChainId(e.target.value)}
                required
              >
                <option value="">Select chain…</option>
                {chains.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name_en}
                  </option>
                ))}
              </select>
            )}

            {role === 'branch_manager' && (
              <select
                className="input-field"
                value={branchTenantId}
                onChange={(e) => setBranchTenantId(e.target.value)}
                required
              >
                <option value="">Select branch (tenant)…</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name_en} ({t.tier})
                  </option>
                ))}
              </select>
            )}

            <div className="md:col-span-2 flex items-center gap-3">
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create invite'}
              </button>
              {formError && <span className="text-sm text-red-600">{formError}</span>}
            </div>
          </form>

          {inviteLink && (
            <div className="mt-4 p-4 bg-teal-50 border border-teal-200 rounded-lg">
              <p className="text-sm font-medium text-teal-900 mb-2">
                Invite created for {invitedEmail}. Send them this one-time link to set their
                password (it expires — regenerate with &quot;New link&quot; if needed):
              </p>
              <div className="flex items-center gap-2">
                <input className="input-field flex-1 text-xs" readOnly value={inviteLink} />
                <button type="button" className="btn-primary" onClick={() => copyLink(inviteLink)}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={5} />
      ) : loadError ? (
        <LoadError message={loadError} onRetry={fetchUsers} />
      ) : users.length === 0 ? (
        <EmptyState title="No users yet" description="Invite your first admin user." />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Mobile</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Scope</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const badge = getRoleBadge(u.role);
                const scope =
                  u.chain_name ??
                  u.branch_tenant_name ??
                  u.tenant_name ??
                  (u.role === 'platform_admin' ? 'Platform' : '—');
                return (
                  <tr key={u.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {editingPhone === u.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            className="input-field text-xs w-36"
                            type="tel"
                            inputMode="tel"
                            placeholder="01XXXXXXXXX"
                            value={phoneDraft}
                            onChange={(e) => setPhoneDraft(e.target.value)}
                            autoFocus
                          />
                          <button
                            type="button"
                            className="text-teal-700 hover:underline disabled:opacity-50"
                            disabled={rowBusy === u.id}
                            onClick={() => savePhone(u)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="text-gray-400 hover:underline"
                            onClick={() => {
                              setEditingPhone(null);
                              setPhoneError('');
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="hover:underline"
                          title="Password reset codes are sent to this number"
                          onClick={() => {
                            setEditingPhone(u.id);
                            setPhoneDraft(u.phone ?? '');
                            setPhoneError('');
                          }}
                        >
                          {u.phone ?? <span className="text-gray-400">Add mobile</span>}
                        </button>
                      )}
                      {editingPhone === u.id && phoneError && (
                        <p className="text-xs text-red-600 mt-1">{phoneError}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={badge.className}>{badge.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{scope}</td>
                    <td className="px-4 py-3">
                      <span className={u.is_active ? 'badge-green' : 'badge-red'}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          className="text-teal-700 hover:underline disabled:opacity-50"
                          disabled={rowBusy === u.id}
                          onClick={() => resendLink(u)}
                        >
                          New link
                        </button>
                        <button
                          className="text-gray-500 hover:underline disabled:opacity-50"
                          disabled={rowBusy === u.id}
                          onClick={() => toggleActive(u)}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                      {rowLink?.id === u.id && (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            className="input-field flex-1 text-xs"
                            readOnly
                            value={rowLink.link}
                          />
                          <button
                            type="button"
                            className="text-teal-700 hover:underline"
                            onClick={() => copyLink(rowLink.link)}
                          >
                            {copied ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
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
