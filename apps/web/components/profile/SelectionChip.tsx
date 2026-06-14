'use client';

interface SelectionChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
  icon?: string;
  disabled?: boolean;
}

export default function SelectionChip({
  label,
  selected,
  onToggle,
  icon,
  disabled = false,
}: SelectionChipProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      disabled={disabled}
      onClick={onToggle}
      className={`
        inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-medium
        transition-all duration-200 ease-in-out select-none
        ${
          selected
            ? 'border-teal-700 bg-teal-700 text-white shadow-sm'
            : 'border-gray-200 bg-gray-100 text-gray-700 hover:border-gray-300 hover:bg-gray-200'
        }
        ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer active:scale-95'
        }
      `}
    >
      {icon && <span className="text-base leading-none">{icon}</span>}
      <span>{label}</span>
    </button>
  );
}
