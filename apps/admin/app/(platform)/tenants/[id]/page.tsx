'use client';

import { useState, useEffect, use } from 'react';
import { FormSkeleton } from '@/components/ui/LoadingSkeleton';
import { showToast } from '@/components/ui/Toast';

interface TenantDetail {
  tenant: {
    id: string;
    name_ar: string;
    name_en: string;
    slug: string;
    tier: string;
    is_active: boolean;
    created_at: string;
  };
  config: {
    logo_url: string | null;
    primary_color: string | null;
    welcome_message_ar: string | null;
    widget_domains: string[] | null;
    booking_mode: string | null;
    whatsapp_number: string | null;
  } | null;
  doctors: Array<{
    id: string;
    name_ar: string;
    name_en: string | null;
    is_active: boolean;
    specialties: { name_en: string };
  }>;
  booking_count: number;
  admins: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
  }>;
}

type TabKey = 'overview' | 'doctors' | 'config' | 'admins';

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [saving, setSaving] = useState(false);

  // Config form state
  const [configForm, setConfigForm] = useState({
    logo_url: '',
    primary_color: '#0D7A7A',
    welcome_message_ar: '',
    widget_domains: '',
    booking_mode: 'native',
    whatsapp_number: '',
  });

  useEffect(() => {
    fetch(`/api/admin/tenants/${id}`).then(async (res) => {
      if (res.ok) {
        const d = await res.json();
        setData(d);
        if (d.config) {
          setConfigForm({
            logo_url: d.config.logo_url ?? '',
            primary_color: d.config.primary_color ?? '#0D7A7A',
            welcome_message_ar: d.config.welcome_message_ar ?? '',
            widget_domains: (d.config.widget_domains ?? []).join(', '),
            booking_mode: d.config.booking_mode ?? 'native',
            whatsapp_number: d.config.whatsapp_number ?? '',
          });
        }
      }
      setLoading(false);
    });
  }, [id]);

  async function handleSaveConfig() {
    setSaving(true);
    const res = await fetch(`/api/admin/tenants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          ...configForm,
          widget_domains: configForm.widget_domains.split(',').map((d) => d.trim()).filter(Boolean),
        },
      }),
    });
    if (res.ok) {
      showToast('Config saved.', 'success');
    } else {
      showToast('Failed to save config.', 'error');
    }
    setSaving(false);
  }

  if (loading) return <div className="max-w-4xl"><h1 className="text-2xl font-bold text-gray-900 mb-6">Tenant Details</h1><div className="card"><FormSkeleton /></div></div>;
  if (!data) return <p className="text-gray-500">Tenant not found.</p>;

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'doctors', label: `Doctors (${data.doctors.length})` },
    { key: 'config', label: 'Config' },
    { key: 'admins', label: `Admin Users (${data.admins.length})` },
  ];

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{data.tenant.name_en}</h1>
      <p className="text-sm text-gray-500 mb-6" dir="rtl">{data.tenant.name_ar}</p>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-teal-500 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="card">
            <p className="text-sm text-gray-500">Slug</p>
            <p className="text-lg font-mono">{data.tenant.slug}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Tier</p>
            <p className="text-lg font-medium capitalize">{data.tenant.tier}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Status</p>
            <span className={`badge ${data.tenant.is_active ? 'badge-green' : 'badge-gray'}`}>
              {data.tenant.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Total Bookings</p>
            <p className="text-lg font-bold">{data.booking_count}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Doctors</p>
            <p className="text-lg font-bold">{data.doctors.length}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Created</p>
            <p className="text-sm">{new Date(data.tenant.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}</p>
          </div>
        </div>
      )}

      {/* Doctors Tab */}
      {activeTab === 'doctors' && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header px-6 py-3">Name</th>
                <th className="table-header px-6 py-3">Specialty</th>
                <th className="table-header px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.doctors.map((d) => (
                <tr key={d.id} className="border-b border-gray-100">
                  <td className="px-6 py-3 text-sm" dir="rtl">{d.name_ar}</td>
                  <td className="px-6 py-3 text-sm">{d.specialties?.name_en}</td>
                  <td className="px-6 py-3">
                    <span className={`badge ${d.is_active ? 'badge-green' : 'badge-gray'}`}>
                      {d.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Config Tab */}
      {activeTab === 'config' && (
        <div className="card space-y-5">
          <div>
            <label className="label">Logo URL</label>
            <input type="text" value={configForm.logo_url} onChange={(e) => setConfigForm((p) => ({ ...p, logo_url: e.target.value }))} className="input-field" />
            {configForm.logo_url && <img src={configForm.logo_url} alt="Logo preview" className="mt-2 h-12 object-contain" />}
          </div>
          <div>
            <label className="label">Primary Color</label>
            <div className="flex gap-3 items-center">
              <input type="color" value={configForm.primary_color} onChange={(e) => setConfigForm((p) => ({ ...p, primary_color: e.target.value }))} className="h-10 w-12 cursor-pointer" />
              <input type="text" value={configForm.primary_color} onChange={(e) => setConfigForm((p) => ({ ...p, primary_color: e.target.value }))} className="input-field w-32 font-mono" />
            </div>
          </div>
          <div>
            <label className="label">Welcome Message (Arabic)</label>
            <textarea dir="rtl" value={configForm.welcome_message_ar} onChange={(e) => setConfigForm((p) => ({ ...p, welcome_message_ar: e.target.value }))} className="input-field h-24 resize-none" />
          </div>
          <div>
            <label className="label">Allowed Widget Domains</label>
            <input type="text" value={configForm.widget_domains} onChange={(e) => setConfigForm((p) => ({ ...p, widget_domains: e.target.value }))} className="input-field" placeholder="hospital.com, clinic.com" />
          </div>
          <div>
            <label className="label">Booking Mode</label>
            <select value={configForm.booking_mode} onChange={(e) => setConfigForm((p) => ({ ...p, booking_mode: e.target.value }))} className="input-field w-48">
              <option value="native">Native</option>
              <option value="his_integration" disabled>HIS Integration (Premium)</option>
              <option value="hybrid" disabled>Hybrid (Premium)</option>
            </select>
          </div>
          <div>
            <label className="label">WhatsApp Number</label>
            <input type="text" value={configForm.whatsapp_number} onChange={(e) => setConfigForm((p) => ({ ...p, whatsapp_number: e.target.value }))} className="input-field" placeholder="201012345678" />
          </div>
          <button onClick={handleSaveConfig} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Config'}
          </button>
        </div>
      )}

      {/* Admins Tab */}
      {activeTab === 'admins' && (
        <div className="card p-0 overflow-hidden">
          {data.admins.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">No admin users for this tenant.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="table-header px-6 py-3">Name</th>
                  <th className="table-header px-6 py-3">Email</th>
                  <th className="table-header px-6 py-3">Role</th>
                  <th className="table-header px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.admins.map((a) => (
                  <tr key={a.id} className="border-b border-gray-100">
                    <td className="px-6 py-3 text-sm font-medium">{a.name}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{a.email}</td>
                    <td className="px-6 py-3 text-sm">{a.role.replace(/_/g, ' ')}</td>
                    <td className="px-6 py-3">
                      <span className={`badge ${a.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {a.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
