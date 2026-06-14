'use client';

interface StepNavigationProps {
  onBack: (() => void) | null;
  onNext: () => void;
  onSkip?: (() => void) | null;
  isFirst: boolean;
  isLast: boolean;
  nextLabel?: string;
}

export default function StepNavigation({
  onBack,
  onNext,
  onSkip,
  isFirst,
  isLast,
  nextLabel,
}: StepNavigationProps) {
  const resolvedNextLabel = nextLabel ?? (isLast ? 'حفظ وابدأ' : 'التالي');

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-sm safe-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3" dir="rtl">
        {/* Back button (right side in RTL) */}
        {!isFirst && onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 rounded-xl border-2 border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50 active:bg-gray-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 rtl:rotate-180"
            >
              <path
                fillRule="evenodd"
                d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
                clipRule="evenodd"
              />
            </svg>
            رجوع
          </button>
        ) : (
          <div />
        )}

        {/* Skip link in center */}
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="text-sm font-medium text-gray-400 transition-colors hover:text-gray-600 underline underline-offset-2"
          >
            تخطي
          </button>
        )}

        {/* Next / Save button (left side in RTL) */}
        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-1 rounded-xl bg-teal-700 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 active:bg-teal-900"
        >
          {resolvedNextLabel}
          {!isLast && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 rtl:rotate-180"
            >
              <path
                fillRule="evenodd"
                d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
