import { checkEmergency } from './emergency';
import type { RulesInput, EmergencyWithICUResult, IcuBedInfo } from './types';

/**
 * Async wrapper around checkEmergency that adds nearby ICU availability.
 * The synchronous checkEmergency() is UNCHANGED.
 * This function queries an external source for ICU beds when emergency fires.
 */
export async function checkEmergencyWithICU(
  input: RulesInput,
  patientLocation?: { lat: number; lng: number },
  findIcuBedsFn?: (lat: number, lng: number, unitType?: string, radiusKm?: number) => Promise<IcuBedInfo[]>
): Promise<EmergencyWithICUResult> {
  // Run the original synchronous check — UNCHANGED
  const baseResult = checkEmergency(input);

  // If no emergency or no location, return base result
  if (!baseResult.triggered || !patientLocation || !findIcuBedsFn) {
    return baseResult;
  }

  try {
    // Query nearby ICU availability (non-blocking)
    const nearbyBeds = await findIcuBedsFn(
      patientLocation.lat,
      patientLocation.lng,
      undefined, // all unit types
      30 // 30km radius
    );

    return {
      ...baseResult,
      nearbyIcuBeds: nearbyBeds.slice(0, 3), // Top 3
    };
  } catch {
    // If ICU query fails, still return the emergency — never block emergency detection
    return baseResult;
  }
}
