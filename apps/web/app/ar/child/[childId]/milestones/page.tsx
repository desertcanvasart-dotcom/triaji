import MilestoneTracker from '@/components/paediatric/MilestoneTracker';

interface Props {
  params: Promise<{ childId: string }>;
}

export default async function ArabicMilestonesPage({ params }: Props) {
  const { childId } = await params;
  return <MilestoneTracker childId={childId} lang="ar" />;
}
