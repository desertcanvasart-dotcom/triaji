/**
 * Shared runtime config.
 *
 * Canonical source for the Triajji web API base URL. Every network call
 * should read API_BASE_URL from here rather than re-deriving
 * `process.env.EXPO_PUBLIC_API_URL ?? '...'` inline — historically two files
 * fell back to http://localhost:3000 while the rest fell back to production,
 * so a device build without EXPO_PUBLIC_API_URL set silently broke drug
 * interaction checks and LiveKit tokens.
 */
export const API_BASE_URL =
  process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.triajji.com';
