/**
 * Shared Payment Webhook Processor
 * Called by all provider webhooks (Fawry, Paymob, Vodafone Cash) after signature verification.
 * Handles idempotent completion, payable updates, and patient notifications.
 */

import { createServerClient } from '@triaji/shared/supabase';
import { sendPaymentReceipt } from './notifications';
import { sendWhatsAppMessage } from '@/lib/whatsapp/client';
import { bookingConfirmationMessage, type BookingTemplateData } from '@/lib/whatsapp/templates';
import type { Lang } from '@triaji/shared/i18n/strings';
import { getChainForTenant, upsertChainPatient } from '@/lib/chain/patient-recognition';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ProviderDetails {
  providerOrderId: string;
  paymentMethod: string;
  paidAt: Date;
  webhookPayload: Record<string, unknown>;
}

interface ProcessResult {
  success: boolean;
  error?: string;
}

// ─── Payable Updaters ──────────────────────────────────────────────────────────

async function updateBookingPayable(
  supabase: ReturnType<typeof createServerClient>,
  payableId: string,
  patientPhone: string,
  lang: Lang,
) {
  // Mark booking as confirmed. Patient name, doctor name/specialty, fee and the
  // formatted date/time are not `bookings` columns — they come from the embedded
  // patients/doctors/tenants rows (specialty via doctors→specialties) and from
  // formatting appointment_datetime here.
  const { data: booking, error } = await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', payableId)
    .select(`
      id, appointment_datetime, patient_id, tenant_id,
      patients:patient_id ( name_ar ),
      doctors:doctor_id (
        name_ar, name_en, title_ar, consultation_fee_egp,
        specialties:specialty_id ( name_ar, name_en )
      ),
      tenants:tenant_id (
        id, name_ar, name_en, address_ar
      )
    `)
    .single();

  if (error || !booking) {
    console.error('[processWebhook] Failed to update booking:', error?.message);
    return;
  }

  // Send booking confirmation WhatsApp
  try {
    const patient = booking.patients as unknown as { name_ar?: string } | null;
    const doctor = booking.doctors as unknown as
      | { name_ar?: string; title_ar?: string; consultation_fee_egp?: number; specialties?: { name_ar?: string } | { name_ar?: string }[] }
      | null;
    const tenant = booking.tenants as unknown as Record<string, string> | null;
    if (doctor && tenant) {
      const specialty = Array.isArray(doctor.specialties) ? doctor.specialties[0] : doctor.specialties;
      const appt = booking.appointment_datetime ? new Date(booking.appointment_datetime as string) : null;
      const dateAr = appt
        ? appt.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        : '';
      const timeAr = appt
        ? appt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        : '';
      const templateData: BookingTemplateData = {
        patientName: patient?.name_ar ?? '',
        doctorTitle: doctor.title_ar ?? '',
        doctorName: doctor.name_ar ?? '',
        specialtyName: specialty?.name_ar ?? '',
        dateAr,
        timeAr,
        clinicAddress: tenant.address_ar ?? '',
        fee: doctor.consultation_fee_egp ?? 0,
      };
      await sendWhatsAppMessage(patientPhone, bookingConfirmationMessage(templateData));
    }
  } catch (err) {
    console.error('[processWebhook] Failed to send booking confirmation WhatsApp:', err);
  }

  // Chain patient registry — non-blocking side effect on status → 'confirmed'
  try {
    const tenantId = (booking as Record<string, unknown>).tenant_id as string | undefined
      ?? (booking.tenants as unknown as { id?: string })?.id;
    const patientId = (booking as Record<string, unknown>).patient_id as string | undefined;

    if (tenantId && patientId) {
      getChainForTenant(tenantId)
        .then((chain) => {
          if (chain) {
            return upsertChainPatient(chain.chainId, patientId, tenantId);
          }
        })
        .catch((e) => {
          console.warn('[processWebhook] Chain patient upsert failed (non-blocking):', e);
        });
    }
  } catch {
    // Non-blocking — never fail the webhook
  }
}

async function updateClinicInvoice(
  supabase: ReturnType<typeof createServerClient>,
  payableId: string,
  providerName: string,
) {
  const { error } = await supabase
    .from('clinic_invoices')
    .update({
      status: 'paid',
      payment_method: providerName,
      paid_at: new Date().toISOString(),
    })
    .eq('id', payableId);

  if (error) {
    console.error('[processWebhook] Failed to update clinic_invoice:', error.message);
  }
}

async function updatePharmacyInvoice(
  supabase: ReturnType<typeof createServerClient>,
  payableId: string,
) {
  const { error } = await supabase
    .from('pharmacy_invoices')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
    })
    .eq('id', payableId);

  if (error) {
    console.error('[processWebhook] Failed to update pharmacy_invoice:', error.message);
  }
}

async function updateLabInvoice(
  _supabase: ReturnType<typeof createServerClient>,
  _payableId: string,
) {
  // lab_order_routing has no payment_status/paid_at columns — the authoritative
  // record of payment is the payment_transactions row (already marked completed by
  // the caller). Nothing to mirror onto the routing record.
}

async function updateInsuranceCopay(
  supabase: ReturnType<typeof createServerClient>,
  payableId: string,
) {
  // insurance_claims has no copay_paid/copay_paid_at columns; record the
  // copay payment timestamp via the real paid_at column instead.
  const { error } = await supabase
    .from('insurance_claims')
    .update({
      paid_at: new Date().toISOString(),
    })
    .eq('id', payableId);

  if (error) {
    console.error('[processWebhook] Failed to update insurance_claim copay:', error.message);
  }
}

// ─── Main Processor ────────────────────────────────────────────────────────────

export async function processPaymentCompletion(
  triaji_reference: string,
  providerDetails: ProviderDetails,
): Promise<ProcessResult> {
  const supabase = createServerClient();

  // 1. Find payment_transactions by triaji_reference
  const { data: txn, error: findError } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('triaji_reference', triaji_reference)
    .single();

  if (findError || !txn) {
    console.error('[processWebhook] Transaction not found:', triaji_reference);
    return { success: false, error: 'Transaction not found' };
  }

  // 2. Idempotent — if already completed, return success
  if (txn.status === 'completed') {
    return { success: true };
  }

  // 3. Update payment_transactions
  const { error: updateError } = await supabase
    .from('payment_transactions')
    .update({
      status: 'completed',
      completed_at: providerDetails.paidAt.toISOString(),
      provider_order_id: providerDetails.providerOrderId,
      payment_method_detail: providerDetails.paymentMethod,
      webhook_received_at: new Date().toISOString(),
      webhook_payload: providerDetails.webhookPayload,
    })
    .eq('id', txn.id);

  if (updateError) {
    console.error('[processWebhook] Failed to update transaction:', updateError.message);
    return { success: false, error: updateError.message };
  }

  // 4. Look up patient for phone + language preference
  const { data: patient } = await supabase
    .from('patients')
    .select('phone_number, patient_profiles(preferred_language)')
    .eq('id', txn.patient_id)
    .single();

  const patientPhone = patient?.phone_number ?? '';
  const lang: Lang =
    ((patient?.patient_profiles as { preferred_language: string | null }[] | null)?.[0]
      ?.preferred_language as Lang) ?? 'ar';

  // 5. Update the payable based on payable_type
  switch (txn.payable_type) {
    case 'booking':
      await updateBookingPayable(supabase, txn.payable_id, patientPhone, lang);
      break;
    case 'clinic_invoice':
      await updateClinicInvoice(supabase, txn.payable_id, txn.provider);
      break;
    case 'pharmacy_invoice':
      await updatePharmacyInvoice(supabase, txn.payable_id);
      break;
    case 'lab_invoice':
      await updateLabInvoice(supabase, txn.payable_id);
      break;
    case 'insurance_copay':
      await updateInsuranceCopay(supabase, txn.payable_id);
      break;
  }

  // 6. Send receipt WhatsApp to patient
  if (patientPhone) {
    try {
      // Build description from payable type
      const descriptions: Record<string, { ar: string; en: string }> = {
        booking: { ar: 'حجز موعد', en: 'Appointment booking' },
        clinic_invoice: { ar: 'فاتورة عيادة', en: 'Clinic invoice' },
        pharmacy_invoice: { ar: 'فاتورة صيدلية', en: 'Pharmacy invoice' },
        lab_invoice: { ar: 'فاتورة تحاليل', en: 'Lab invoice' },
        insurance_copay: { ar: 'مشاركة تأمين', en: 'Insurance copay' },
      };

      const desc = descriptions[txn.payable_type] ?? { ar: 'دفع', en: 'Payment' };
      const providerNames: Record<string, string> = {
        fawry: 'Fawry',
        paymob: 'Card',
        vodafone_cash: 'Vodafone Cash',
      };

      await sendPaymentReceipt(patientPhone, lang, {
        description: desc[lang],
        amount: Number(txn.amount_egp),
        method: providerNames[txn.provider] ?? txn.provider,
        reference: triaji_reference,
        date: providerDetails.paidAt,
      });
    } catch (err) {
      console.error('[processWebhook] Failed to send receipt:', err);
      // Don't fail the webhook for notification errors
    }
  }

  return { success: true };
}
