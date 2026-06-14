import GPConfirmClient from '@/components/care/GPConfirmClient';

export default async function ArabicGPConfirmPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GPConfirmClient gpRequestId={id} lang="ar" />;
}
