/**
 * Mobile API Client — wraps the shared TriajjiApiClient with MMKV token storage.
 */

import { TriajjiApiClient } from '@triaji/shared/api';
import { storage } from './storage';

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.triajji.com';

export const api = new TriajjiApiClient(API_BASE_URL, () => {
  return storage.getString('patient-token') ?? null;
});
