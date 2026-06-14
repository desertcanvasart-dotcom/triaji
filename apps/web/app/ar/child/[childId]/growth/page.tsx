import GrowthDashboard from '@/components/paediatric/GrowthDashboard';

interface Props {
  params: Promise<{ childId: string }>;
}

export default async function ArabicGrowthPage({ params }: Props) {
  const { childId } = await params;
  return <GrowthDashboard childId={childId} lang="ar" />;
}
