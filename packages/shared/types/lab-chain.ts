/**
 * Lab Chain Integration Types
 *
 * Database row types and webhook types for the lab chain
 * integration layer (Al-Borg, Al-Mokhtabar, Alfa Lab).
 */

// ─── Chain Code ─────────────────────────────────────────────────────────────

export type LabChainCode = 'alborg' | 'almokhtabar' | 'alfa';

// ─── Database Row Types ─────────────────────────────────────────────────────

/** lab_chains table */
export interface LabChain {
  id: string;
  chain_code: LabChainCode;
  name: string;
  name_ar: string;
  logo_url?: string;
  website_url?: string;
  api_base_url?: string;
  is_active: boolean;
  supports_home_collection: boolean;
  supports_online_payment: boolean;
  supports_insurance: boolean;
  created_at: string;
  updated_at: string;
}

/** lab_chain_branches table */
export interface LabChainBranch {
  id: string;
  chain_id: string;
  chain_code: LabChainCode;
  external_branch_id?: string;
  name: string;
  name_ar: string;
  governorate: string;
  city?: string;
  address: string;
  address_ar?: string;
  latitude: number;
  longitude: number;
  phone?: string;
  working_hours?: string;       // e.g. "08:00-22:00"
  working_hours_friday?: string; // e.g. "14:00-22:00"
  supports_home_collection: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** lab_chain_test_mappings table */
export interface LabChainTestMapping {
  id: string;
  chain_code: LabChainCode;
  triaji_test_code: string;     // Internal Triajji test code
  chain_test_code: string;      // Mapped code for the chain API
  test_name: string;
  test_name_ar: string;
  price?: number;
  currency?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Webhook Types ──────────────────────────────────────────────────────────

export interface LabChainWebhook {
  id: string;
  chain_code: LabChainCode;
  event_type: 'order.completed' | 'order.partial' | 'result.ready' | 'payment.confirmed' | 'appointment.confirmed' | 'appointment.cancelled';
  external_order_id: string;
  payload: Record<string, unknown>;
  signature: string;
  verified: boolean;
  processed: boolean;
  processed_at?: string;
  error?: string;
  received_at: string;
}

// ─── Sync Log ───────────────────────────────────────────────────────────────

export interface LabChainSyncLog {
  id: string;
  chain_code: LabChainCode;
  tenant_id: string;
  lab_order_id: string;         // Triajji's lab order ID
  external_order_id?: string;   // Chain's order reference
  action: 'submit_order' | 'check_results' | 'book_appointment' | 'initiate_payment' | 'webhook_received';
  status: 'success' | 'error' | 'pending';
  request_payload?: Record<string, unknown>;
  response_payload?: Record<string, unknown>;
  error_message?: string;
  duration_ms?: number;
  created_at: string;
}
