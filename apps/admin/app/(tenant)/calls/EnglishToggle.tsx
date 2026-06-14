'use client';

import { useState } from 'react';

interface EnglishToggleProps {
  tenantId: string;
  initialEnabled: boolean;
}

export default function EnglishToggle({ tenantId, initialEnabled }: EnglishToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    const newValue = !enabled;
    setSaving(true);

    try {
      const res = await fetch('/api/admin/phone/english-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, enabled: newValue }),
      });

      if (res.ok) {
        setEnabled(newValue);
      } else {
        console.error('Failed to toggle english support');
      }
    } catch (err) {
      console.error('Toggle error:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            English Language Support
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {enabled
              ? 'Bilingual mode active — AI detects Arabic or English from patient speech'
              : 'Arabic only — enable to support English-speaking patients'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={saving}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:opacity-50 ${
            enabled ? 'bg-teal-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
      {enabled && (
        <p className="mt-2 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
          Bilingual support uses Deepgram multi-language detection.
          Calls include a bilingual greeting. Ensure your ElevenLabs English voice
          (ELEVENLABS_VOICE_ID_EN) is configured.
        </p>
      )}
    </div>
  );
}
