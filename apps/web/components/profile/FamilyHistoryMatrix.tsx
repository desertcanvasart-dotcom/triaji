'use client';

import { useState } from 'react';

interface Condition {
  code: string;
  name_ar: string;
}

interface Relation {
  code: string;
  name_ar: string;
}

type FamilyHistoryValue = Record<string, string[]>;

interface FamilyHistoryMatrixProps {
  conditions: Condition[];
  relations: Relation[];
  value: FamilyHistoryValue;
  onChange: (value: FamilyHistoryValue) => void;
}

function isChecked(
  value: FamilyHistoryValue,
  conditionCode: string,
  relationCode: string
): boolean {
  return value[conditionCode]?.includes(relationCode) ?? false;
}

function toggleRelation(
  value: FamilyHistoryValue,
  conditionCode: string,
  relationCode: string
): FamilyHistoryValue {
  const current = value[conditionCode] ?? [];
  const next = current.includes(relationCode)
    ? current.filter((r) => r !== relationCode)
    : [...current, relationCode];

  const updated = { ...value };
  if (next.length === 0) {
    delete updated[conditionCode];
  } else {
    updated[conditionCode] = next;
  }
  return updated;
}

/* ── Desktop Table ────────────────────────────────────────────── */

function DesktopTable({
  conditions,
  relations,
  value,
  onChange,
}: FamilyHistoryMatrixProps) {
  return (
    <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="sticky start-0 z-10 bg-gray-50 px-4 py-3 text-start text-xs font-semibold text-gray-500 min-w-[10rem]">
              الحالة المرضية
            </th>
            {relations.map((rel) => (
              <th
                key={rel.code}
                className="px-3 py-3 text-center text-xs font-semibold text-gray-500 min-w-[5rem]"
              >
                {rel.name_ar}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {conditions.map((cond, idx) => (
            <tr
              key={cond.code}
              className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
            >
              <td className="sticky start-0 z-10 px-4 py-3 font-medium text-gray-800 bg-inherit">
                {cond.name_ar}
              </td>
              {relations.map((rel) => (
                <td key={rel.code} className="px-3 py-3 text-center">
                  <label className="inline-flex cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChecked(value, cond.code, rel.code)}
                      onChange={() =>
                        onChange(toggleRelation(value, cond.code, rel.code))
                      }
                      className="h-5 w-5 rounded border-gray-300 text-teal-700 focus:ring-teal-700 focus:ring-offset-0 cursor-pointer"
                    />
                  </label>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Mobile Accordion ─────────────────────────────────────────── */

function MobileAccordion({
  conditions,
  relations,
  value,
  onChange,
}: FamilyHistoryMatrixProps) {
  const [openCode, setOpenCode] = useState<string | null>(null);

  function toggle(code: string) {
    setOpenCode((prev) => (prev === code ? null : code));
  }

  return (
    <div className="flex flex-col gap-2 md:hidden">
      {conditions.map((cond) => {
        const isOpen = openCode === cond.code;
        const selectedCount = value[cond.code]?.length ?? 0;

        return (
          <div
            key={cond.code}
            className="rounded-xl border border-gray-200 overflow-hidden"
          >
            {/* Accordion header */}
            <button
              type="button"
              onClick={() => toggle(cond.code)}
              className="flex w-full items-center justify-between px-4 py-3 text-start bg-white hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-800 text-sm">
                {cond.name_ar}
              </span>
              <span className="flex items-center gap-2">
                {selectedCount > 0 && (
                  <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-teal-700 px-1.5 text-[10px] font-bold text-white">
                    {selectedCount}
                  </span>
                )}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                >
                  <path
                    fillRule="evenodd"
                    d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            </button>

            {/* Accordion body */}
            {isOpen && (
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 flex flex-col gap-3">
                {relations.map((rel) => (
                  <label
                    key={rel.code}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked(value, cond.code, rel.code)}
                      onChange={() =>
                        onChange(toggleRelation(value, cond.code, rel.code))
                      }
                      className="h-5 w-5 rounded border-gray-300 text-teal-700 focus:ring-teal-700 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-sm text-gray-700">{rel.name_ar}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */

export default function FamilyHistoryMatrix(props: FamilyHistoryMatrixProps) {
  return (
    <>
      <DesktopTable {...props} />
      <MobileAccordion {...props} />
    </>
  );
}
