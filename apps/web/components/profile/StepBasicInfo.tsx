'use client';

import { useState, useMemo } from 'react';
import NumberStepper from './NumberStepper';
import SelectionChip from './SelectionChip';

/* ─── Governorate data grouped by region ─── */
const GOVERNORATE_REGIONS = [
  {
    region: 'القاهرة الكبرى',
    items: [
      { id: 'cairo', name: 'القاهرة' },
      { id: 'giza', name: 'الجيزة' },
      { id: 'qalyubia', name: 'القليوبية' },
    ],
  },
  {
    region: 'الدلتا',
    items: [
      { id: 'alexandria', name: 'الإسكندرية' },
      { id: 'beheira', name: 'البحيرة' },
      { id: 'kafr_el_sheikh', name: 'كفر الشيخ' },
      { id: 'gharbia', name: 'الغربية' },
      { id: 'dakahlia', name: 'الدقهلية' },
      { id: 'damietta', name: 'دمياط' },
      { id: 'monufia', name: 'المنوفية' },
      { id: 'sharqia', name: 'الشرقية' },
    ],
  },
  {
    region: 'قناة السويس',
    items: [
      { id: 'port_said', name: 'بورسعيد' },
      { id: 'ismailia', name: 'الإسماعيلية' },
      { id: 'suez', name: 'السويس' },
    ],
  },
  {
    region: 'صعيد مصر',
    items: [
      { id: 'luxor', name: 'الأقصر' },
      { id: 'aswan', name: 'أسوان' },
      { id: 'sohag', name: 'سوهاج' },
      { id: 'qena', name: 'قنا' },
      { id: 'asyut', name: 'أسيوط' },
      { id: 'minya', name: 'المنيا' },
      { id: 'beni_suef', name: 'بني سويف' },
      { id: 'fayoum', name: 'الفيوم' },
    ],
  },
  {
    region: 'سيناء والحدود',
    items: [
      { id: 'north_sinai', name: 'شمال سيناء' },
      { id: 'south_sinai', name: 'جنوب سيناء' },
      { id: 'matrouh', name: 'مطروح' },
      { id: 'red_sea', name: 'البحر الأحمر' },
      { id: 'new_valley', name: 'الوادي الجديد' },
    ],
  },
] as const;

/* ─── All governorates flat for search ─── */
const ALL_GOVERNORATES = GOVERNORATE_REGIONS.flatMap((r) =>
  r.items.map((g) => ({ ...g, region: r.region }))
);

/* ─── Types ─── */
interface StepBasicInfoData {
  age: number | null;
  biological_sex: 'male' | 'female' | null;
  governorate_id: string | null;
}

interface StepBasicInfoProps {
  data: StepBasicInfoData;
  onChange: (data: StepBasicInfoData) => void;
}

export default function StepBasicInfo({ data, onChange }: StepBasicInfoProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  /* Filtered governorates based on search */
  const filteredRegions = useMemo(() => {
    if (!searchQuery.trim()) return GOVERNORATE_REGIONS;

    const q = searchQuery.trim();
    return GOVERNORATE_REGIONS.map((region) => ({
      ...region,
      items: region.items.filter((g) => g.name.includes(q)),
    })).filter((region) => region.items.length > 0);
  }, [searchQuery]);

  /* Get selected governorate name */
  const selectedGovName = useMemo(() => {
    if (!data.governorate_id) return '';
    const found = ALL_GOVERNORATES.find((g) => g.id === data.governorate_id);
    return found?.name ?? '';
  }, [data.governorate_id]);

  function handleGovSelect(id: string) {
    onChange({ ...data, governorate_id: id });
    setIsDropdownOpen(false);
    setSearchQuery('');
  }

  return (
    <div className="flex flex-col gap-8" dir="rtl">
      {/* ── Age ── */}
      <section className="flex flex-col items-center gap-2">
        <NumberStepper
          label="كم عمرك؟"
          value={data.age}
          onChange={(age) => onChange({ ...data, age })}
          min={1}
          max={120}
          step={1}
        />
      </section>

      {/* ── Biological Sex ── */}
      <section className="flex flex-col items-center gap-3">
        <span className="text-sm font-medium text-gray-600">الجنس البيولوجي</span>
        <div className="flex gap-3">
          <SelectionChip
            label="ذكر"
            icon="👨"
            selected={data.biological_sex === 'male'}
            onToggle={() =>
              onChange({
                ...data,
                biological_sex: data.biological_sex === 'male' ? null : 'male',
              })
            }
          />
          <SelectionChip
            label="أنثى"
            icon="👩"
            selected={data.biological_sex === 'female'}
            onToggle={() =>
              onChange({
                ...data,
                biological_sex: data.biological_sex === 'female' ? null : 'female',
              })
            }
          />
        </div>
        <p className="text-xs text-gray-400">للتقييم الطبي فقط</p>
      </section>

      {/* ── Governorate ── */}
      <section className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-600">محافظتك</span>

        <div className="relative">
          {/* Trigger / search input */}
          <div
            className={`flex items-center gap-2 rounded-xl border-2 bg-white px-4 py-3 transition-colors ${
              isDropdownOpen ? 'border-teal-700' : 'border-gray-200'
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 shrink-0 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
              />
            </svg>

            <input
              type="text"
              className="w-full bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
              placeholder={selectedGovName || 'ابحث عن محافظتك…'}
              value={isDropdownOpen ? searchQuery : selectedGovName}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!isDropdownOpen) setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
            />

            {data.governorate_id && !isDropdownOpen && (
              <button
                type="button"
                onClick={() => {
                  onChange({ ...data, governorate_id: null });
                  setSearchQuery('');
                }}
                className="shrink-0 text-gray-400 hover:text-gray-600"
                aria-label="مسح الاختيار"
              >
                ✕
              </button>
            )}
          </div>

          {/* Dropdown */}
          {isDropdownOpen && (
            <>
              {/* Backdrop to close dropdown */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => {
                  setIsDropdownOpen(false);
                  setSearchQuery('');
                }}
              />

              <div className="absolute top-full z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                {filteredRegions.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-400">
                    لا توجد نتائج
                  </div>
                ) : (
                  filteredRegions.map((region) => (
                    <div key={region.region}>
                      <div className="sticky top-0 bg-gray-50 px-4 py-1.5 text-xs font-semibold text-teal-700">
                        {region.region}
                      </div>
                      {region.items.map((gov) => (
                        <button
                          key={gov.id}
                          type="button"
                          onClick={() => handleGovSelect(gov.id)}
                          className={`w-full px-6 py-2.5 text-start text-sm transition-colors hover:bg-teal-50 ${
                            data.governorate_id === gov.id
                              ? 'bg-teal-50 font-semibold text-teal-700'
                              : 'text-gray-700'
                          }`}
                        >
                          {gov.name}
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
