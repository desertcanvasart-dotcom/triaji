/**
 * Mobile API Client — wraps the shared DoctorTrioApiClient with MMKV token storage.
 */

import { DoctorTrioApiClient } from '@triaji/shared/api';
import { storage } from './storage';

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.doctortrio.online';

export const api = new DoctorTrioApiClient(API_BASE_URL, () => {
  return storage.getString('patient-token') ?? null;
});
