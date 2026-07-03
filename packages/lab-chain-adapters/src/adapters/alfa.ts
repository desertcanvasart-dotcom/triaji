/**
 * Alfa Lab Adapter
 *
 * Integrates with Alfa Lab's API for lab order submission,
 * slot booking, result retrieval, and payment initiation.
 */

import { createHmac } from 'crypto';
import type {
  LabChainAdapter,
  LabChainOrder,
  LabChainOrderResult,
  LabChainSlot,
  LabChainPatient,
  LabChainBookingResult,
  LabChainResult,
  LabChainPaymentResult,
} from '../interface';

// ─── Test Code Mapping ────────────────────────────────────────────────────────

/** Map Triaji internal test codes to Alfa Lab codes */
const TEST_CODE_MAP: Record<string, string> = {
  'cbc': 'ALFA-CBC-01',
  'crp': 'ALFA-CRP-01',
  'hba1c': 'ALFA-HBA1C-01',
  'lipid-panel': 'ALFA-LIP-01',
  'thyroid-panel': 'ALFA-THY-01',
  'liver-function': 'ALFA-LFT-01',
  'kidney-function': 'ALFA-KFT-01',
  'urine-analysis': 'ALFA-UA-01',
  'vitamin-d': 'ALFA-VITD-01',
  'iron-studies': 'ALFA-IRON-01',
  'blood-sugar-fasting': 'ALFA-FBS-01',
  'blood-sugar-random': 'ALFA-RBS-01',
  'esr': 'ALFA-ESR-01',
  'pt-inr': 'ALFA-PTINR-01',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** External API responses are unvalidated JSON — fields are coerced/defaulted at use sites. */
type ApiResponse = Record<string, any>;

function getEnv(key: string): string {
  return process.env[key] ?? '';
}

function generateHmacSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function mapTestCode(triajiCode: string): string {
  return TEST_CODE_MAP[triajiCode] ?? triajiCode;
}

function mapOrderToAlfaFormat(order: LabChainOrder) {
  return {
    ref: `triaji-${order.tenantId}-${order.patientId}-${Date.now()}`,
    patient: {
      name: order.patient.name,
      name_ar: order.patient.nameAr ?? order.patient.name,
      mobile: order.patient.phone,
      national_id: order.patient.nationalId,
      dob: order.patient.dateOfBirth,
      gender: order.patient.gender,
      email: order.patient.email,
    },
    tests: order.tests.map((t) => ({
      code: mapTestCode(t.code),
      name: t.name,
    })),
    branch_id: order.branchId,
    home_collection: order.homeCollection ?? false,
    address: order.address,
    notes: order.notes,
    preferred_date: order.preferredDate,
    preferred_time: order.preferredTime,
    insurance_ref: order.insurancePolicyNumber,
  };
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class AlfaAdapter implements LabChainAdapter {
  private get baseUrl(): string {
    return getEnv('ALFA_BASE_URL');
  }

  private get apiKey(): string {
    return getEnv('ALFA_API_KEY');
  }

  private get secret(): string {
    return getEnv('ALFA_SECRET');
  }

  private get webhookSecret(): string {
    return getEnv('ALFA_WEBHOOK_SECRET');
  }

  private headers(body?: string): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (body) {
      h['X-Signature'] = generateHmacSignature(body, this.secret);
    }
    return h;
  }

  // ─── Interface Methods ────────────────────────────────────────────────────

  isConfigured(): boolean {
    return !!(this.baseUrl && this.apiKey && this.secret);
  }

  async submitOrder(order: LabChainOrder): Promise<LabChainOrderResult> {
    try {
      const payload = mapOrderToAlfaFormat(order);
      const body = JSON.stringify(payload);

      const res = await fetch(`${this.baseUrl}/api/v1/orders`, {
        method: 'POST',
        headers: this.headers(body),
        body,
      });

      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `Alfa Lab API error ${res.status}: ${err}` };
      }

      const data = (await res.json()) as ApiResponse;
      return {
        success: true,
        orderId: data.order_id ?? data.id,
        estimatedDate: data.estimated_date,
        totalPrice: data.total_price,
        currency: data.currency ?? 'EGP',
      };
    } catch (err) {
      return {
        success: false,
        error: `Alfa Lab connection error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  async getAvailableSlots(params: {
    testCodes: string[];
    branchId?: string;
    latitude?: number;
    longitude?: number;
    date?: string;
  }): Promise<LabChainSlot[]> {
    try {
      const query = new URLSearchParams();
      query.set('tests', params.testCodes.map(mapTestCode).join(','));
      if (params.branchId) query.set('branch_id', params.branchId);
      if (params.latitude) query.set('lat', String(params.latitude));
      if (params.longitude) query.set('lng', String(params.longitude));
      if (params.date) query.set('date', params.date);

      const res = await fetch(`${this.baseUrl}/api/v1/slots?${query}`, {
        method: 'GET',
        headers: this.headers(),
      });

      if (!res.ok) return [];

      const data = (await res.json()) as ApiResponse;
      const slots: LabChainSlot[] = (data.slots ?? data ?? []).map(
        (s: Record<string, unknown>) => ({
          slotId: String(s.slot_id ?? s.id),
          branchId: String(s.branch_id),
          branchName: String(s.branch_name ?? ''),
          branchNameAr: s.branch_name_ar ? String(s.branch_name_ar) : undefined,
          date: String(s.date),
          startTime: String(s.start_time),
          endTime: String(s.end_time),
          available: Boolean(s.available ?? true),
          homeCollection: s.home_collection ? Boolean(s.home_collection) : undefined,
        }),
      );

      return slots;
    } catch {
      return [];
    }
  }

  async bookAppointment(params: {
    slotId: string;
    patient: LabChainPatient;
    testCodes: string[];
    orderId?: string;
  }): Promise<LabChainBookingResult> {
    try {
      const payload = {
        slot_id: params.slotId,
        patient: {
          name: params.patient.name,
          mobile: params.patient.phone,
          national_id: params.patient.nationalId,
        },
        tests: params.testCodes.map(mapTestCode),
        order_id: params.orderId,
      };
      const body = JSON.stringify(payload);

      const res = await fetch(`${this.baseUrl}/api/v1/appointments`, {
        method: 'POST',
        headers: this.headers(body),
        body,
      });

      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `Alfa Lab booking error ${res.status}: ${err}` };
      }

      const data = (await res.json()) as ApiResponse;
      return {
        success: true,
        bookingId: data.booking_id ?? data.id,
        slotId: params.slotId,
        confirmationCode: data.confirmation_code,
        date: data.date,
        time: data.time,
        branchName: data.branch_name,
      };
    } catch (err) {
      return {
        success: false,
        error: `Alfa Lab booking error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  async getResults(orderId: string): Promise<LabChainResult | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/orders/${orderId}/results`, {
        method: 'GET',
        headers: this.headers(),
      });

      if (res.status === 404 || res.status === 204) return null;
      if (!res.ok) return null;

      const data = (await res.json()) as ApiResponse;

      if (data.status === 'pending' && (!data.results || data.results.length === 0)) {
        return null;
      }

      return {
        orderId,
        status: data.status ?? 'pending',
        completedAt: data.completed_at,
        results: (data.results ?? []).map((r: Record<string, unknown>) => ({
          testCode: String(r.test_code ?? ''),
          testName: String(r.test_name ?? ''),
          testNameAr: r.test_name_ar ? String(r.test_name_ar) : undefined,
          value: String(r.value ?? ''),
          unit: r.unit ? String(r.unit) : undefined,
          referenceRange: r.reference_range ? String(r.reference_range) : undefined,
          abnormal: r.abnormal ? Boolean(r.abnormal) : undefined,
          notes: r.notes ? String(r.notes) : undefined,
        })),
        pdfUrl: data.pdf_url ? String(data.pdf_url) : undefined,
      };
    } catch {
      return null;
    }
  }

  async initiatePayment(params: {
    orderId: string;
    amount: number;
    currency?: string;
    patientPhone: string;
    returnUrl?: string;
  }): Promise<LabChainPaymentResult> {
    try {
      const payload = {
        order_id: params.orderId,
        amount: params.amount,
        currency: params.currency ?? 'EGP',
        patient_phone: params.patientPhone,
        return_url: params.returnUrl,
      };
      const body = JSON.stringify(payload);

      const res = await fetch(`${this.baseUrl}/api/v1/payments`, {
        method: 'POST',
        headers: this.headers(body),
        body,
      });

      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `Alfa Lab payment error ${res.status}: ${err}` };
      }

      const data = (await res.json()) as ApiResponse;
      return {
        success: true,
        paymentId: data.payment_id ?? data.id,
        paymentUrl: data.payment_url,
        referenceCode: data.reference_code,
        amount: data.amount,
        currency: data.currency ?? 'EGP',
        expiresAt: data.expires_at,
      };
    } catch (err) {
      return {
        success: false,
        error: `Alfa Lab payment error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  verifyWebhook(params: {
    payload: string;
    signature: string;
    timestamp?: string;
  }): boolean {
    try {
      if (!this.webhookSecret) return false;

      const data = params.timestamp
        ? `${params.timestamp}.${params.payload}`
        : params.payload;

      const expected = generateHmacSignature(data, this.webhookSecret);
      return expected === params.signature;
    } catch {
      return false;
    }
  }
}
