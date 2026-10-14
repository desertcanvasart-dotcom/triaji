/**
 * Re-export of the shared clinic-queue WhatsApp notifications.
 * The implementation moved to `@triaji/shared` so the doctor portal's work-day
 * screen can call patients too; this shim keeps `@/lib/clinic/queue-notifications`
 * imports working.
 */

export {
  sendQueueRegisteredNotification,
  sendAlmostNextNotification,
  sendCalledNotification,
} from '@triaji/shared/lib/clinic/queue-notifications';
