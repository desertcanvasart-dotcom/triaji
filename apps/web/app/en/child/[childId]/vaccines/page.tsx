import VaccineTracker from '@/components/paediatric/VaccineTracker';

interface Props {
  params: Promise<{ childId: string }>;
}

export default async function EnglishVaccinesPage({ params }: Props) {
  const { childId } = await params;
  return <VaccineTracker childId={childId} lang="en" />;
}
