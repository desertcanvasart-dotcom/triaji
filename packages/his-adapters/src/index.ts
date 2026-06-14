// ─── Core Interface + Types ─────────────────────────────────────────────────
export type {
  HisAdapter,
  HisVendor,
  HisConnectionResult,
  HisDoctor,
  HisSlot,
  HisBookingRequest,
  HisBookingResult,
  HisCancelResult,
} from './interface';

export type { SyncResult, SyncError } from './types';

// ─── Factory ────────────────────────────────────────────────────────────────
export { getAdapter } from './factory';
export type { HisAdapterConfig } from './factory';

// ─── Adapters ───────────────────────────────────────────────────────────────
export { ShifaAdapter } from './adapters/shifa';
export { GenericRestAdapter } from './adapters/generic';
export { MockHisAdapter } from './adapters/mock';
export { NeuronAdapter } from './adapters/neuron';
