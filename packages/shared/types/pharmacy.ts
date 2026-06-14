import type { PrescriptionRoutingStatus, InvoiceStatus, PaymentMethod } from './enums';

// ─── Pharmacy Medication Inventory ──────────────────────────────────────────

export interface PharmacyMedication {
  id: string;
  tenant_id: string;
  drug_name_ar: string;
  drug_name_en: string | null;
  generic_name_en: string | null;
  form_ar: string | null;
  form_en: string | null;
  strength: string | null;
  manufacturer_ar: string | null;
  price_egp: number | null;
  in_stock: boolean;
  stock_quantity: number | null;
  requires_prescription: boolean;
  is_active: boolean;
  sort_order: number;
}

// ─── Platform Medication Catalog ────────────────────────────────────────────

export interface MedicationCatalog {
  id: string;
  drug_name_ar: string;
  drug_name_en: string;
  generic_name_en: string | null;
  category_ar: string | null;
  requires_prescription: boolean;
  sort_order: number;
}

// ─── Prescription Routing ───────────────────────────────────────────────────

export interface StockConfirmationItem {
  prescriptionItemId: string;
  drugNameAr: string;
  inStock: boolean;
  substituteAvailable: boolean;
  substituteNameAr: string | null;
}

export interface PrescriptionRouting {
  id: string;
  health_record_id: string;
  pharmacy_tenant_id: string;
  doctor_id: string;
  doctor_account_id: string | null;
  patient_id: string;
  patient_phone: string;

  status: PrescriptionRoutingStatus;
  routed_at: string | null;
  received_at: string | null;
  ready_at: string | null;
  collected_at: string | null;
  estimated_ready_at: string | null;

  stock_confirmation: StockConfirmationItem[];
  delivery_requested: boolean;
  delivery_address_ar: string | null;
  invoice_id: string | null;

  routing_note_ar: string | null;
  pharmacy_note_ar: string | null;

  created_at: string;
  updated_at: string;
}

// ─── Pharmacy Invoice ───────────────────────────────────────────────────────

export interface PharmacyInvoiceLineItem {
  drugNameAr: string;
  drugNameEn: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
  isSubstitute: boolean;
}

export interface PharmacyInvoice {
  id: string;
  tenant_id: string;
  routing_id: string;
  patient_id: string | null;
  patient_name_ar: string;
  doctor_id: string;
  invoice_date: string;
  invoice_number: string;
  line_items: PharmacyInvoiceLineItem[];
  subtotal_egp: number;
  discount_egp: number;
  insurance_covered: number;
  patient_pays_egp: number;
  status: InvoiceStatus;
  payment_method: PaymentMethod | null;
  paid_at: string | null;
  whatsapp_sent: boolean;
  notes_ar: string | null;
  created_by: string | null;
  created_at: string;
}
