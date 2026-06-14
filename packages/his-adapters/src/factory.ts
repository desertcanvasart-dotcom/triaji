/**
 * HIS Adapter Factory
 * Creates the appropriate adapter based on vendor + config.
 */

import type { HisAdapter, HisVendor } from './interface';
import { ShifaAdapter } from './adapters/shifa';
import { NeuronAdapter } from './adapters/neuron';
import { GenericRestAdapter } from './adapters/generic';
import { MockHisAdapter } from './adapters/mock';

export interface HisAdapterConfig {
  vendor: HisVendor;
  baseUrl: string;
  authType: 'api_key' | 'oauth2' | 'basic';
  credentials: {
    apiKey?: string;
    username?: string;
    password?: string;
    clientId?: string;
    clientSecret?: string;
    tokenUrl?: string;
  };
  tenantId: string;
  /** Field mapping for generic REST adapter */
  fieldMapping?: Record<string, string>;
  timeout?: number;
}

export function getAdapter(config: HisAdapterConfig): HisAdapter {
  switch (config.vendor) {
    case 'shifa':
      return new ShifaAdapter(config);
    case 'generic_rest':
      return new GenericRestAdapter(config);
    case 'mock':
      return new MockHisAdapter(config);
    case 'neuron':
      return new NeuronAdapter(config);
    default: {
      const exhaustive: never = config.vendor;
      throw new Error(`Unknown HIS vendor: ${exhaustive as string}`);
    }
  }
}
