import { use } from 'react';
import TelehealthClient from '@/components/telehealth/TelehealthClient';

export default function ArabicTelehealthPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
  return <TelehealthClient bookingId={bookingId} lang="ar" />;
}
