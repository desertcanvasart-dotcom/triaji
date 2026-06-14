'use client';

import { useRef, useState } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface StampSetupProps {
  currentStampUrl: string | null;
  useTextStamp: boolean;
  doctorName: { ar: string; en: string | null };
  specialty: string;
  syndicateNumber: string;
  onUploadStamp: (file: File) => Promise<void>;
  onToggleTextStamp: (useText: boolean) => Promise<void>;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// ─── Component ──────────────────────────────────────────────────────────────

export default function StampSetup({
  currentStampUrl,
  useTextStamp,
  doctorName,
  specialty,
  syndicateNumber,
  onUploadStamp,
  onToggleTextStamp,
}: StampSetupProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(useText: boolean) {
    setToggling(true);
    setError(null);
    try {
      await onToggleTextStamp(useText);
    } catch {
      setError('فشل في تغيير نوع الختم');
    } finally {
      setToggling(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('نوع الملف غير مدعوم. يرجى رفع صورة بصيغة JPEG أو PNG أو WebP');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('حجم الملف كبير جداً. الحد الأقصى ٥ ميجابايت');
      return;
    }

    setUploading(true);
    try {
      await onUploadStamp(file);
    } catch {
      setError('فشل في رفع صورة الختم. حاول مرة تانية');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-[#1A2F4A]">الختم</h3>

      {/* ─── Toggle Switch ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => handleToggle(false)}
          disabled={toggling}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            !useTextStamp
              ? 'bg-teal-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          } disabled:opacity-50`}
        >
          رفع صورة الختم
        </button>
        <button
          type="button"
          onClick={() => handleToggle(true)}
          disabled={toggling}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            useTextStamp
              ? 'bg-teal-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          } disabled:opacity-50`}
        >
          استخدم الختم التلقائي
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 font-medium">{error}</p>
      )}

      {/* ─── Upload Mode ──────────────────────────────────────────────────── */}
      {!useTextStamp && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            صورة واضحة للختم على خلفية بيضاء
          </p>

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              disabled={uploading}
              className="block text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 file:cursor-pointer disabled:opacity-50"
            />
            {uploading && (
              <span className="inline-block w-5 h-5 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
            )}
          </div>

          {currentStampUrl && (
            <div className="border border-gray-300 rounded-lg p-4 bg-white max-w-[300px]">
              <img
                src={currentStampUrl}
                alt="الختم الحالي"
                className="w-full h-auto object-contain"
              />
            </div>
          )}
        </div>
      )}

      {/* ─── Text Stamp Preview ──────────────────────────────────────────── */}
      {useTextStamp && (
        <div className="border-2 border-[#1A2F4A] rounded-lg p-6 bg-white max-w-[320px] text-center space-y-1">
          <p className="text-base font-bold text-[#1A2F4A]">
            د. {doctorName.ar}
          </p>
          {doctorName.en && (
            <p className="text-sm text-[#1A2F4A]" dir="ltr">
              Dr. {doctorName.en}
            </p>
          )}
          <p className="text-sm text-gray-700">{specialty}</p>
          <p className="text-sm text-gray-600">رقم النقابة: {syndicateNumber}</p>
        </div>
      )}
    </div>
  );
}
