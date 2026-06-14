'use client';

interface NumberStepperProps {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  label: string;
}

export default function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  unit,
  label,
}: NumberStepperProps) {
  const current = value ?? min;

  function decrement() {
    const next = current - step;
    if (next >= min) onChange(next);
  }

  function increment() {
    const next = current + step;
    if (next <= max) onChange(next);
  }

  const isMinReached = current <= min;
  const isMaxReached = current >= max;

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-sm font-medium text-gray-600">{label}</span>

      <div className="flex items-center gap-4" dir="rtl">
        {/* Minus button on the right in RTL */}
        <button
          type="button"
          onClick={decrement}
          disabled={isMinReached}
          aria-label="إنقاص"
          className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-teal-700 text-teal-700 text-2xl font-bold transition-colors hover:bg-teal-50 active:bg-teal-100 disabled:border-gray-300 disabled:text-gray-300 disabled:cursor-not-allowed"
        >
          −
        </button>

        {/* Number display */}
        <div className="flex flex-col items-center min-w-[4rem]">
          <span className="text-4xl font-bold text-gray-900 tabular-nums" dir="ltr">
            {value !== null ? current : '—'}
          </span>
          {unit && (
            <span className="text-xs text-gray-500 mt-0.5">{unit}</span>
          )}
        </div>

        {/* Plus button on the left in RTL */}
        <button
          type="button"
          onClick={increment}
          disabled={isMaxReached}
          aria-label="زيادة"
          className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-teal-700 text-teal-700 text-2xl font-bold transition-colors hover:bg-teal-50 active:bg-teal-100 disabled:border-gray-300 disabled:text-gray-300 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>
    </div>
  );
}
