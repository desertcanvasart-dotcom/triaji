import IcuTransferTracker from '@/components/icu/IcuTransferTracker';

export default async function TransferTrackerAR({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <IcuTransferTracker lang="ar" transferId={id} />;
}
