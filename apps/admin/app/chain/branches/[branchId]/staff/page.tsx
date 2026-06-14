import Link from 'next/link';

export default async function BranchStaffPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/chain/branches/${branchId}`}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          {'\u2190'}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Branch Staff</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <div className="w-16 h-16 bg-violet-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">{'\u{1F468}\u{200D}\u{2695}\u{FE0F}'}</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Staff Management</h3>
        <p className="text-gray-500 text-sm">
          Branch staff management is coming soon. Use the Doctors page at chain level
          to manage doctor assignments across branches.
        </p>
      </div>
    </div>
  );
}
