'use client';

import { useState } from 'react';

const COPY_TEXT = `ملخص ترياچي للطبيب:
الأعراض: صداع شديد + حمى من الصبح
درجة الخطورة: متوسطة
التوجيه: زيارة طبيب باطنة خلال 24 ساعة`;

export default function SampleOutcomeCopy() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(COPY_TEXT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = COPY_TEXT;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="w-full border border-gray-300 text-[#6B7280] font-bold text-sm rounded-lg py-2.5 px-4 hover:bg-gray-50 transition-colors"
    >
      {copied ? 'تم النسخ ✓' : '📋 نسخ الملخص للطبيب'}
    </button>
  );
}
