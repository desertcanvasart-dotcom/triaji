/**
 * Insurance WhatsApp Notification Functions
 *
 * Bilingual (Arabic/English) notification templates for insurance events.
 * Uses sendWhatsAppMessage from the WhatsApp client.
 */

import { sendWhatsAppMessage, type WhatsAppResult } from '@/lib/whatsapp/client';

// ─── Arabic date formatting ─────────────────────────────────────────────────

function formatDateAr(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateEn(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-EG') + ' EGP';
}

// ─── Policy Verified Notification ───────────────────────────────────────────

interface PolicyVerifiedData {
  insurerNameAr: string;
  insurerNameEn: string;
  policyNumber: string;
  status: 'active' | 'expired' | 'suspended';
  annualLimitEgp?: number;
  copayPct?: number;
  coverageEnd?: string;
}

export async function sendPolicyVerifiedNotification(
  phone: string,
  lang: string,
  data: PolicyVerifiedData
): Promise<WhatsAppResult> {
  const isActive = data.status === 'active';

  const message = lang === 'en'
    ? isActive
      ? [
          `Your insurance policy has been verified successfully.`,
          ``,
          `Insurer: ${data.insurerNameEn}`,
          `Policy: ${data.policyNumber}`,
          `Status: Active`,
          data.annualLimitEgp ? `Annual Limit: ${formatCurrency(data.annualLimitEgp)}` : '',
          data.copayPct != null ? `Co-pay: ${data.copayPct}%` : '',
          data.coverageEnd ? `Coverage Until: ${formatDateEn(data.coverageEnd)}` : '',
          ``,
          `You can now use your insurance for appointments and services.`,
          `DoctorTrio Healthcare`,
        ].filter(Boolean).join('\n')
      : [
          `Your insurance policy verification is complete.`,
          ``,
          `Insurer: ${data.insurerNameEn}`,
          `Policy: ${data.policyNumber}`,
          `Status: ${data.status === 'expired' ? 'Expired' : 'Suspended'}`,
          ``,
          `Please contact your insurance provider for more details.`,
          `DoctorTrio Healthcare`,
        ].filter(Boolean).join('\n')
    : isActive
      ? [
          `تم التحقق من بوليصة التأمين الخاصة بك بنجاح.`,
          ``,
          `شركة التأمين: ${data.insurerNameAr}`,
          `رقم البوليصة: ${data.policyNumber}`,
          `الحالة: سارية`,
          data.annualLimitEgp ? `الحد السنوي: ${formatCurrency(data.annualLimitEgp)}` : '',
          data.copayPct != null ? `نسبة التحمل: ${data.copayPct}%` : '',
          data.coverageEnd ? `التغطية حتى: ${formatDateAr(data.coverageEnd)}` : '',
          ``,
          `تقدر دلوقتي تستخدم التأمين في المواعيد والخدمات.`,
          `دكتور تريو للرعاية الصحية`,
        ].filter(Boolean).join('\n')
      : [
          `تم مراجعة بوليصة التأمين الخاصة بك.`,
          ``,
          `شركة التأمين: ${data.insurerNameAr}`,
          `رقم البوليصة: ${data.policyNumber}`,
          `الحالة: ${data.status === 'expired' ? 'منتهية' : 'موقوفة'}`,
          ``,
          `من فضلك تواصل مع شركة التأمين لمزيد من التفاصيل.`,
          `دكتور تريو للرعاية الصحية`,
        ].filter(Boolean).join('\n');

  return sendWhatsAppMessage(phone, message);
}

// ─── Pre-Auth Decision Notification ─────────────────────────────────────────

interface PreAuthDecisionData {
  procedureDescriptionAr: string;
  procedureDescriptionEn?: string;
  decision: 'approved' | 'approved_partial' | 'denied';
  approvedAmountEgp?: number;
  denialReasonAr?: string;
  approvalConditionsAr?: string;
  validUntil?: string;
}

export async function sendPreAuthDecisionNotification(
  phone: string,
  lang: string,
  data: PreAuthDecisionData
): Promise<WhatsAppResult> {
  const isApproved = data.decision === 'approved' || data.decision === 'approved_partial';
  const isPartial = data.decision === 'approved_partial';

  const message = lang === 'en'
    ? isApproved
      ? [
          `Your pre-authorization request has been ${isPartial ? 'partially ' : ''}approved.`,
          ``,
          `Procedure: ${data.procedureDescriptionEn ?? data.procedureDescriptionAr}`,
          data.approvedAmountEgp ? `Approved Amount: ${formatCurrency(data.approvedAmountEgp)}` : '',
          data.approvalConditionsAr ? `Conditions: ${data.approvalConditionsAr}` : '',
          data.validUntil ? `Valid Until: ${formatDateEn(data.validUntil)}` : '',
          ``,
          `You can now proceed with booking your appointment.`,
          `DoctorTrio Healthcare`,
        ].filter(Boolean).join('\n')
      : [
          `Your pre-authorization request has been denied.`,
          ``,
          `Procedure: ${data.procedureDescriptionEn ?? data.procedureDescriptionAr}`,
          data.denialReasonAr ? `Reason: ${data.denialReasonAr}` : '',
          ``,
          `Please contact your insurance provider if you wish to appeal.`,
          `DoctorTrio Healthcare`,
        ].filter(Boolean).join('\n')
    : isApproved
      ? [
          `تمت الموافقة ${isPartial ? 'الجزئية ' : ''}على طلب الموافقة المسبقة.`,
          ``,
          `الإجراء: ${data.procedureDescriptionAr}`,
          data.approvedAmountEgp ? `المبلغ المعتمد: ${formatCurrency(data.approvedAmountEgp)}` : '',
          data.approvalConditionsAr ? `الشروط: ${data.approvalConditionsAr}` : '',
          data.validUntil ? `صالح حتى: ${formatDateAr(data.validUntil)}` : '',
          ``,
          `تقدر دلوقتي تحجز موعدك.`,
          `دكتور تريو للرعاية الصحية`,
        ].filter(Boolean).join('\n')
      : [
          `تم رفض طلب الموافقة المسبقة.`,
          ``,
          `الإجراء: ${data.procedureDescriptionAr}`,
          data.denialReasonAr ? `السبب: ${data.denialReasonAr}` : '',
          ``,
          `من فضلك تواصل مع شركة التأمين لو عايز تقدم تظلم.`,
          `دكتور تريو للرعاية الصحية`,
        ].filter(Boolean).join('\n');

  return sendWhatsAppMessage(phone, message);
}

// ─── Claim Decision Notification (to provider, always Arabic) ───────────────

interface ClaimDecisionData {
  claimNumber: string;
  patientNameAr: string;
  decision: 'approved' | 'approved_partial' | 'rejected';
  totalAmountEgp: number;
  approvedAmountEgp?: number;
  patientCopayEgp?: number;
  providerReceivesEgp?: number;
  rejectionReasonAr?: string;
}

export async function sendClaimDecisionNotification(
  phone: string,
  _lang: string,
  data: ClaimDecisionData
): Promise<WhatsAppResult> {
  // Provider notifications are always in Arabic
  const isApproved = data.decision === 'approved' || data.decision === 'approved_partial';

  const message = isApproved
    ? [
        `تم ${data.decision === 'approved_partial' ? 'الموافقة الجزئية على' : 'اعتماد'} المطالبة.`,
        ``,
        `رقم المطالبة: ${data.claimNumber}`,
        `المريض: ${data.patientNameAr}`,
        `المبلغ الإجمالي: ${formatCurrency(data.totalAmountEgp)}`,
        data.approvedAmountEgp ? `المبلغ المعتمد: ${formatCurrency(data.approvedAmountEgp)}` : '',
        data.patientCopayEgp ? `تحمل المريض: ${formatCurrency(data.patientCopayEgp)}` : '',
        data.providerReceivesEgp ? `المستحق للمقدم: ${formatCurrency(data.providerReceivesEgp)}` : '',
        ``,
        `دكتور تريو للرعاية الصحية`,
      ].filter(Boolean).join('\n')
    : [
        `تم رفض المطالبة.`,
        ``,
        `رقم المطالبة: ${data.claimNumber}`,
        `المريض: ${data.patientNameAr}`,
        `المبلغ: ${formatCurrency(data.totalAmountEgp)}`,
        data.rejectionReasonAr ? `سبب الرفض: ${data.rejectionReasonAr}` : '',
        ``,
        `يمكنك تقديم تظلم من خلال النظام.`,
        `دكتور تريو للرعاية الصحية`,
      ].filter(Boolean).join('\n');

  return sendWhatsAppMessage(phone, message);
}

// ─── Pre-Auth Submitted Notification (to patient) ───────────────────────────

interface PreAuthSubmittedData {
  doctorNameAr: string;
  doctorNameEn?: string;
  procedureDescriptionAr: string;
  procedureDescriptionEn?: string;
  urgency: string;
  expectedResponseHours: number;
}

export async function sendPreAuthSubmittedNotification(
  phone: string,
  lang: string,
  data: PreAuthSubmittedData
): Promise<WhatsAppResult> {
  const message = lang === 'en'
    ? [
        `A pre-authorization request has been submitted for you.`,
        ``,
        `Doctor: ${data.doctorNameEn ?? data.doctorNameAr}`,
        `Procedure: ${data.procedureDescriptionEn ?? data.procedureDescriptionAr}`,
        `Priority: ${data.urgency === 'urgent' ? 'Urgent' : 'Routine'}`,
        `Expected Response: within ${data.expectedResponseHours} hours`,
        ``,
        `We'll notify you once the insurance company responds.`,
        `DoctorTrio Healthcare`,
      ].join('\n')
    : [
        `تم تقديم طلب موافقة مسبقة من التأمين بخصوصك.`,
        ``,
        `الدكتور: ${data.doctorNameAr}`,
        `الإجراء: ${data.procedureDescriptionAr}`,
        `الأولوية: ${data.urgency === 'urgent' ? 'عاجل' : 'عادي'}`,
        `الرد المتوقع: خلال ${data.expectedResponseHours} ساعة`,
        ``,
        `هنبلغك أول ما شركة التأمين ترد.`,
        `دكتور تريو للرعاية الصحية`,
      ].join('\n');

  return sendWhatsAppMessage(phone, message);
}
