/**
 * Lab Chain Adapter Factory
 *
 * Creates the correct adapter instance based on chain code.
 */

import type { LabChainAdapter } from './interface';
import { AlBorgAdapter } from './adapters/alborg';
import { AlMokhtabarAdapter } from './adapters/almokhtabar';
import { AlfaAdapter } from './adapters/alfa';

export type LabChainCode = 'alborg' | 'almokhtabar' | 'alfa';

const adapterCache = new Map<LabChainCode, LabChainAdapter>();

/**
 * Get a lab chain adapter instance for the given chain code.
 * Instances are cached per chain code.
 */
export function getLabChainAdapter(chainCode: LabChainCode): LabChainAdapter {
  const cached = adapterCache.get(chainCode);
  if (cached) return cached;

  let adapter: LabChainAdapter;

  switch (chainCode) {
    case 'alborg':
      adapter = new AlBorgAdapter();
      break;
    case 'almokhtabar':
      adapter = new AlMokhtabarAdapter();
      break;
    case 'alfa':
      adapter = new AlfaAdapter();
      break;
    default:
      throw new Error(`Unknown lab chain code: ${chainCode}`);
  }

  adapterCache.set(chainCode, adapter);
  return adapter;
}

/**
 * Check whether a chain's API is configured and reachable.
 */
export function isChainApiAvailable(chainCode: LabChainCode): boolean {
  try {
    const adapter = getLabChainAdapter(chainCode);
    return adapter.isConfigured();
  } catch {
    return false;
  }
}
