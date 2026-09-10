import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, requireClinicAccess } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/admin/clinic/payment-settings — save the clinic's online-payment
 * configuration.
 *
 * PaymentSettingsSection has always PUT here, but the route did not exist, so
 * every save 404'd and fell back to a direct Supabase upsert from the browser.
 *
 * All values live on `tenant_config` under their real column names (the form
 * already uses them): accepts_online_payment, payment_providers,
 * fawry_merchant_code, paymob_integration_id, vf_merchant_code.
 */

const VALID_PROVIDERS = ['fawry', 'paymob', 'vodafone_cash'] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

interface PaymentSettingsBody {
  accepts_online_payment?: boolean;
  payment_providers?: string[];
  fawry_merchant_code?: string;
  paymob_integration_id?: string;
  vf_merchant_code?: string;
}

function validate(body: PaymentSettingsBody): string | null {
  if (
    body.accepts_online_payment !== undefined &&
    typeof body.accepts_online_payment !== 'boolean'
  ) {
    return 'accepts_online_payment must be a boolean.';
  }
  if (body.payment_providers !== undefined) {
    if (
      !Array.isArray(body.payment_providers) ||
      body.payment_providers.some((p) => !VALID_PROVIDERS.includes(p as Provider))
    ) {
      return `payment_providers must be an array of: ${VALID_PROVIDERS.join(', ')}.`;
    }
  }
  return null;
}

/** Only include what was actually sent, so a partial save can't blank a field. */
function toConfigRow(body: PaymentSettingsBody): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (body.accepts_online_payment !== undefined) {
    row.accepts_online_payment = body.accepts_online_payment;
  }
  if (body.payment_providers !== undefined) {
    // De-duplicate while preserving order.
    row.payment_providers = Array.from(new Set(body.payment_providers));
  }
  const codes: (keyof PaymentSettingsBody)[] = [
    'fawry_merchant_code',
    'paymob_integration_id',
    'vf_merchant_code',
  ];
  for (const key of codes) {
    const value = body[key];
    if (value !== undefined) row[key] = (value as string) || null;
  }
  return row;
}

export async function PUT(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { admin } = authResult;
  const clinicCheck = requireClinicAccess(admin);
  if (clinicCheck) return clinicCheck;

  // Scoped to the caller's own clinic — the tenant is never taken from the body.
  const tenantId = admin.tenant_id;
  if (!tenantId) {
    return NextResponse.json(
      { error: 'This account is not attached to a clinic.' },
      { status: 400 }
    );
  }

  let body: PaymentSettingsBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const invalid = validate(body);
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 });
  }

  const row = toConfigRow(body);
  if (Object.keys(row).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // tenant_config has no unique constraint on tenant_id, so upsert can't key on
  // it — update first, insert only when the tenant has no config row yet.
  const { data: updated, error: updateError } = await supabase
    .from('tenant_config')
    .update(row)
    .eq('tenant_id', tenantId)
    .select('tenant_id');

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (!updated || updated.length === 0) {
    const { error: insertError } = await supabase
      .from('tenant_config')
      .insert({ tenant_id: tenantId, ...row });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
