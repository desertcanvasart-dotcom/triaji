import type { Metadata } from 'next';
import QueueDisplay from '@/components/display/QueueDisplay';

export const metadata: Metadata = {
  title: 'Waiting room',
  robots: { index: false, follow: false },
};

export default async function QueueDisplayEN({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <QueueDisplay token={token} lang="en" />;
}
