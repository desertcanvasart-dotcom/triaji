'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function EmergencyPanel() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[#FEF2F2] text-[#DC2626] border-[1.5px] border-[#DC2626] font-bold text-[15px] rounded-lg px-4 py-2.5 transition-colors hover:bg-[#FEE2E2]"
      >
        {isOpen ? '✕ إغلاق' : '🚨 حالة طارئة؟ اضغط هنا'}
      </button>

      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: isOpen ? '400px' : '0px' }}
      >
        <div className="mt-3 bg-[#FEF2F2] border-[1.5px] border-[#DC2626] rounded-xl p-6 text-center">
          <p className="text-[#DC2626] font-bold text-lg mb-4">اتصل بالإسعاف فوراً</p>

          <a
            href="tel:123"
            className="block text-[#DC2626] font-bold text-5xl mb-4 hover:opacity-80 transition-opacity"
          >
            📞 123
          </a>

          <div className="border-t border-[#FECACA] my-4" />

          <p className="text-[#4A5568] text-sm mb-3">
            أو ابدأ التقييم الطارئ فوراً — أسئلة بسيطة في دقيقة
          </p>

          <Link
            href="/ar/chat?mode=emergency"
            className="block w-full bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-base rounded-lg py-3 transition-colors text-center"
          >
            ابدأ التقييم الطارئ
          </Link>

          <p className="text-[#9CA3AF] text-[13px] mt-3">
            سيطرح عليك المساعد 2-3 أسئلة فقط لتحديد الخطوة الفورية
          </p>
        </div>
      </div>
    </div>
  );
}
