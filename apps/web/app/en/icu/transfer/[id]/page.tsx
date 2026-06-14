import IcuTransferTracker from '@/components/icu/IcuTransferTracker';

export default async function TransferTrackerEN({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <IcuTransferTracker lang="en" transferId={id} />;
}
