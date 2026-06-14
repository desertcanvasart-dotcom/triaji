/**
 * POST /api/admin/payments/reminder
 *
 * Send a payment reminder WhatsApp to a patient for an unpaid invoice.
 * Body: { payment_transaction_id: string }
 *
 * Auth: admin (clinic/lab/pharmacy billing or owner roles)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateAdmin } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Auth
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { admin } = authResult;

  // Only billing/owner/admin roles
  const allowedRoles = [
    'platform_admin',
    'tenant_admin',
    'clinic_owner',
    'clinic_billing',
    'lab_owner',
    'lab_billing',
    'pharmacy_owner',
    'pharmacy_billing',
  ];

  if (!allowedRoles.includes(admin.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { payment_transaction_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.payment_transaction_id) {
    return NextResponse.json(
      { error: 'payment_transaction_id is required' },
      { status: 400 },
    );
  }

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']!;
  const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Look up the payment transaction
  const { data: txn, error: txnError } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('id', body.payment_transaction_id)
    .single();

  if (txnError || !txn) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }

  // Verify tenant access (non-platform admins can only access their own tenant)
  if (admin.role !== 'platform_admin' && admin.tenant_id) {
    if (txn.tenant_id && txn.tenant_id !== admin.tenant_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  if (txn.status === 'completed') {
    return NextResponse.json({ error: 'Payment already completed' }, { status: 400 });
  }

  // 2. Look up patient
  const { data: patient } = await supabase
    .from('patients')
    .select('phone, preferred_language, full_name_ar')
    .eq('id', txn.patient_id)
    .single();

  if (!patient?.phone) {
    return NextResponse.json({ error: 'Patient phone not found' }, { status: 400 });
  }

  const lang = (patient.preferred_language ?? 'ar') as 'ar' | 'en';

  // 3. Look up tenant name for the reminder message
  let providerName = '';
  if (txn.tenant_id) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name_ar, name_en')
      .eq('id', txn.tenant_id)
      .single();

    providerName = lang === 'en'
      ? (tenant?.name_en ?? tenant?.name_ar ?? '')
      : (tenant?.name_ar ?? '');
  }

  // 4. Build payment link
  const baseUrl = process.env['NEXT_PUBLIC_BASE_URL'] ?? 'https://triajji.com';
  const paymentLink = `${baseUrl}/${lang}/pay/${txn.triaji_reference}`;

  // 5. Send WhatsApp reminder
  // We call the web app's notification service via internal API
  const reminderRes = await fetch(`${baseUrl}/api/payments/reminder-send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: patient.phone,
      lang,
      providerName,
      invoiceNumber: txn.triaji_reference,
      amount: Number(txn.amount_egp),
      paymentLink,
    }),
  });

  // If the internal endpoint doesn't exist, send directly via WhatsApp
  if (!reminderRes.ok) {
    // Fallback: construct message directly
    const amountStr = lang === 'ar' ? `${Number(txn.amount_egp).toFixed(2)} جنيه` : `EGP ${Number(txn.amount_egp).toFixed(2)}`;

    const message = lang === 'ar'
      ? `تذكير بفاتورة غير مسددة 🔔

🏥 ${providerName}
📄 رقم المرجع: ${txn.triaji_reference}
💰 المبلغ: ${amountStr}

💳 ادفع دلوقتي:
${paymentLink}

ترياچي 🏥`
      : `Payment reminder 🔔

🏥 ${providerName}
📄 Reference: ${txn.triaji_reference}
💰 Amount: ${amountStr}

💳 Pay now:
${paymentLink}

Triajji 🏥`;

    // Call WhatsApp API directly via the web app
    try {
      const waRes = await fetch(`${baseUrl}/api/whatsapp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: patient.phone, message }),
      });

      if (!waRes.ok) {
        console.error('[payments/reminder] WhatsApp send failed');
      }
    } catch (err) {
      console.error('[payments/reminder] WhatsApp send error:', err);
    }
  }

  // 6. Log the reminder
  await supabase.from('payment_reminders_log').insert({
    payment_transaction_id: txn.id,
    sent_by: admin.id,
    sent_at: new Date().toISOString(),
    channel: 'whatsapp',
  }).then(() => {}).catch(() => {});

  return NextResponse.json({ success: true, sent_to: patient.phone });
}
