/**
 * @triaji/payment-adapters
 * Unified payment gateway abstraction for Egyptian payment providers.
 */

// ─── Interface & Types ────────────────────────────────────────────────────────
export type {
  PaymentAdapter,
  CreatePaymentRequest,
  CreatePaymentResult,
  PaymentVerificationResult,
  RefundResult,
} from './interface';

// ─── Factory ──────────────────────────────────────────────────────────────────
export type { PaymentProvider } from './factory';
export { getPaymentAdapter } from './factory';

// ─── Concrete Adapters (for webhook verification static methods) ──────────────
export { FawryAdapter } from './adapters/fawry';
export { PaymobAdapter } from './adapters/paymob';
export { VodafoneCashAdapter } from './adapters/vodafone';
