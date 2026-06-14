'use client';

interface StepProgressProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
}

export default function StepProgress({
  currentStep,
  totalSteps,
  stepLabels,
}: StepProgressProps) {
  return (
    <div className="w-full px-4 py-3">
      {/* Dots and lines */}
      <div className="flex items-center justify-between" dir="rtl">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNum = i + 1;
          const isCompleted = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;
          const isFuture = stepNum > currentStep;

          return (
            <div key={stepNum} className="flex items-center flex-1 last:flex-none">
              {/* Dot */}
              <div
                className={`
                  relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full
                  text-xs font-bold transition-all duration-300
                  ${
                    isCompleted
                      ? 'bg-teal-700 text-white'
                      : isCurrent
                        ? 'bg-teal-700 text-white ring-4 ring-teal-100'
                        : 'border-2 border-gray-300 bg-white text-gray-400'
                  }
                `}
              >
                {isCompleted ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <span dir="ltr">{stepNum}</span>
                )}
              </div>

              {/* Connecting line (not after last dot) */}
              {stepNum < totalSteps && (
                <div
                  className={`
                    mx-1 h-0.5 flex-1 rounded-full transition-colors duration-300
                    ${isFuture ? 'bg-gray-200' : 'bg-teal-700'}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Current step label */}
      {stepLabels[currentStep - 1] && (
        <p className="mt-2 text-center text-sm font-medium text-teal-700">
          {stepLabels[currentStep - 1]}
        </p>
      )}
    </div>
  );
}
