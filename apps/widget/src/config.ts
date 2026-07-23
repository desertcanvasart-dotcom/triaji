// ─── Types ────────────────────────────────────────────────────────────────────

export interface TenantConfig {
  tenantSlug: string;
  tenantId: string;
  nameAr: string;
  logoUrl: string | null;
  primaryColor: string; // hex without #, e.g. "0D7A7A"
  welcomeMessageAr: string;
  bookingMode: 'native' | 'his_integration' | 'hybrid';
}

export interface UserConfig {
  tenantSlug: string;
  primaryColor?: string; // Override from window.DoctorTrioConfig
  position?: 'bottom-right' | 'bottom-left';
  buttonLabel?: string; // Override Arabic button label
  apiUrl?: string; // Override API base URL (for development)
}

export interface WidgetMessage {
  id: string;
  role: 'ai' | 'patient';
  content: string;
  timestamp: number;
}

export interface MatchedDoctor {
  id: string;
  nameAr: string;
  titleAr: string;
  specialtyNameAr: string;
  governorateNameAr: string;
  clinicAddressAr: string | null;
  consultationFeeEgp: number | null;
  ratingAvg: number;
  ratingCount: number;
  languages: string[];
  photoUrl: string | null;
  distanceKm: number;
}

export interface DoctorRecommendation {
  doctors: MatchedDoctor[];
  specialtyNameAr: string;
  urgencyLevel: 'routine' | 'urgent' | 'emergency';
  summaryAr: string;
}

export interface AvailableSlot {
  id: string;
  slotDatetime: string;
  durationMinutes: number;
  dayAr: string;
  dateAr: string;
  timeAr: string;
}

export interface BookingResult {
  booking: {
    id: string;
    status: string;
  };
  doctor: {
    nameAr: string;
    specialtyNameAr: string;
  };
  slot: {
    dateAr: string;
    timeAr: string;
    dayAr: string;
  };
  confirmationMessage: string;
}

export type WidgetEventType =
  | 'impression'
  | 'button_click'
  | 'session_start'
  | 'session_complete'
  | 'booking_started'
  | 'booking_confirmed';

export type WidgetView =
  | 'collapsed'
  | 'chat'
  | 'doctors'
  | 'slots'
  | 'booking-form'
  | 'confirmed';

// ─── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_PRIMARY_COLOR = '#0D7A7A';
export const DEFAULT_API_URL = 'https://app.doctortrio.online';

// Captured synchronously at script load (IIFE build) — currentScript is null
// once execution leaves the initial script evaluation.
const SCRIPT_ORIGIN: string | null = (() => {
  try {
    const src = (document.currentScript as HTMLScriptElement | null)?.src;
    return src ? new URL(src).origin : null;
  } catch {
    return null;
  }
})();

export function getApiUrl(userConfig: UserConfig): string {
  return userConfig.apiUrl ?? SCRIPT_ORIGIN ?? DEFAULT_API_URL;
}

export function getPrimaryColor(
  tenantConfig: TenantConfig,
  userConfig: UserConfig
): string {
  if (userConfig.primaryColor) {
    return userConfig.primaryColor.startsWith('#')
      ? userConfig.primaryColor
      : `#${userConfig.primaryColor}`;
  }
  return tenantConfig.primaryColor.startsWith('#')
    ? tenantConfig.primaryColor
    : `#${tenantConfig.primaryColor}`;
}
