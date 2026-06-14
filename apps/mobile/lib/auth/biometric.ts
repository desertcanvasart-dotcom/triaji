/**
 * Biometric Authentication — Face ID / Touch ID / fingerprint support.
 * Uses expo-local-authentication and MMKV for preference persistence.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import {
  isBiometricEnabled as getEnabled,
  setBiometricEnabled as storeEnabled,
} from '@/lib/storage';
import { s } from '@triaji/shared/i18n';
import type { Lang } from '@triaji/shared/i18n';

/**
 * Check whether biometric hardware is available and enrolled on this device.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;

  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

/**
 * Prompt the user for biometric authentication (Face ID / Touch ID / fingerprint).
 * Returns true if authentication succeeds, false otherwise.
 */
export async function authenticateWithBiometrics(lang: Lang): Promise<boolean> {
  const available = await isBiometricAvailable();
  if (!available) return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: s.biometric.promptMessage[lang],
    cancelLabel: s.common.cancel[lang],
    disableDeviceFallback: false,
  });

  return result.success;
}

/**
 * Persist the user's biometric preference to MMKV.
 */
export function setBiometricEnabled(enabled: boolean): void {
  storeEnabled(enabled);
}

/**
 * Read the user's biometric preference from MMKV.
 */
export function isBiometricEnabled(): boolean {
  return getEnabled();
}
