/**
 * MMKV Storage — fast synchronous key-value storage for React Native.
 * Replaces AsyncStorage with a much faster native implementation.
 */

import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV({
  id: 'triaji-storage',
});

// ─── Auth helpers ────────────────────────────────────────────────────────────

export function getPatientToken(): string | null {
  return storage.getString('patient-token') ?? null;
}

export function setPatientToken(token: string): void {
  storage.set('patient-token', token);
}

export function clearPatientToken(): void {
  storage.delete('patient-token');
}

export function isAuthenticated(): boolean {
  return storage.contains('patient-token');
}

// ─── Language helpers ────────────────────────────────────────────────────────

export function getLang(): 'ar' | 'en' {
  return (storage.getString('lang') as 'ar' | 'en') ?? 'ar';
}

export function setLang(lang: 'ar' | 'en'): void {
  storage.set('lang', lang);
}

// ─── Patient info ────────────────────────────────────────────────────────────

export function getPatientName(): string | null {
  return storage.getString('patient-name') ?? null;
}

export function setPatientName(name: string): void {
  storage.set('patient-name', name);
}

export function getPatientId(): string | null {
  return storage.getString('patient-id') ?? null;
}

export function setPatientId(id: string): void {
  storage.set('patient-id', id);
}

// ─── Doctor helpers ──────────────────────────────────────────────────────────

export function getDoctorToken(): string | null {
  return storage.getString('doctor-token') ?? null;
}

export function setDoctorToken(token: string): void {
  storage.set('doctor-token', token);
}

export function clearDoctorToken(): void {
  storage.delete('doctor-token');
}

export function isDoctorAuthenticated(): boolean {
  return storage.contains('doctor-token');
}

export function getDoctorId(): string | null {
  return storage.getString('doctor-id') ?? null;
}

export function setDoctorId(id: string): void {
  storage.set('doctor-id', id);
}

export function getDoctorName(): string | null {
  return storage.getString('doctor-name') ?? null;
}

export function setDoctorName(name: string): void {
  storage.set('doctor-name', name);
}

export function getDoctorSyndicate(): string | null {
  return storage.getString('doctor-syndicate') ?? null;
}

export function setDoctorSyndicate(syndicate: string): void {
  storage.set('doctor-syndicate', syndicate);
}

export function isDoctorMode(): boolean {
  return storage.getBoolean('doctor-mode') ?? false;
}

export function setDoctorMode(enabled: boolean): void {
  storage.set('doctor-mode', enabled);
}

export function clearDoctorData(): void {
  storage.delete('doctor-token');
  storage.delete('doctor-id');
  storage.delete('doctor-name');
  storage.delete('doctor-syndicate');
  storage.delete('doctor-mode');
}

// ─── Biometric helpers ───────────────────────────────────────────────────────

export function isBiometricEnabled(): boolean {
  return storage.getBoolean('biometric-enabled') ?? false;
}

export function setBiometricEnabled(enabled: boolean): void {
  storage.set('biometric-enabled', enabled);
}
