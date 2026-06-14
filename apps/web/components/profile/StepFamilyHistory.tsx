'use client';

import { useState } from 'react';
import FamilyHistoryMatrix from './FamilyHistoryMatrix';

/* ── Types ────────────────────────────────────────────────────── */

export interface FamilyHistoryOption {
  code: string;
  name_ar: string;
}

export interface FamilyHistoryEntry {
  condition_code: string;
  relation: string;
}

export interface FamilyHistoryData {
  family_history: FamilyHistoryEntry[];
}

interface StepFamilyHistoryProps {
  data: FamilyHistoryData;
  onChange: (data: FamilyHistoryData) => void;
  familyHistoryOptions: FamilyHistoryOption[];
}

/* ── Constants ────────────────────────────────────────────────── */

const RELATIONS = [
  { code: 'father', name_ar: 'الأب' },
  { code: 'mother', name_ar: 'الأم' },
  { code: 'sibling', name_ar: 'أخ / أخت' },
] as const;

/* ── Helpers: convert between flat array ↔ matrix record ─────── */

function toMatrixValue(
  entries: FamilyHistoryEntry[]
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const e of entries) {
    if (!result[e.condition_code]) {
      result[e.condition_code] = [];
    }
    if (!result[e.condition_code]!.includes(e.relation)) {
      result[e.condition_code]!.push(e.relation);
    }
  }
  return result;
}

function fromMatrixValue(
  matrix: Record<string, string[]>
): FamilyHistoryEntry[] {
  const entries: FamilyHistoryEntry[] = [];
  for (const [condition_code, relations] of Object.entries(matrix)) {
    for (const relation of relations) {
      entries.push({ condition_code, relation });
    }
  }
  return entries;
}

/* ── Main Component ───────────────────────────────────────────── */

export default function StepFamilyHistory({
  data,
  onChange,
  familyHistoryOptions,
}: StepFamilyHistoryProps) {
  const [noHistory, setNoHistory] = useState(data.family_history.length === 0);

  const matrixValue = toMatrixValue(data.family_history);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h3 className="text-base font-bold text-gray-900">
          هل في أحد من عيلتك عنده أي من الأمراض دي؟
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          (المقصود: الأب، الأم، أو الأخوة)
        </p>
      </div>

      {/* Toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={noHistory}
        onClick={() => {
          const next = !noHistory;
          setNoHistory(next);
          if (next) onChange({ family_history: [] });
        }}
        className={`
          flex items-center gap-3 w-full rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all
          ${
            noHistory
              ? 'border-teal-700 bg-teal-50 text-teal-800'
              : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
          }
        `}
      >
        <span
          className={`
            flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors
            ${noHistory ? 'border-teal-700 bg-teal-700' : 'border-gray-300 bg-white'}
          `}
        >
          {noHistory && (
            <svg
              viewBox="0 0 12 12"
              className="h-3 w-3 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M2.5 6l2.5 2.5 4.5-5" />
            </svg>
          )}
        </span>
        <span>مفيش تاريخ عائلي مرضي معروف</span>
      </button>

      {/* Matrix */}
      {!noHistory && (
        <FamilyHistoryMatrix
          conditions={familyHistoryOptions}
          relations={[...RELATIONS]}
          value={matrixValue}
          onChange={(nextMatrix) => {
            onChange({ family_history: fromMatrixValue(nextMatrix) });
          }}
        />
      )}
    </div>
  );
}
