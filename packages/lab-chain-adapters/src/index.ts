/**
 * @triaji/lab-chain-adapters
 *
 * Unified adapter layer for Egyptian lab chain integrations:
 * Al-Borg, Al-Mokhtabar, Alfa Lab.
 */

// ─── Interface & Types ──────────────────────────────────────────────────────
export type {
  LabChainAdapter,
  LabChainOrder,
  LabChainTest,
  LabChainOrderResult,
  LabChainSlot,
  LabChainPatient,
  LabChainBookingResult,
  LabChainResult,
  LabChainTestResult,
  LabChainPaymentResult,
} from './interface';

// ─── Factory ────────────────────────────────────────────────────────────────
export { getLabChainAdapter, isChainApiAvailable } from './factory';
export type { LabChainCode } from './factory';

// ─── Adapters (for direct usage if needed) ──────────────────────────────────
export { AlBorgAdapter } from './adapters/alborg';
export { AlMokhtabarAdapter } from './adapters/almokhtabar';
export { AlfaAdapter } from './adapters/alfa';
