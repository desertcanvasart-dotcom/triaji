import ResultsUpload from '@/components/lab/ResultsUpload';

export default async function ResultsUploadPage({
  params,
}: {
  params: Promise<{ routingId: string }>;
}) {
  const { routingId } = await params;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4" dir="rtl">
        رفع النتائج
      </h1>
      <ResultsUpload routingId={routingId} />
    </div>
  );
}
