'use client';

/**
 * GpInteractionAlerts — Drug Interaction Alerts for GP Dashboard
 *
 * Shows medication interaction alerts across all GP patients.
 * Only renders if the doctor has active GP relationships and
 * interactions exist among their patients' medications.
 *
 * Severity tiers:
 * - Contraindicated/Major → red "Contact now" button
 * - Moderate → amber "View record" button
 * - Minor → not shown (too noisy for dashboard)
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { t, type Lang } from '@triaji/shared/i18n';
import type { InteractionSeverity } from '@triaji/shared/types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface GpPatientInteraction {
  patientId: string;
  patientNameAr: string;
  patientNameEn: string | null;
  patientPhone: string;
  drugA: string;
  drugB: string;
  severity: InteractionSeverity;
}

interface GpInteractionAlertsResponse {
  alerts: GpPatientInteraction[];
}

interface GpInteractionAlertsProps {
  doctorAccountId: string;
  lang: Lang;
}

// ─── Severity Helpers ───────────────────────────────────────────────────────

function isCritical(severity: InteractionSeverity): boolean {
  return severity === 'contraindicated' || severity === 'major';
}

function severityOrder(severity: InteractionSeverity): number {
  switch (severity) {
    case 'contraindicated': return 0;
    case 'major': return 1;
    case 'moderate': return 2;
    case 'minor': return 3;
    default: return 4;
  }
}

const SEVERITY_BADGE: Record<InteractionSeverity, { bg: string; text: string }> = {
  contraindicated: { bg: 'bg-red-100', text: 'text-red-700' },
  major: { bg: 'bg-red-100', text: 'text-red-700' },
  moderate: { bg: 'bg-amber-100', text: 'text-amber-800' },
  minor: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function GpInteractionAlerts({
  doctorAccountId,
  lang,
}: GpInteractionAlertsProps) {
  const [alerts, setAlerts] = useState<GpPatientInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasGpRelationships, setHasGpRelationships] = useState(false);
  const isRtl = lang === 'ar';

  useEffect(() => {
    const controller = new AbortController();

    async function fetchAlerts() {
      try {
        const res = await fetch(
          `/api/doctor/gp/interaction-alerts?doctorAccountId=${encodeURIComponent(doctorAccountId)}`,
          {
            credentials: 'include',
            signal: controller.signal,
          }
        );

        if (res.status === 404) {
          // No GP relationships
          setHasGpRelationships(false);
          return;
        }

        if (!res.ok) return;

        const data = (await res.json()) as GpInteractionAlertsResponse;
        setHasGpRelationships(true);

        // Filter out minor interactions (too noisy) and sort by severity
        const filtered = data.alerts
          .filter((a) => a.severity !== 'minor')
          .sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity));

        setAlerts(filtered);
      } catch {
        // Silent on error — dashboard should not break for this
      } finally {
        setLoading(false);
      }
    }

    fetchAlerts();
    return () => controller.abort();
  }, [doctorAccountId]);

  // Don't render if no GP relationships, still loading, or no alerts
  if (loading || !hasGpRelationships || alerts.length === 0) return null;

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 overflow-hidden"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Section header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-amber-50">
        <div className="flex items-center gap-2">
          <span className="text-xl">💊</span>
          <h2 className="text-base font-bold text-[#1A2F4A]">
            {t('interactions.gpAlerts', lang)}
          </h2>
          <span className="bg-amber-200 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded-full">
            {alerts.length}
          </span>
        </div>
      </div>

      {/* Alert list */}
      <div className="divide-y divide-gray-100">
        {alerts.map((alert, idx) => {
          const patientName =
            lang === 'ar'
              ? alert.patientNameAr
              : alert.patientNameEn ?? alert.patientNameAr;

          const critical = isCritical(alert.severity);
          const badge = SEVERITY_BADGE[alert.severity];
          const severityText = t(`interactions.${alert.severity}`, lang);

          return (
            <div
              key={`${alert.patientId}-${idx}`}
              className={`px-5 py-3.5 flex items-center gap-3 ${
                critical ? 'bg-red-50/40' : ''
              }`}
            >
              {/* Patient info + drug pair */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {patientName}
                </p>
                <p className="text-xs text-gray-500 mt-0.5" dir="auto">
                  {alert.drugA} + {alert.drugB}
                </p>
              </div>

              {/* Severity badge */}
              <span
                className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}
              >
                {severityText}
              </span>

              {/* Action button */}
              {critical ? (
                <Link
                  href={`/${lang}/doctor/patients/${alert.patientId}`}
                  className="shrink-0 inline-flex items-center px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  {t('interactions.contactNow', lang)}
                </Link>
              ) : (
                <Link
                  href={`/${lang}/doctor/patients/${alert.patientId}`}
                  className="shrink-0 inline-flex items-center px-3.5 py-1.5 border border-amber-500 text-amber-700 hover:bg-amber-50 text-xs font-semibold rounded-lg transition-colors"
                >
                  {t('interactions.viewRecord', lang)}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
