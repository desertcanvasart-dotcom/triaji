'use client';

import { useState, useEffect, useCallback } from 'react';
import { t, type Lang } from '@triaji/shared/i18n/strings';
import { createBrowserClient } from '@triaji/shared/supabase';
import type { IcuTransferRequest, TransferStatus } from '@triaji/shared/types/icu';

// ─── Timeline steps ─────────────────────────────────────────────────────────

interface TimelineStep {
  labelAr: string;
  labelEn: string;
  statusKey: TransferStatus | null;
  timeField: keyof IcuTransferRequest | null;
}

const TIMELINE_STEPS: TimelineStep[] = [
  { labelAr: 'تم إرسال الطلب', labelEn: 'Request sent', statusKey: 'requested', timeField: 'requested_at' },
  { labelAr: 'المستشفى استلمت', labelEn: 'Hospital received', statusKey: 'acknowledged', timeField: 'acknowledged_at' },
  { labelAr: 'تم القبول + تخصيص سرير', labelEn: 'Accepted + bed assigned', statusKey: 'accepted', timeField: 'accepted_at' },
  { labelAr: 'المريض في الطريق', labelEn: 'Patient en route', statusKey: 'en_route', timeField: 'en_route_at' },
  { labelAr: 'المريض وصل', labelEn: 'Patient arrived', statusKey: 'arrived', timeField: 'arrived_at' },
];

const STATUS_ORDER: TransferStatus[] = [
  'requested',
  'acknowledged',
  'accepted',
  'en_route',
  'arrived',
];

function getStepState(
  stepIndex: number,
  transfer: IcuTransferRequest
): 'completed' | 'current' | 'pending' {
  const currentIdx = STATUS_ORDER.indexOf(transfer.status);
  if (currentIdx === -1) return 'pending'; // cancelled/declined
  if (stepIndex < currentIdx) return 'completed';
  if (stepIndex === currentIdx) return 'current';
  return 'pending';
}

function formatTime(dateStr: string | null, lang: Lang): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  lang: Lang;
  transferId: string;
}

export default function IcuTransferTracker({ lang, transferId }: Props) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [transfer, setTransfer] = useState<IcuTransferRequest | null>(null);
  const [unitInfo, setUnitInfo] = useState<{
    unit_name_ar: string;
    unit_name_en: string | null;
    phone_direct: string | null;
  } | null>(null);
  const [hospitalName, setHospitalName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // ── Fetch transfer details ──────────────────────────────────────────
  const fetchTransfer = useCallback(async () => {
    try {
      const res = await fetch(`/api/icu/transfer/${transferId}`, {
        headers: {
          Authorization: `Bearer ${document.cookie.match(/sb-access-token=([^;]+)/)?.[1] || ''}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load transfer');
      }

      const data = await res.json();
      setTransfer(data.transfer);
      setUnitInfo(data.unit);
      setHospitalName(data.hospital_name || '');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [transferId]);

  // ── Realtime subscription ───────────────────────────────────────────
  useEffect(() => {
    fetchTransfer();

    const supabase = createBrowserClient();
    const channel = supabase
      .channel(`transfer:${transferId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'icu_transfer_requests',
          filter: `id=eq.${transferId}`,
        },
        () => {
          fetchTransfer();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [transferId, fetchTransfer]);

  // ── Actions ─────────────────────────────────────────────────────────
  const handleAction = async (action: 'en_route' | 'cancel') => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/icu/transfer/${transferId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${document.cookie.match(/sb-access-token=([^;]+)/)?.[1] || ''}`,
        },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Action failed');
      }

      setShowCancelConfirm(false);
      await fetchTransfer();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Loading state ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div dir={dir} className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">{t('common.loading', lang)}</p>
      </div>
    );
  }

  if (error && !transfer) {
    return (
      <div dir={dir} className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => { setLoading(true); fetchTransfer(); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            {t('common.tryAgain', lang)}
          </button>
        </div>
      </div>
    );
  }

  if (!transfer) return null;

  const isCancelled = transfer.status === 'cancelled';
  const isDeclined = transfer.status === 'declined';
  const isTerminal = isCancelled || isDeclined;

  const displayUnitName =
    lang === 'ar'
      ? unitInfo?.unit_name_ar || ''
      : unitInfo?.unit_name_en || unitInfo?.unit_name_ar || '';

  return (
    <div dir={dir} className="min-h-screen bg-gray-50">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 px-4 py-5">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => window.history.back()}
            className="text-blue-600 text-sm mb-2 hover:underline"
          >
            ← {t('common.back', lang)}
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            {t('icu.transferRequest', lang)}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {hospitalName} — {displayUnitName}
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* ── Cancelled banner ──────────────────────────────────────── */}
        {isCancelled && (
          <div className="bg-gray-100 border border-gray-300 rounded-xl p-4 text-center">
            <p className="text-gray-600 font-medium">
              {lang === 'ar' ? 'تم إلغاء الطلب' : 'Transfer cancelled'}
            </p>
          </div>
        )}

        {/* ── Declined banner ───────────────────────────────────────── */}
        {isDeclined && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-700 font-medium">
              {t('icu.transferDeclined', lang)}
            </p>
            {transfer.decline_reason_ar && (
              <p className="text-red-600 text-sm mt-2">
                {transfer.decline_reason_ar}
              </p>
            )}
            <a
              href={`/${lang}/icu`}
              className="inline-block mt-3 text-sm text-blue-600 underline"
            >
              {t('icu.searchNearby', lang)}
            </a>
          </div>
        )}

        {/* ── Timeline ──────────────────────────────────────────────── */}
        {!isTerminal && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="space-y-0">
              {TIMELINE_STEPS.map((step, idx) => {
                const state = getStepState(idx, transfer);
                const timeValue = step.timeField
                  ? (transfer[step.timeField] as string | null)
                  : null;
                const isLast = idx === TIMELINE_STEPS.length - 1;

                return (
                  <div key={idx} className="flex gap-3">
                    {/* Indicator column */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          state === 'completed'
                            ? 'bg-green-500 text-white'
                            : state === 'current'
                              ? 'bg-blue-500 text-white ring-4 ring-blue-100'
                              : 'bg-gray-200 text-gray-400'
                        }`}
                      >
                        {state === 'completed' ? '✓' : state === 'current' ? '●' : '○'}
                      </div>
                      {!isLast && (
                        <div
                          className={`w-0.5 h-8 ${
                            state === 'completed' ? 'bg-green-300' : 'bg-gray-200'
                          }`}
                        />
                      )}
                    </div>

                    {/* Label + time */}
                    <div className="pb-6">
                      <p
                        className={`text-sm font-medium ${
                          state === 'pending' ? 'text-gray-400' : 'text-gray-900'
                        }`}
                      >
                        {lang === 'ar' ? step.labelAr : step.labelEn}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatTime(timeValue, lang)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Details card ──────────────────────────────────────────── */}
        {transfer.status === 'accepted' || transfer.status === 'en_route' || transfer.status === 'arrived' ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            {transfer.bed_assigned_ar && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('icu.bedAssigned', lang)}</span>
                <span className="font-medium text-gray-900">{transfer.bed_assigned_ar}</span>
              </div>
            )}
            {transfer.receiving_contact_phone && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('icu.contactPhone', lang)}</span>
                <a href={`tel:${transfer.receiving_contact_phone}`} className="font-medium text-blue-600">
                  {transfer.receiving_contact_phone}
                </a>
              </div>
            )}
            {transfer.estimated_eta_minutes && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('icu.estimatedArrival', lang)}</span>
                <span className="font-medium text-gray-900">
                  {transfer.estimated_eta_minutes} {t('icu.minutes', lang)}
                </span>
              </div>
            )}
          </div>
        ) : null}

        {/* ── Awaiting response ─────────────────────────────────────── */}
        {(transfer.status === 'requested' || transfer.status === 'acknowledged') && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <div className="animate-pulse text-yellow-600 text-2xl mb-2">⏳</div>
            <p className="text-yellow-700 font-medium text-sm">
              {t('icu.awaitingResponse', lang)}
            </p>
          </div>
        )}

        {/* ── Action buttons ────────────────────────────────────────── */}
        {!isTerminal && (
          <div className="space-y-3">
            {/* Mark en route */}
            {transfer.status === 'accepted' && (
              <button
                onClick={() => handleAction('en_route')}
                disabled={actionLoading}
                className="w-full py-3 bg-green-600 text-white rounded-xl font-bold text-base hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading
                  ? t('common.loading', lang)
                  : t('icu.markEnRoute', lang)}
              </button>
            )}

            {/* En route status */}
            {transfer.status === 'en_route' && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <p className="text-green-700 font-medium">
                  {t('icu.enRoute', lang)}
                </p>
              </div>
            )}

            {/* Cancel button */}
            {!['arrived', 'cancelled'].includes(transfer.status) && (
              <>
                {showCancelConfirm ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                    <p className="text-sm text-red-700">
                      {lang === 'ar'
                        ? 'هل أنت متأكد من إلغاء طلب التحويل؟'
                        : 'Are you sure you want to cancel this transfer?'}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction('cancel')}
                        disabled={actionLoading}
                        className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        {actionLoading
                          ? t('common.loading', lang)
                          : t('common.confirm', lang)}
                      </button>
                      <button
                        onClick={() => setShowCancelConfirm(false)}
                        className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium"
                      >
                        {t('common.back', lang)}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="w-full py-3 bg-white border border-red-300 text-red-600 rounded-xl font-medium text-sm hover:bg-red-50 transition-colors"
                  >
                    {t('icu.cancelTransfer', lang)}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}
