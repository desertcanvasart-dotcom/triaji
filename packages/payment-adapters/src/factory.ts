/**
 * Payment Adapter Factory
 * Returns the correct adapter instance for a given provider.
 */

import type { PaymentAdapter } from './interface';
import { FawryAdapter } from './adapters/fawry';
import { PaymobAdapter } from './adapters/paymob';
import { VodafoneCashAdapter } from './adapters/vodafone';

export type PaymentProvider = 'fawry' | 'paymob' | 'vodafone_cash';

const adapters: Record<PaymentProvider, () => PaymentAdapter> = {
  fawry: () => new FawryAdapter(),
  paymob: () => new PaymobAdapter(),
  vodafone_cash: () => new VodafoneCashAdapter(),
};

/**
 * Get a payment adapter for the specified provider.
 * Throws if the provider is unknown.
 */
export function getPaymentAdapter(provider: PaymentProvider): PaymentAdapter {
  const factory = adapters[provider];
  if (!factory) {
    throw new Error(`Unknown payment provider: ${provider}`);
  }
  return factory();
}
