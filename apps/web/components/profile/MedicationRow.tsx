'use client';

export interface MedicationEntry {
  drug_name_ar: string;
  dose: string;
  frequency_ar: string;
  for_condition_ar: string;
}

interface MedicationRowProps {
  medication: MedicationEntry;
  onChange: (updated: MedicationEntry) => void;
  onRemove: () => void;
}

const FREQUENCY_OPTIONS = [
  { value: '', label: 'اختر التكرار' },
  { value: 'مرة يومياً', label: 'مرة يومياً' },
  { value: 'مرتين يومياً', label: 'مرتين يومياً' },
  { value: '3 مرات يومياً', label: '3 مرات يومياً' },
  { value: 'عند اللزوم', label: 'عند اللزوم' },
  { value: 'أسبوعياً', label: 'أسبوعياً' },
] as const;

export default function MedicationRow({
  medication,
  onChange,
  onRemove,
}: MedicationRowProps) {
  function update(field: keyof MedicationEntry, value: string) {
    onChange({ ...medication, [field]: value });
  }

  const inputBase =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-start sm:gap-3">
      {/* Drug name — required */}
      <div className="flex-1 min-w-0">
        <label className="mb-1 block text-xs font-medium text-gray-500">
          اسم الدواء <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={medication.drug_name_ar}
          onChange={(e) => update('drug_name_ar', e.target.value)}
          placeholder="مثال: ميتفورمين"
          className={inputBase}
        />
      </div>

      {/* Dose */}
      <div className="flex-1 min-w-0 sm:max-w-[8rem]">
        <label className="mb-1 block text-xs font-medium text-gray-500">
          الجرعة
        </label>
        <input
          type="text"
          value={medication.dose}
          onChange={(e) => update('dose', e.target.value)}
          placeholder="500 ملغ"
          className={inputBase}
        />
      </div>

      {/* Frequency dropdown */}
      <div className="flex-1 min-w-0 sm:max-w-[10rem]">
        <label className="mb-1 block text-xs font-medium text-gray-500">
          التكرار
        </label>
        <select
          value={medication.frequency_ar}
          onChange={(e) => update('frequency_ar', e.target.value)}
          className={`${inputBase} appearance-none`}
        >
          {FREQUENCY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Condition */}
      <div className="flex-1 min-w-0">
        <label className="mb-1 block text-xs font-medium text-gray-500">
          لعلاج
        </label>
        <input
          type="text"
          value={medication.for_condition_ar}
          onChange={(e) => update('for_condition_ar', e.target.value)}
          placeholder="مثال: سكري"
          className={inputBase}
        />
      </div>

      {/* Delete button */}
      <div className="flex items-end sm:pt-5">
        <button
          type="button"
          onClick={onRemove}
          aria-label="حذف الدواء"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 active:bg-red-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path
              fillRule="evenodd"
              d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
