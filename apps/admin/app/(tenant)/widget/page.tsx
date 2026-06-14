'use client';

import { useState, useEffect, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { showToast } from '@/components/ui/Toast';
import QRCode from 'qrcode';

interface WidgetConfig {
  tenant_id: string;
  logo_url: string | null;
  primary_color: string;
  welcome_message_ar: string;
  widget_domains: string[];
  booking_mode: string;
}

interface TenantInfo {
  slug: string;
  tier: string;
}

export default function WidgetPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [config, setConfig] = useState<WidgetConfig>({
    tenant_id: '',
    logo_url: '',
    primary_color: '#0D7A7A',
    welcome_message_ar: 'أهلاً بيك في ترياچي! أنا هنا أساعدك تلاقي الدكتور المناسب.',
    widget_domains: [],
    booking_mode: 'native',
  });
  const [newDomain, setNewDomain] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get admin user's tenant
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!adminUser?.tenant_id) {
        setLoading(false);
        return;
      }

      const [tenantRes, configRes] = await Promise.all([
        supabase.from('tenants').select('slug, tier').eq('id', adminUser.tenant_id).single(),
        supabase.from('tenant_config').select('*').eq('tenant_id', adminUser.tenant_id).single(),
      ]);

      if (tenantRes.data) {
        setTenant(tenantRes.data as TenantInfo);
      }

      if (configRes.data) {
        setConfig({
          tenant_id: adminUser.tenant_id,
          logo_url: configRes.data.logo_url ?? '',
          primary_color: configRes.data.primary_color ?? '#0D7A7A',
          welcome_message_ar: configRes.data.welcome_message_ar ?? '',
          widget_domains: configRes.data.widget_domains ?? [],
          booking_mode: configRes.data.booking_mode ?? 'native',
        });
      }

      setLoading(false);
    }
    load();
  }, []);

  // Generate QR code when tenant changes
  useEffect(() => {
    if (tenant?.slug) {
      const url = `https://app.triajji.com/ar/chat?tenant=${tenant.slug}`;
      QRCode.toDataURL(url, { width: 200, margin: 2 }).then((dataUrl) => {
        setQrDataUrl(dataUrl);
      }).catch(() => {
        // Fallback
      });
    }
  }, [tenant?.slug]);

  async function handleSave() {
    setSaving(true);
    const supabase = getSupabaseBrowser();

    const { error } = await supabase
      .from('tenant_config')
      .update({
        logo_url: config.logo_url || null,
        primary_color: config.primary_color,
        welcome_message_ar: config.welcome_message_ar,
        widget_domains: config.widget_domains,
        booking_mode: config.booking_mode,
      })
      .eq('tenant_id', config.tenant_id);

    if (error) {
      showToast('Failed to save config.', 'error');
    } else {
      showToast('Widget config saved.', 'success');
    }
    setSaving(false);
  }

  function addDomain() {
    const domain = newDomain.trim().toLowerCase();
    if (domain && !config.widget_domains.includes(domain)) {
      setConfig((prev) => ({
        ...prev,
        widget_domains: [...prev.widget_domains, domain],
      }));
      setNewDomain('');
    }
  }

  function removeDomain(domain: string) {
    setConfig((prev) => ({
      ...prev,
      widget_domains: prev.widget_domains.filter((d) => d !== domain),
    }));
  }

  function copyEmbedCode() {
    const code = getEmbedCode();
    navigator.clipboard.writeText(code).then(() => {
      showToast('Embed code copied to clipboard.', 'success');
    });
  }

  function getEmbedCode(): string {
    return `<!-- Triajji Medical Triage Widget -->
<script>
  window.TriajjiConfig = {
    tenantSlug: '${tenant?.slug ?? ''}',
    primaryColor: '${config.primary_color}',
  };
</script>
<script src="https://app.triajji.com/widget.js" async></script>
<div id="triaji-widget"></div>`;
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Widget & Embed</h1>
        <div className="card animate-pulse h-64" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Widget & Embed</h1>
        <p className="text-gray-500">No tenant associated with your account. Contact the platform admin.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Widget & Embed</h1>

      {/* Configuration */}
      <div className="card space-y-5 mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Configuration</h2>

        <div>
          <label className="label">Logo URL</label>
          <input
            type="text"
            value={config.logo_url ?? ''}
            onChange={(e) => setConfig((p) => ({ ...p, logo_url: e.target.value }))}
            className="input-field"
            placeholder="https://your-hospital.com/logo.png"
          />
          {config.logo_url && (
            <img src={config.logo_url} alt="Logo preview" className="mt-2 h-10 object-contain" />
          )}
        </div>

        <div>
          <label className="label">Primary Color</label>
          <div className="flex gap-3 items-center">
            <input
              type="color"
              value={config.primary_color}
              onChange={(e) => setConfig((p) => ({ ...p, primary_color: e.target.value }))}
              className="h-10 w-12 cursor-pointer rounded"
            />
            <input
              type="text"
              value={config.primary_color}
              onChange={(e) => setConfig((p) => ({ ...p, primary_color: e.target.value }))}
              className="input-field w-32 font-mono"
            />
            <div className="w-8 h-8 rounded" style={{ backgroundColor: config.primary_color }} />
          </div>
        </div>

        <div>
          <label className="label">Welcome Message (Arabic)</label>
          <textarea
            dir="rtl"
            value={config.welcome_message_ar}
            onChange={(e) => setConfig((p) => ({ ...p, welcome_message_ar: e.target.value }))}
            className="input-field h-24 resize-none"
          />
        </div>

        <div>
          <label className="label">Allowed Domains</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDomain(); } }}
              className="input-field flex-1"
              placeholder="cairo-hospital.com"
            />
            <button onClick={addDomain} className="btn-secondary">Add</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {config.widget_domains.map((domain) => (
              <span key={domain} className="inline-flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full text-sm">
                {domain}
                <button onClick={() => removeDomain(domain)} className="text-gray-400 hover:text-red-500">&times;</button>
              </span>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Booking Mode</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={config.booking_mode === 'native'} onChange={() => setConfig((p) => ({ ...p, booking_mode: 'native' }))} />
              Native
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input type="radio" disabled />
              HIS Integration {tenant.tier === 'basic' && <span className="text-xs text-amber-600">(Premium tier required)</span>}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input type="radio" disabled />
              Hybrid {tenant.tier === 'basic' && <span className="text-xs text-amber-600">(Premium tier required)</span>}
            </label>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {/* Embed Code */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Embed Code</h2>
        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap overflow-x-auto mb-4">
          {getEmbedCode()}
        </pre>
        <button onClick={copyEmbedCode} className="btn-primary">
          Copy Code
        </button>
      </div>

      {/* QR Code */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Patient Direct Link</h2>
        <div className="flex items-start gap-6">
          <div>
            <p className="text-sm text-gray-500 mb-2">Scan to open triage:</p>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code" className="w-48 h-48" />
            ) : (
              <canvas ref={canvasRef} className="w-48 h-48 bg-gray-100 rounded" />
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Direct URL:</p>
            <code className="text-sm bg-gray-100 px-3 py-1.5 rounded block mb-3">
              https://app.triajji.com/ar/chat?tenant={tenant.slug}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`https://app.triajji.com/ar/chat?tenant=${tenant.slug}`);
                showToast('Link copied.', 'success');
              }}
              className="btn-secondary text-sm"
            >
              Copy Link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
