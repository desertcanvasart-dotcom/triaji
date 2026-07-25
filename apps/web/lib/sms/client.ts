/**
 * Re-export of the shared SMS gateway client.
 * The implementation moved to `@triaji/shared` so the admin panel can use it too;
 * this shim keeps the existing `@/lib/sms/client` imports working.
 */

export { sendSMS, type SMSResult } from '@triaji/shared/lib/sms/client';
