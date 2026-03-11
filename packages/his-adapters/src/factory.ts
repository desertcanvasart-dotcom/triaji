import type { HisAdapter } from './interface.js';
import { ShifaAdapter } from './adapters/shifa.js';
import { NeuronAdapter } from './adapters/neuron.js';
import { GenericAdapter } from './adapters/generic.js';

export type HisVendor = 'shifa' | 'neuron' | 'generic';

export interface HisAdapterConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}

/**
 * Factory function to create an HIS adapter for the given vendor.
 *
 * @param vendor - The HIS vendor identifier
 * @param _config - Connection configuration for the adapter
 * @returns An HisAdapter instance for the specified vendor
 * @throws Error if the vendor is not supported
 */
export function getAdapter(vendor: HisVendor, _config: HisAdapterConfig): HisAdapter {
  switch (vendor) {
    case 'shifa':
      return new ShifaAdapter();
    case 'neuron':
      return new NeuronAdapter();
    case 'generic':
      return new GenericAdapter();
    default: {
      const exhaustive: never = vendor;
      throw new Error(`Unsupported HIS vendor: ${exhaustive as string}`);
    }
  }
}
