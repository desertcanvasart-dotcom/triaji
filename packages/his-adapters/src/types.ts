/**
 * Shared HIS types — re-export interface types + sync types.
 */

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

// ─── Sync Types ─────────────────────────────────────────────────────────────

export interface SyncResult {
  doctorsSynced: number;
  slotsAdded: number;
  slotsRemoved: number;
  errors: SyncError[];
  syncedAt: string;
}

export interface SyncError {
  hisDoctorId: string;
  message: string;
  code: string;
}
