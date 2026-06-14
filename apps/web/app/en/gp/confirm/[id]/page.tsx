import GPConfirmClient from '@/components/care/GPConfirmClient';

export default async function EnglishGPConfirmPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GPConfirmClient gpRequestId={id} lang="en" />;
}
