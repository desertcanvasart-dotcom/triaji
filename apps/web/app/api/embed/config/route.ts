/**
 * GET /api/embed/config?tenant={slug}
 *
 * Called by the widget bundle on every page load.
 * Validates the request origin against the tenant's allowed domains.
 * Returns the tenant's public config (no secrets).
 */

import { NextRequest } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { corsJson, corsOptions } from '../../cors';

interface TenantConfigRow {
  logo_url: string | null;
  primary_color: string | null;
  welcome_message_ar: string | null;
  widget_domains: string[] | null;
  booking_mode: string | null;
}

interface TenantRow {
  id: string;
  name_ar: string;
  slug: string;
  is_active: boolean;
  tenant_config: TenantConfigRow[] | TenantConfigRow | null;
}

function extractHostname(origin: string): string | null {
  try {
    const url = new URL(origin);
    return url.hostname;
  } catch {
    return null;
  }
}

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(request: NextRequest) {
  const tenantSlug = request.nextUrl.searchParams.get('tenant');
  const origin = request.headers.get('origin') ?? '';

  if (!tenantSlug) {
    return corsJson({ error: 'tenant required' }, { status: 400 });
  }

  // Load tenant + config
  const supabase = createServerClient();
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, name_ar, slug, is_active, tenant_config(*)')
    .eq('slug', tenantSlug)
    .single();

  if (error || !tenant) {
    return corsJson({ error: 'tenant not found' }, { status: 404 });
  }

  const t = tenant as unknown as TenantRow;

  if (!t.is_active) {
    return corsJson({ error: 'tenant not found' }, { status: 404 });
  }

  // Extract config (Supabase returns array for foreign table, take first)
  const configData: TenantConfigRow | null = Array.isArray(t.tenant_config)
    ? (t.tenant_config[0] ?? null)
    : t.tenant_config;

  const allowedDomains: string[] = configData?.widget_domains ?? [];

  // Domain allowlist check
  const requestHostname = extractHostname(origin);

  // Allow: localhost (development), allowed domains list, empty origin (direct API calls)
  const isDevelopment =
    !origin ||
    requestHostname === 'localhost' ||
    requestHostname === '127.0.0.1' ||
    requestHostname?.endsWith('.localhost');

  const isAllowed =
    isDevelopment ||
    allowedDomains.length === 0 || // If no domains configured, allow all (pre-configuration)
    allowedDomains.some(
      (d) => requestHostname === d || requestHostname?.endsWith(`.${d}`)
    );

  if (!isAllowed) {
    console.warn(`[Widget] Blocked: ${origin} not in allowlist for ${tenantSlug}`);
    return corsJson({ error: 'domain not authorised' }, { status: 403 });
  }

  // Return safe public config (no secrets)
  return corsJson(
    {
      tenantSlug: t.slug,
      tenantId: t.id,
      nameAr: t.name_ar,
      logoUrl: configData?.logo_url ?? null,
      primaryColor: configData?.primary_color ?? '0D7A7A',
      welcomeMessageAr:
        configData?.welcome_message_ar ??
        'أهلاً بيك في ترياچي! أنا هنا أساعدك تلاقي الدكتور المناسب.',
      bookingMode: configData?.booking_mode ?? 'native',
    },
    { cache: 'public, max-age=300' }
  );
}
