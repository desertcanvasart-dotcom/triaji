import SchoolHealthView from '@/components/paediatric/SchoolHealthView';

interface Props {
  params: Promise<{ childId: string }>;
}

export default async function EnglishSchoolHealthPage({ params }: Props) {
  const { childId } = await params;
  return <SchoolHealthView childId={childId} lang="en" />;
}
