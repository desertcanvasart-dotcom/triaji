'use client';

import { useMemo } from 'react';
import type { QueueEntry } from '@triaji/shared/types';
import type { QueueEntryStatus } from '@triaji/shared/types';

// ─── Chain Patient Badge Info ────────────────────────────────────────────────

export interface ChainPatientBadge {
  chainNameAr: string;
  firstSeenAt: string;
  totalVisits: number;
  branchesVisited: { branchNameAr: string; visitCount: number }[];
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface QueueListProps {
  entries: QueueEntry[];
  onCallNext: () => void;
  onUpdateStatus: (id: string, status: string) => void;
  estimatedMinutesPerPatient: number;
  /** Chain patient info keyed by patient_id. Loaded by parent via getChainPatientInfo(). */
  chainPatients?: Map<string, ChainPatientBadge>;
}

// ─── Status Config ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  QueueEntryStatus,
  { label: string; emoji: string; badgeClass: string; numberBg: string }
> = {
  waiting: {
    label: 'ينتظر',
    emoji: '⏳',
    badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    numberBg: 'bg-teal-600 text-white',
  },
  called: {
    label: 'داخل',
    emoji: '🟢',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    numberBg: 'bg-blue-600 text-white',
  },
  completed: {
    label: 'انتهى',
    emoji: '✓',
    badgeClass: 'bg-green-100 text-green-800 border-green-200',
    numberBg: 'bg-green-600 text-white',
  },
  no_show: {
    label: 'لم يحضر',
    emoji: '❌',
    badgeClass: 'bg-gray-100 text-gray-500 border-gray-200',
    numberBg: 'bg-gray-400 text-white',
  },
  left: {
    label: 'غادر',
    emoji: '❌',
    badgeClass: 'bg-gray-100 text-gray-500 border-gray-200',
    numberBg: 'bg-gray-400 text-white',
  },
  skipped: {
    label: 'تم تخطيه',
    emoji: '⏭',
    badgeClass: 'bg-gray-100 text-gray-500 border-gray-200',
    numberBg: 'bg-gray-400 text-white',
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function minutesAgo(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 60_000);
}

function formatMinutesAgo(isoDate: string): string {
  const mins = minutesAgo(isoDate);
  if (mins < 1) return 'الآن';
  if (mins === 1) return 'منذ دقيقة';
  if (mins === 2) return 'منذ دقيقتين';
  if (mins <= 10) return `منذ ${mins} دقائق`;
  return `منذ ${mins} دقيقة`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function QueueList({
  entries,
  onCallNext,
  onUpdateStatus,
  estimatedMinutesPerPatient,
  chainPatients,
}: QueueListProps) {
  // ─── Stats ──────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const waiting = entries.filter((e) => e.status === 'waiting');
    const completed = entries.filter((e) => e.status === 'completed');
    const calledOrWaiting = entries.filter(
      (e) => e.status === 'waiting' || e.status === 'called'
    );

    // Average wait for completed entries
    let avgWait = 0;
    if (completed.length > 0) {
      const totalWait = completed.reduce(
        (sum, e) => sum + (e.wait_minutes_actual ?? 0),
        0
      );
      avgWait = Math.round(totalWait / completed.length);
    }

    return {
      waitingCount: waiting.length,
      completedCount: completed.length,
      activeCount: calledOrWaiting.length,
      avgWait,
    };
  }, [entries]);

  const hasWaiting = stats.waitingCount > 0;

  // ─── Sorted entries ───────────────────────────────────────────────────────

  const sortedEntries = useMemo(() => {
    // Active (waiting/called) first, then completed/others
    const statusOrder: Record<string, number> = {
      called: 0,
      waiting: 1,
      skipped: 2,
      no_show: 3,
      left: 4,
      completed: 5,
    };
    return [...entries].sort((a, b) => {
      const oa = statusOrder[a.status] ?? 9;
      const ob = statusOrder[b.status] ?? 9;
      if (oa !== ob) return oa - ob;
      return a.queue_number - b.queue_number;
    });
  }, [entries]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Call Next Button */}
      <button
        onClick={onCallNext}
        disabled={!hasWaiting}
        className="w-full h-14 rounded-xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-lg font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
      >
        استدعِ التالي 📣
      </button>

      {/* Stats Bar */}
      <div className="flex items-center gap-4 text-sm bg-gray-50 rounded-lg px-4 py-2.5 border border-gray-100">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <span className="text-gray-600">ينتظرون:</span>
          <span className="font-bold text-gray-900">{stats.waitingCount}</span>
        </div>
        <div className="h-4 w-px bg-gray-300" />
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="text-gray-600">تم:</span>
          <span className="font-bold text-gray-900">{stats.completedCount}</span>
        </div>
        <div className="h-4 w-px bg-gray-300" />
        <div className="flex items-center gap-1.5">
          <span className="text-gray-600">متوسط الانتظار:</span>
          <span className="font-bold text-gray-900">
            {stats.avgWait > 0
              ? `${stats.avgWait} د`
              : `~${estimatedMinutesPerPatient} د`}
          </span>
        </div>
      </div>

      {/* Queue Entries */}
      {sortedEntries.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-4xl mb-3 block">🏥</span>
          <p className="text-gray-500 text-sm">لا يوجد مرضى في الطابور اليوم</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sortedEntries.map((entry) => (
            <QueueEntryRow
              key={entry.id}
              entry={entry}
              onUpdateStatus={onUpdateStatus}
              chainBadge={
                entry.patient_id && chainPatients
                  ? chainPatients.get(entry.patient_id) ?? null
                  : null
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Queue Entry Row ────────────────────────────────────────────────────────

function formatChainDate(iso: string): string {
  const MONTHS_AR = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ];
  const d = new Date(iso);
  return `${MONTHS_AR[d.getMonth()]} ${d.getFullYear()}`;
}

function QueueEntryRow({
  entry,
  onUpdateStatus,
  chainBadge,
}: {
  entry: QueueEntry;
  onUpdateStatus: (id: string, status: string) => void;
  chainBadge: ChainPatientBadge | null;
}) {
  const config = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.waiting;
  const isActive = entry.status === 'waiting' || entry.status === 'called';

  return (
    <li
      className={`group bg-white rounded-lg border px-4 py-3 flex items-center gap-3 transition-colors ${
        isActive
          ? 'border-gray-200 hover:border-teal-300 hover:bg-teal-50/30'
          : 'border-gray-100 opacity-70'
      }`}
    >
      {/* Queue Number Circle */}
      <div
        className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold ${config.numberBg}`}
      >
        {entry.queue_number}
      </div>

      {/* Patient Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-gray-900 text-sm truncate">
            {entry.patient_name_ar}
          </span>
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${config.badgeClass}`}
          >
            <span>{config.emoji}</span>
            <span>{config.label}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
          <span>{formatMinutesAgo(entry.arrived_at)}</span>
          {entry.chief_complaint_ar && (
            <>
              <span className="text-gray-300">|</span>
              <span className="truncate">{entry.chief_complaint_ar}</span>
            </>
          )}
        </div>

        {/* Chain Patient Badge */}
        {chainBadge && (
          <div className="mt-1.5 group/chain relative">
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200">
              <span>&#127973;</span>
              <span>
                {`مريض معروف — ${chainBadge.chainNameAr} منذ ${formatChainDate(chainBadge.firstSeenAt)} — ${chainBadge.totalVisits} ${chainBadge.totalVisits <= 2 ? 'زيارة' : chainBadge.totalVisits <= 10 ? 'زيارات' : 'زيارة'}`}
              </span>
            </span>
            {/* Cross-branch hover tooltip — no financial data */}
            {chainBadge.branchesVisited.length > 1 && (
              <div className="hidden group-hover/chain:block absolute z-10 top-full mt-1 right-0 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[200px]">
                <p className="text-xs font-semibold text-gray-700 mb-1.5">الفروع التي زارها:</p>
                <ul className="space-y-1">
                  {chainBadge.branchesVisited.map((b) => (
                    <li key={b.branchNameAr} className="flex items-center justify-between text-xs text-gray-600">
                      <span>{b.branchNameAr}</span>
                      <span className="font-medium text-gray-800">{b.visitCount} زيارة</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex-shrink-0 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {entry.status === 'waiting' && (
          <button
            onClick={() => onUpdateStatus(entry.id, 'called')}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            استدعِ
          </button>
        )}
        {entry.status === 'called' && (
          <>
            <button
              onClick={() => onUpdateStatus(entry.id, 'completed')}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              أكمل
            </button>
            <button
              onClick={() => onUpdateStatus(entry.id, 'skipped')}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
            >
              تخطي
            </button>
          </>
        )}
        {isActive && (
          <button
            onClick={() => onUpdateStatus(entry.id, 'left')}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            غادر
          </button>
        )}
      </div>
    </li>
  );
}
