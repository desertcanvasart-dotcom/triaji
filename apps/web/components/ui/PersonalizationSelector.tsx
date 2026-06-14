'use client';

import { useState } from 'react';

type TriageFor = 'self' | 'child' | 'elderly';

interface PersonalizationSelectorProps {
  onChange: (value: TriageFor) => void;
}

const OPTIONS: { value: TriageFor; label: string }[] = [
  { value: 'self', label: 'أنا' },
  { value: 'child', label: 'طفل' },
  { value: 'elderly', label: 'كبير في السن' },
];

export default function PersonalizationSelector({ onChange }: PersonalizationSelectorProps) {
  const [selected, setSelected] = useState<TriageFor>('self');

  function handleSelect(value: TriageFor) {
    setSelected(value);
    onChange(value);
  }

  return (
    <div className="flex items-center gap-2 justify-center">
      <span className="text-sm text-[#6B7280]">الحالة لـ:</span>
      <div className="flex gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${
              selected === opt.value
                ? 'bg-teal-500 text-white'
                : 'bg-white text-[#6B7280] border border-gray-300 hover:border-teal-400'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
