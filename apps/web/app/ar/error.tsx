'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[App] Unhandled page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="text-center max-w-md">
        <p className="text-5xl mb-4">⚠️</p>
        <h2 className="text-xl font-bold text-gray-900 mb-2">حصل خطأ غير متوقع</h2>
        <p className="text-sm text-gray-500 mb-6">
          معلش، حصلت مشكلة. جرّب تاني — ولو المشكلة استمرت تواصل معانا.
        </p>
        <button
          onClick={reset}
          className="bg-teal-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-teal-700 transition-colors"
        >
          حاول تاني
        </button>
      </div>
    </div>
  );
}
