export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-sm text-gray-500">جاري التحميل...</p>
      </div>
    </div>
  );
}
