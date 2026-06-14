'use client';

import { useState, useEffect, useRef } from 'react';

interface PDFPreviewModalProps {
  open: boolean;
  onClose: () => void;
  onSend: () => Promise<void>;
  pdfBytes: Uint8Array | null;
  sending: boolean;
}

export default function PDFPreviewModal({
  open,
  onClose,
  onSend,
  pdfBytes,
  sending,
}: PDFPreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (pdfBytes) {
      const blob = new Blob([new Uint8Array(pdfBytes) as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      blobUrlRef.current = url;
    } else {
      setBlobUrl(null);
    }

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [pdfBytes]);

  useEffect(() => {
    if (!open && blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
      setBlobUrl(null);
    }
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSend = async () => {
    await onSend();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      dir="rtl"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="معاينة المستند"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-[Cairo] font-bold text-lg text-gray-800">معاينة المستند</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-4">
          {!pdfBytes ? (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <div className="text-center space-y-3">
                <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="font-[Cairo] text-gray-500 text-sm">جاري تجهيز المستند...</p>
              </div>
            </div>
          ) : blobUrl ? (
            <iframe
              src={blobUrl}
              className="w-full h-full min-h-[400px] rounded-lg border border-gray-200"
              title="معاينة المستند"
            />
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="flex-1 rounded-lg border-2 border-teal-600 text-teal-600 py-2.5 font-[Cairo] font-semibold text-sm hover:bg-teal-50 transition-colors disabled:opacity-50"
          >
            تعديل
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !pdfBytes}
            className="flex-1 rounded-lg bg-teal-600 text-white py-2.5 font-[Cairo] font-semibold text-sm hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            {sending ? 'جاري الإرسال...' : 'إرسال للمريض'}
          </button>
        </div>
      </div>
    </div>
  );
}
