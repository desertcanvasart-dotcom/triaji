'use client';

import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SignaturePadProps {
  currentSignatureUrl: string | null;
  onSave: (dataUrl: string) => Promise<void>;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function SignaturePad({ currentSignatureUrl, onSave }: SignaturePadProps) {
  const sigCanvas = useRef<SignatureCanvas | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(!currentSignatureUrl);
  const [error, setError] = useState<string | null>(null);

  function handleClear() {
    sigCanvas.current?.clear();
    setError(null);
  }

  async function handleSave() {
    if (!sigCanvas.current) return;

    if (sigCanvas.current.isEmpty()) {
      setError('من فضلك وقّع أولاً قبل الحفظ');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const dataUrl = sigCanvas.current.toDataURL('image/png');
      await onSave(dataUrl);
      setEditing(false);
    } catch {
      setError('فشل في حفظ التوقيع. حاول مرة تانية');
    } finally {
      setSaving(false);
    }
  }

  // ─── Preview Mode ──────────────────────────────────────────────────────────

  if (!editing && currentSignatureUrl) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-[#1A2F4A]">التوقيع الإلكتروني</h3>

        <div className="border border-gray-300 rounded-lg p-4 bg-white">
          <img
            src={currentSignatureUrl}
            alt="التوقيع الحالي"
            className="max-w-[400px] w-full h-[150px] object-contain mx-auto"
          />
        </div>

        <button
          type="button"
          onClick={() => setEditing(true)}
          className="px-6 py-2.5 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
        >
          تغيير التوقيع
        </button>
      </div>
    );
  }

  // ─── Edit Mode ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-[#1A2F4A]">التوقيع الإلكتروني</h3>

      <div className="border border-gray-300 rounded-lg overflow-hidden bg-white max-w-[400px] w-full">
        <SignatureCanvas
          ref={sigCanvas}
          penColor="#1A2F4A"
          canvasProps={{
            width: 400,
            height: 150,
            className: 'w-full touch-none',
            style: { width: '100%', height: '150px' },
          }}
          backgroundColor="rgb(255, 255, 255)"
        />
      </div>

      <p className="text-sm text-gray-500">
        وقّع هنا باستخدام الإصبع أو الماوس
      </p>

      {error && (
        <p className="text-sm text-red-600 font-medium">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleClear}
          disabled={saving}
          className="px-5 py-2.5 text-sm font-medium text-red-600 bg-white border border-red-300 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
        >
          مسح
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving && (
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          حفظ التوقيع
        </button>

        {currentSignatureUrl && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={saving}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
          >
            إلغاء
          </button>
        )}
      </div>
    </div>
  );
}
