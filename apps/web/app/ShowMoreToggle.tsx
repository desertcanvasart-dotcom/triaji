'use client';

import { useState, type ReactNode } from 'react';

interface Props {
  showMoreLabel: string;
  showLessLabel: string;
  children: ReactNode;
}

export default function ShowMoreToggle({ showMoreLabel, showLessLabel, children }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      {expanded && children}
      <div className="text-center mt-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-teal-600 hover:text-teal-700 font-medium text-sm transition-colors"
        >
          {expanded ? showLessLabel : showMoreLabel}
          <span className="ms-1">{expanded ? '▲' : '▼'}</span>
        </button>
      </div>
    </div>
  );
}
