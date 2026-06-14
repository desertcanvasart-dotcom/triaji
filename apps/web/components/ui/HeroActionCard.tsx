'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import PersonalizationSelector from './PersonalizationSelector';
import EmergencyPanel from './EmergencyPanel';

// TODO: apps/web/app/ar/chat/page.tsx should read ?for= param
//        and pass it to the triage orchestrator as patient.triageFor

export default function HeroActionCard() {
  const router = useRouter();
  const [triageFor, setTriageFor] = useState<'self' | 'child' | 'elderly'>('self');
  const [symptom, setSymptom] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (symptom.trim()) {
      router.push(`/ar/chat?symptom=${encodeURIComponent(symptom.trim())}&for=${triageFor}`);
    } else {
      router.push(`/ar/chat?for=${triageFor}`);
    }
  }

  function handleVoice() {
    router.push(`/ar/chat?input=voice&for=${triageFor}`);
  }

  return (
    <div className="bg-white rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.10)] p-6 w-full max-w-[420px]">
      {/* Card header */}
      <h2 className="text-navy-500 font-bold text-lg text-center mb-5">
        ابدأ دلوقتي — إيه اللي حاسس بيه؟
      </h2>

      {/* Personalization selector */}
      <div className="mb-6">
        <PersonalizationSelector onChange={setTriageFor} />
      </div>

      {/* Voice button */}
      <div className="flex flex-col items-center mb-5">
        <button
          onClick={handleVoice}
          className="w-20 h-20 rounded-full bg-teal-500 hover:bg-teal-600 flex items-center justify-center transition-all duration-150 hover:scale-105 hover:shadow-lg shadow-md"
          aria-label="ابدأ بالصوت"
        >
          <span className="text-white text-[32px]">🎤</span>
        </button>
        <span className="text-[#9CA3AF] text-[13px] mt-2">اضغط وتكلم</span>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-[#D1D5DB]" />
        <span className="text-[#9CA3AF] text-[13px]">أو اكتب</span>
        <div className="flex-1 h-px bg-[#D1D5DB]" />
      </div>

      {/* Text input form */}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={symptom}
          onChange={(e) => setSymptom(e.target.value)}
          placeholder="اكتب العرض... (مثال: صداع شديد من الصبح)"
          className="w-full border-[1.5px] border-[#E5E7EB] rounded-xl py-3.5 px-4 text-base text-right placeholder:text-[#9CA3AF] focus:border-teal-500 focus:shadow-[0_0_0_3px_rgba(13,122,122,0.15)] focus:outline-none transition-all"
          dir="rtl"
        />

        <button
          type="submit"
          className="w-full mt-3 bg-teal-500 hover:bg-[#0A6868] text-white font-bold text-base rounded-xl py-3.5 transition-all duration-150 hover:scale-[1.01]"
        >
          ابدأ التوجيه الطبي
        </button>
      </form>

      {/* Emergency shortcut */}
      <div className="mt-3">
        <EmergencyPanel />
      </div>
    </div>
  );
}
