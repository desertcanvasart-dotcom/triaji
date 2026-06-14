'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { showToast } from '@/components/ui/Toast';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';

type HisVendor = 'shifa' | 'neuron' | 'generic_rest' | 'mock';
type AuthType = 'api_key' | 'oauth2' | 'basic';
type SetupStep = 'vendor' | 'credentials' | 'test' | 'mapping' | 'sync' | 'status';

interface HisIntegration {
  id: string;
  vendor: string;
  base_url: string;
  auth_type: string;
  sync_enabled: boolean;
  last_sync_at: string | null;
  booking_mode: string;
  is_active: boolean;
}

interface HisDoctor {
  hisDoctorId: string;
  nameAr: string;
  nameEn?: string;
  specialtyCode: string;
}

interface TriajjiDoctor {
  id: string;
  name_ar: string;
  name_en: string | null;
  his_doctor_id: string | null;
  specialty_id: string;
}

interface SyncLog {
  id: string;
  sync_started_at: string;
  sync_ended_at: string | null;
  status: string;
  doctors_synced: number;
  slots_added: number;
  slots_removed: number;
  errors: Array<{ hisDoctorId: string; message: string; code: string }>;
  triggered_by: string;
}

interface DoctorMapping {
  doctorId: string;
  hisDoctorId: string | null;
}

const VENDOR_INFO: Record<HisVendor, { name: string; nameAr: string; desc: string; available: boolean; defaultAuth?: AuthType }> = {
  shifa: {
    name: 'Shifa System',
    nameAr: 'نظام شفاء',
    desc: 'Most common HIS in Egyptian private hospitals',
    available: true,
  },
  neuron: {
    name: 'Neuron HIS',
    nameAr: 'نظام نيورون',
    desc: 'Second most common HIS in Egyptian private hospitals',
    available: true,
    defaultAuth: 'oauth2',
  },
  generic_rest: {
    name: 'Generic REST API',
    nameAr: 'واجهة برمجة عامة',
    desc: 'For hospitals with custom HIS APIs',
    available: true,
  },
  mock: {
    name: 'Mock HIS (Dev)',
    nameAr: 'نظام تجريبي',
    desc: 'For development and testing',
    available: true,
  },
};

const STATUS_BADGE: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  partial: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
  running: 'bg-blue-100 text-blue-800',
};

export default function HISPage() {
  const [loading, setLoading] = useState(true);
  const [tenantTier, setTenantTier] = useState<string>('');
  const [integration, setIntegration] = useState<HisIntegration | null>(null);
  const [step, setStep] = useState<SetupStep>('vendor');

  // Form state
  const [vendor, setVendor] = useState<HisVendor>('shifa');
  const [baseUrl, setBaseUrl] = useState('');
  const [authType, setAuthType] = useState<AuthType>('api_key');
  const [apiKey, setApiKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [tokenUrl, setTokenUrl] = useState('');
  const [fieldMapping, setFieldMapping] = useState('');
  const [bookingMode, setBookingMode] = useState('hybrid');

  // Test connection
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; version?: string } | null>(null);

  // Doctor mapping
  const [hisDoctors, setHisDoctors] = useState<HisDoctor[]>([]);
  const [triajiDoctors, setTriajjiDoctors] = useState<TriajjiDoctor[]>([]);
  const [mappings, setMappings] = useState<Map<string, string | null>>(new Map());
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [savingMappings, setSavingMappings] = useState(false);

  // Sync
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    status: string;
    doctorsSynced: number;
    slotsAdded: number;
    slotsRemoved: number;
  } | null>(null);

  // Sync logs
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Saving / disconnecting
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!adminUser?.tenant_id) {
        setLoading(false);
        return;
      }

      // Get tenant tier
      const { data: tenant } = await supabase
        .from('tenants')
        .select('tier')
        .eq('id', adminUser.tenant_id)
        .single();

      setTenantTier((tenant?.tier as string) ?? 'basic');

      // Check for existing integration
      const { data: existing } = await supabase
        .from('his_integrations')
        .select('*')
        .eq('tenant_id', adminUser.tenant_id)
        .eq('is_active', true)
        .single();

      if (existing) {
        setIntegration(existing as unknown as HisIntegration);
        setVendor(existing.vendor as HisVendor);
        setBaseUrl(existing.base_url as string);
        setAuthType(existing.auth_type as AuthType);
        setBookingMode((existing.booking_mode as string) ?? 'hybrid');
        setStep('status');
      }

      setLoading(false);
    }
    load();
  }, []);

  // Build credentials object from form state
  const buildCredentials = useCallback((): Record<string, unknown> => {
    const creds: Record<string, unknown> = {};
    if (authType === 'api_key') creds['apiKey'] = apiKey;
    if (authType === 'basic') {
      creds['username'] = username;
      creds['password'] = password;
    }
    if (authType === 'oauth2') {
      creds['clientId'] = clientId;
      creds['clientSecret'] = clientSecret;
      creds['tokenUrl'] = tokenUrl;
    }
    if (vendor === 'generic_rest' && fieldMapping) {
      try {
        creds['field_mapping'] = JSON.parse(fieldMapping);
      } catch {
        // Invalid JSON — will be caught during test
      }
    }
    return creds;
  }, [authType, apiKey, username, password, clientId, clientSecret, tokenUrl, vendor, fieldMapping]);

  // Test connection
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/admin/his/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor,
          base_url: baseUrl,
          auth_type: authType,
          credentials: buildCredentials(),
        }),
      });

      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.message,
        version: data.version,
      });
    } catch {
      setTestResult({ success: false, message: 'Network error — could not reach server' });
    } finally {
      setTesting(false);
    }
  };

  // Save connection
  const handleSaveConnection = async () => {
    if (!testResult?.success) {
      showToast('Please test the connection first', 'error');
      return;
    }

    setSaving(true);

    try {
      const res = await fetch('/api/admin/his/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor,
          base_url: baseUrl,
          auth_type: authType,
          credentials: buildCredentials(),
          booking_mode: bookingMode,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast('HIS connected successfully', 'success');
        setIntegration({
          id: data.integrationId,
          vendor,
          base_url: baseUrl,
          auth_type: authType,
          sync_enabled: true,
          last_sync_at: null,
          booking_mode: bookingMode,
          is_active: true,
        });
        setStep('mapping');
      } else {
        showToast(data.error ?? 'Failed to save', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Fetch HIS doctors for mapping
  const handleFetchDoctors = async () => {
    setLoadingDoctors(true);

    try {
      const res = await fetch('/api/admin/his/doctors');
      const data = await res.json();

      if (res.ok) {
        setHisDoctors(data.hisDoctors ?? []);
        setTriajjiDoctors(data.triajiDoctors ?? []);

        // Initialize mappings with existing his_doctor_id values
        const initialMappings = new Map<string, string | null>();
        for (const td of (data.triajiDoctors ?? []) as TriajjiDoctor[]) {
          initialMappings.set(td.id, td.his_doctor_id);
        }

        // Auto-match by name similarity
        for (const td of (data.triajiDoctors ?? []) as TriajjiDoctor[]) {
          if (!initialMappings.get(td.id)) {
            const match = (data.hisDoctors as HisDoctor[]).find(
              (hd) => hd.nameAr === td.name_ar || similarNames(hd.nameAr, td.name_ar)
            );
            if (match) {
              initialMappings.set(td.id, match.hisDoctorId);
            }
          }
        }

        setMappings(initialMappings);
      } else {
        showToast(data.error ?? 'Failed to fetch doctors', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setLoadingDoctors(false);
    }
  };

  // Simple name similarity check
  function similarNames(a: string, b: string): boolean {
    const normalize = (s: string) => s.replace(/[^\u0600-\u06FF\s]/g, '').trim();
    const na = normalize(a);
    const nb = normalize(b);
    if (na === nb) return true;
    // Check if one contains the other
    if (na.includes(nb) || nb.includes(na)) return true;
    // Check word overlap
    const wordsA = new Set(na.split(/\s+/));
    const wordsB = new Set(nb.split(/\s+/));
    let overlap = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) overlap++;
    }
    return overlap >= 2;
  }

  // Save doctor mappings
  const handleSaveMappings = async () => {
    setSavingMappings(true);

    const mappingList: DoctorMapping[] = [];
    mappings.forEach((hisDoctorId, doctorId) => {
      mappingList.push({ doctorId, hisDoctorId });
    });

    try {
      const res = await fetch('/api/admin/his/map-doctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: mappingList }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`${data.updated} doctor(s) mapped`, 'success');
        setStep('sync');
      } else {
        showToast(data.error ?? 'Failed to save', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setSavingMappings(false);
    }
  };

  // Trigger manual sync
  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);

    try {
      const res = await fetch('/api/admin/his/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (res.ok) {
        setSyncResult({
          status: data.status,
          doctorsSynced: data.doctorsSynced,
          slotsAdded: data.slotsAdded,
          slotsRemoved: data.slotsRemoved,
        });
        showToast('Sync completed', data.status === 'success' ? 'success' : 'info');
      } else {
        showToast(data.error ?? 'Sync failed', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Fetch sync logs
  const fetchSyncLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch('/api/admin/his/sync-logs?limit=10');
      const data = await res.json();
      if (res.ok) {
        setSyncLogs(data.logs ?? []);
      }
    } catch {
      // Silent fail for logs
    } finally {
      setLogsLoading(false);
    }
  }, []);

  // Disconnect HIS
  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect the HIS integration? Doctor mappings will be preserved.')) {
      return;
    }

    setDisconnecting(true);
    try {
      const res = await fetch('/api/admin/his/disconnect', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        showToast('HIS disconnected', 'success');
        setIntegration(null);
        setStep('vendor');
        setTestResult(null);
      } else {
        showToast(data.error ?? 'Failed to disconnect', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setDisconnecting(false);
    }
  };

  // Load doctors when entering mapping step
  useEffect(() => {
    if (step === 'mapping') {
      handleFetchDoctors();
    }
    if (step === 'status') {
      fetchSyncLogs();
    }
  }, [step, fetchSyncLogs]);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">HIS Integration</h1>
        <TableSkeleton rows={4} />
      </div>
    );
  }

  // Premium-only gate
  if (tenantTier !== 'premium' && tenantTier !== 'enterprise') {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">HIS Integration</h1>
        <div className="card">
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Premium Feature</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              HIS integration is available on the Premium and Enterprise plans.
              Upgrade your plan to connect your hospital&apos;s information system
              and sync doctor availability automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Connected — show status dashboard
  if (integration && step === 'status') {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">HIS Integration</h1>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Connected
            </span>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="btn-outline text-sm text-red-600 border-red-200 hover:bg-red-50"
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        </div>

        {/* Connection info */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Connection Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Vendor</p>
              <p className="text-sm font-medium text-gray-900 mt-1">
                {VENDOR_INFO[integration.vendor as HisVendor]?.name ?? integration.vendor}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Base URL</p>
              <p className="text-sm font-medium text-gray-900 mt-1 truncate">{integration.base_url}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Booking Mode</p>
              <p className="text-sm font-medium text-gray-900 mt-1 capitalize">{integration.booking_mode}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Last Sync</p>
              <p className="text-sm font-medium text-gray-900 mt-1">
                {integration.last_sync_at
                  ? new Date(integration.last_sync_at).toLocaleString('en-EG')
                  : 'Never'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <button
            onClick={() => setStep('mapping')}
            className="card hover:border-teal-300 transition-colors text-left"
          >
            <h3 className="text-sm font-semibold text-gray-900">Doctor Mapping</h3>
            <p className="text-xs text-gray-500 mt-1">Map Triajji doctors to HIS doctors</p>
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="card hover:border-teal-300 transition-colors text-left"
          >
            <h3 className="text-sm font-semibold text-gray-900">
              {syncing ? 'Syncing...' : 'Sync Now'}
            </h3>
            <p className="text-xs text-gray-500 mt-1">Pull latest availability from HIS</p>
          </button>
          <button
            onClick={() => { setStep('credentials'); setTestResult(null); }}
            className="card hover:border-teal-300 transition-colors text-left"
          >
            <h3 className="text-sm font-semibold text-gray-900">Update Credentials</h3>
            <p className="text-xs text-gray-500 mt-1">Change connection settings</p>
          </button>
        </div>

        {/* Sync result */}
        {syncResult && (
          <div className={`card mb-6 border-l-4 ${syncResult.status === 'success' ? 'border-l-green-500' : syncResult.status === 'partial' ? 'border-l-amber-500' : 'border-l-red-500'}`}>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Last Manual Sync</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Doctors synced:</span>{' '}
                <span className="font-medium">{syncResult.doctorsSynced}</span>
              </div>
              <div>
                <span className="text-gray-500">Slots added:</span>{' '}
                <span className="font-medium">{syncResult.slotsAdded}</span>
              </div>
              <div>
                <span className="text-gray-500">Slots removed:</span>{' '}
                <span className="font-medium">{syncResult.slotsRemoved}</span>
              </div>
            </div>
          </div>
        )}

        {/* Sync logs */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Sync History</h2>
            <button onClick={fetchSyncLogs} className="text-sm text-teal-600 hover:text-teal-700">
              Refresh
            </button>
          </div>

          {logsLoading ? (
            <TableSkeleton rows={5} />
          ) : syncLogs.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">No sync history yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Triggered By</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Doctors</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Slots +</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Slots -</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100">
                      <td className="py-2 px-3 text-gray-900">
                        {new Date(log.sync_started_at).toLocaleString('en-EG', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[log.status] ?? 'bg-gray-100 text-gray-800'}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-gray-600 capitalize">{log.triggered_by}</td>
                      <td className="py-2 px-3 text-right text-gray-900">{log.doctors_synced}</td>
                      <td className="py-2 px-3 text-right text-green-600">+{log.slots_added}</td>
                      <td className="py-2 px-3 text-right text-red-600">-{log.slots_removed}</td>
                      <td className="py-2 px-3 text-right text-gray-600">{log.errors?.length ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Setup flow
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">HIS Integration</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {(['vendor', 'credentials', 'test', 'mapping', 'sync'] as SetupStep[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                step === s
                  ? 'bg-teal-600 text-white'
                  : getStepIndex(step) > i
                  ? 'bg-teal-100 text-teal-700'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {i + 1}
            </div>
            {i < 4 && (
              <div className={`w-8 h-0.5 ${getStepIndex(step) > i ? 'bg-teal-400' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Select vendor */}
      {step === 'vendor' && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select HIS Vendor</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(Object.entries(VENDOR_INFO) as [HisVendor, typeof VENDOR_INFO[HisVendor]][]).map(
              ([key, info]) => (
                <button
                  key={key}
                  onClick={() => {
                    setVendor(key);
                    if (info.defaultAuth) setAuthType(info.defaultAuth);
                    setStep('credentials');
                  }}
                  disabled={!info.available}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    !info.available
                      ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                      : vendor === key
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-gray-200 hover:border-teal-300'
                  }`}
                >
                  <h3 className="font-semibold text-gray-900">{info.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{info.desc}</p>
                  {!info.available && (
                    <span className="mt-2 inline-block text-xs text-gray-400">Coming soon</span>
                  )}
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Step 2: Enter credentials */}
      {step === 'credentials' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Connection Settings — {VENDOR_INFO[vendor]?.name}
            </h2>
            <button onClick={() => setStep('vendor')} className="text-sm text-gray-500 hover:text-gray-700">
              ← Back
            </button>
          </div>

          <div className="space-y-4 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://his.hospital.com"
                className="input w-full"
              />
              <p className="text-xs text-gray-400 mt-1">Must be HTTPS</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Authentication Type</label>
              <select
                value={authType}
                onChange={(e) => setAuthType(e.target.value as AuthType)}
                className="input w-full"
              >
                <option value="api_key">API Key</option>
                <option value="basic">Basic Auth</option>
                <option value="oauth2">OAuth 2.0</option>
              </select>
            </div>

            {authType === 'api_key' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="input w-full"
                  autoComplete="off"
                />
              </div>
            )}

            {authType === 'basic' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="input w-full"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input w-full"
                    autoComplete="off"
                  />
                </div>
              </>
            )}

            {authType === 'oauth2' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
                  <input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    className="input w-full"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Token URL</label>
                  <input
                    type="url"
                    value={tokenUrl}
                    onChange={(e) => setTokenUrl(e.target.value)}
                    placeholder="https://his.hospital.com/oauth/token"
                    className="input w-full"
                  />
                </div>
              </>
            )}

            {vendor === 'generic_rest' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Field Mapping (JSON)</label>
                <textarea
                  value={fieldMapping}
                  onChange={(e) => setFieldMapping(e.target.value)}
                  rows={8}
                  className="input w-full font-mono text-xs"
                  placeholder={`{
  "doctor_id": "staff_id",
  "doctor_name": "full_name_ar",
  "slot_id": "appointment_id",
  "slot_time": "start_datetime",
  "is_available": "status",
  "available_value": "OPEN"
}`}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Booking Mode</label>
              <select
                value={bookingMode}
                onChange={(e) => setBookingMode(e.target.value)}
                className="input w-full"
              >
                <option value="hybrid">Hybrid (HIS first, native fallback)</option>
                <option value="his_integration">HIS Only</option>
                <option value="native">Native Only (disable HIS booking)</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Hybrid mode ensures patients can always book even if HIS is unavailable.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setStep('test')}
                disabled={!baseUrl}
                className="btn-primary"
              >
                Continue to Test Connection →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Test connection */}
      {step === 'test' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Test Connection</h2>
            <button onClick={() => setStep('credentials')} className="text-sm text-gray-500 hover:text-gray-700">
              ← Back
            </button>
          </div>

          <div className="space-y-4 max-w-lg">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Vendor:</strong> {VENDOR_INFO[vendor]?.name}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>URL:</strong> {baseUrl}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>Auth:</strong> {authType.replace('_', ' ').toUpperCase()}
              </p>
            </div>

            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="btn-primary"
            >
              {testing ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Testing...
                </span>
              ) : (
                'Test Connection'
              )}
            </button>

            {testResult && (
              <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-start gap-2">
                  <span className="text-lg">{testResult.success ? '✅' : '❌'}</span>
                  <div>
                    <p className={`text-sm font-medium ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                      {testResult.success ? 'Connection successful' : 'Connection failed'}
                    </p>
                    <p className={`text-xs mt-1 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                      {testResult.message}
                      {testResult.version && ` — v${testResult.version}`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {testResult?.success && (
              <button
                onClick={handleSaveConnection}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? 'Saving...' : 'Save & Continue to Doctor Mapping →'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 4: Doctor mapping */}
      {step === 'mapping' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Doctor Mapping</h2>
            {integration && (
              <button onClick={() => setStep('status')} className="text-sm text-gray-500 hover:text-gray-700">
                ← Back to Dashboard
              </button>
            )}
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Map each Triajji doctor to their corresponding HIS doctor record.
            Auto-matched doctors are pre-selected based on name similarity.
          </p>

          {loadingDoctors ? (
            <TableSkeleton rows={6} />
          ) : triajiDoctors.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              No doctors found for this tenant. Add doctors first.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Triajji Doctor</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">→</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">HIS Doctor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {triajiDoctors.map((td) => (
                      <tr key={td.id} className="border-b border-gray-100">
                        <td className="py-2 px-3 text-gray-900 font-medium" dir="rtl">
                          {td.name_ar}
                        </td>
                        <td className="py-2 px-3 text-center text-gray-400">→</td>
                        <td className="py-2 px-3">
                          <select
                            value={mappings.get(td.id) ?? ''}
                            onChange={(e) => {
                              const newMappings = new Map(mappings);
                              newMappings.set(td.id, e.target.value || null);
                              setMappings(newMappings);
                            }}
                            className="input w-full text-sm"
                            dir="rtl"
                          >
                            <option value="">— Not mapped —</option>
                            {hisDoctors.map((hd) => (
                              <option key={hd.hisDoctorId} value={hd.hisDoctorId}>
                                {hd.nameAr} ({hd.specialtyCode})
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handleSaveMappings}
                  disabled={savingMappings}
                  className="btn-primary"
                >
                  {savingMappings ? 'Saving...' : 'Save Mappings & Continue →'}
                </button>
                <span className="text-xs text-gray-400">
                  {Array.from(mappings.values()).filter(Boolean).length} of {triajiDoctors.length} mapped
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 5: Sync settings */}
      {step === 'sync' && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sync Settings</h2>

          <div className="space-y-4 max-w-lg">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">Auto-sync enabled</p>
                <p className="text-xs text-gray-500 mt-1">
                  Availability syncs every 30 minutes via Railway cron
                </p>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Active
              </span>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Initial Sync</p>
              <p className="text-xs text-gray-500 mb-3">
                Run an initial sync now to pull doctor availability from the HIS.
              </p>
              <button
                onClick={async () => {
                  await handleSync();
                  setStep('status');
                }}
                disabled={syncing}
                className="btn-primary"
              >
                {syncing ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Syncing...
                  </span>
                ) : (
                  'Run Initial Sync →'
                )}
              </button>
            </div>

            {syncResult && (
              <div className={`p-4 rounded-lg ${syncResult.status === 'success' ? 'bg-green-50' : 'bg-amber-50'}`}>
                <p className="text-sm font-medium">
                  Sync {syncResult.status}: {syncResult.doctorsSynced} doctors, {syncResult.slotsAdded} slots added
                </p>
              </div>
            )}

            <button
              onClick={() => setStep('status')}
              className="text-sm text-teal-600 hover:text-teal-700"
            >
              Skip to Dashboard →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getStepIndex(step: SetupStep): number {
  const steps: SetupStep[] = ['vendor', 'credentials', 'test', 'mapping', 'sync', 'status'];
  return steps.indexOf(step);
}
