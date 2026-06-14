/**
 * Lab Chain Adapter Interface
 *
 * Unified contract for integrating with Egyptian lab chain APIs:
 * Al-Borg, Al-Mokhtabar, Alfa Lab.
 */

// ─── Request / Response Types ─────────────────────────────────────────────────

export interface LabChainPatient {
  name: string;
  nameAr?: string;
  phone: string;
  nationalId?: string;
  dateOfBirth?: string; // ISO date
  gender?: 'male' | 'female';
  email?: string;
}

export interface LabChainTest {
  code: string;          // Internal Triaji test code
  chainCode?: string;    // Mapped code for the specific chain
  name: string;
  nameAr?: string;
}

export interface LabChainOrder {
  tenantId: string;
  patientId: string;
  patient: LabChainPatient;
  tests: LabChainTest[];
  branchId?: string;
  homeCollection?: boolean;
  address?: string;
  notes?: string;
  preferredDate?: string;  // ISO date
  preferredTime?: string;  // HH:mm
  insurancePolicyNumber?: string;
}

export interface LabChainOrderResult {
  success: boolean;
  orderId?: string;        // Chain's order reference
  estimatedDate?: string;  // ISO date
  totalPrice?: number;
  currency?: string;
  error?: string;
}

export interface LabChainSlot {
  slotId: string;
  branchId: string;
  branchName: string;
  branchNameAr?: string;
  date: string;            // ISO date
  startTime: string;       // HH:mm
  endTime: string;         // HH:mm
  available: boolean;
  homeCollection?: boolean;
}

export interface LabChainBookingResult {
  success: boolean;
  bookingId?: string;
  slotId?: string;
  confirmationCode?: string;
  date?: string;
  time?: string;
  branchName?: string;
  error?: string;
}

export interface LabChainTestResult {
  testCode: string;
  testName: string;
  testNameAr?: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  abnormal?: boolean;
  notes?: string;
}

export interface LabChainResult {
  orderId: string;
  status: 'pending' | 'partial' | 'completed';
  completedAt?: string;    // ISO timestamp
  results: LabChainTestResult[];
  pdfUrl?: string;
}

export interface LabChainPaymentResult {
  success: boolean;
  paymentId?: string;
  paymentUrl?: string;     // Redirect URL for online payment
  referenceCode?: string;  // For kiosk / ATM payment
  amount?: number;
  currency?: string;
  expiresAt?: string;      // ISO timestamp
  error?: string;
}

// ─── Adapter Interface ────────────────────────────────────────────────────────

export interface LabChainAdapter {
  /** Check if required environment variables are present */
  isConfigured(): boolean;

  /** Submit a lab order to the chain */
  submitOrder(order: LabChainOrder): Promise<LabChainOrderResult>;

  /** Get available appointment slots for given tests at a location */
  getAvailableSlots(params: {
    testCodes: string[];
    branchId?: string;
    latitude?: number;
    longitude?: number;
    date?: string;         // ISO date
  }): Promise<LabChainSlot[]>;

  /** Book an appointment slot */
  bookAppointment(params: {
    slotId: string;
    patient: LabChainPatient;
    testCodes: string[];
    orderId?: string;
  }): Promise<LabChainBookingResult>;

  /** Fetch results for an order — returns null if not yet available */
  getResults(orderId: string): Promise<LabChainResult | null>;

  /** Initiate payment for an order */
  initiatePayment(params: {
    orderId: string;
    amount: number;
    currency?: string;
    patientPhone: string;
    returnUrl?: string;
  }): Promise<LabChainPaymentResult>;

  /** Verify webhook signature from the chain */
  verifyWebhook(params: {
    payload: string;
    signature: string;
    timestamp?: string;
  }): boolean;
}
