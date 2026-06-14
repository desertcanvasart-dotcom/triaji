'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { t, type Lang } from '@triaji/shared/i18n/strings';
import { createBrowserClient } from '@triaji/shared/supabase';
import type { IcuSearchResult, IcuUnitType, StalenessLevel } from '@triaji/shared/types/icu';
import { getStalenessLevel } from '@triaji/shared/types/icu';
import IcuTransferForm from './IcuTransferForm';

// ─── Unit type filter options ───────────────────────────────────────────────

const UNIT_TYPES: (IcuUnitType | 'all')[] = [
  'all',
  'general_icu',
  'cardiac_icu',
  'neonatal_icu',
  'paediatric_icu',
  'surgical_icu',
  'neurological_icu',
  'burns_icu',
  'respiratory_icu',
];

// ─── Relative time formatting ───────────────────────────────────────────────

function formatRelativeTime(dateStr: string, lang: Lang): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMin < 1) {
    return lang === 'ar' ? 'الآن' : 'Just now';
  }
  if (diffMin < 60) {
    return lang === 'ar'
      ? `${diffMin} ${t('icu.minutesAgo', lang)}`
      : `${diffMin} ${t('icu.minutesAgo', lang)}`;
  }
  return lang === 'ar'
    ? `${diffHours} ${t('icu.hoursAgo', lang)}`
    : `${diffHours} ${t('icu.hoursAgo', lang)}`;
}

// ─── Staleness styling ──────────────────────────────────────────────────────

function stalenessStyles(level: StalenessLevel) {
  switch (level) {
    case 'fresh':
      return {
        dot: 'bg-green-500',
        border: 'border-green-200',
        bg: 'bg-white',
      };
    case 'stale':
      return {
        dot: 'bg-yellow-500',
        border: 'border-yellow-200',
        bg: 'bg-white',
      };
    case 'unreliable':
      return {
        dot: 'bg-gray-400',
        border: 'border-gray-200',
        bg: 'bg-gray-50',
      };
    default:
      return {
        dot: 'bg-gray-400',
        border: 'border-gray-200',
        bg: 'bg-gray-50',
      };
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  lang: Lang;
}

export default function IcuSearchPage({ lang }: Props) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [results, setResults] = useState<IcuSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<IcuUnitType | 'all'>('all');
  const [transferUnit, setTransferUnit] = useState<IcuSearchResult | null>(null);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const prevResultsRef = useRef<Map<string, number>>(new Map());

  // ── Get browser geolocation ─────────────────────────────────────────
  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError(lang === 'ar' ? 'المتصفح لا يدعم تحديد الموقع' : 'Geolocation not supported');
      return;
    }

    setLocationLoading(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude);
        setLng(position.coords.longitude);
        setLocationLoading(false);
      },
      (err) => {
        console.error('[ICU Search] Geolocation error:', err);
        setLocationError(
          lang === 'ar'
            ? 'لم نتمكن من تحديد موقعك'
            : 'Could not determine your location'
        );
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [lang]);

  // ── Fetch ICU beds ──────────────────────────────────────────────────
  const fetchResults = useCallback(async () => {
    if (lat === null || lng === null) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lng: lng.toString(),
        radius_km: '50',
      });

      if (selectedType !== 'all') {
        params.set('unit_type', selectedType);
      }

      const res = await fetch(`/api/icu/search?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${document.cookie.match(/sb-access-token=([^;]+)/)?.[1] || ''}`,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Search failed');
      }

      const data = await res.json();
      const newResults: IcuSearchResult[] = data.results || [];

      // Detect changes for flash animation
      const changedIds = new Set<string>();
      const prevMap = prevResultsRef.current;
      for (const r of newResults) {
        const prev = prevMap.get(r.icu_unit_id);
        if (prev !== undefined && prev !== r.available_beds) {
          changedIds.add(r.icu_unit_id);
        }
      }

      if (changedIds.size > 0) {
        setFlashIds(changedIds);
        setTimeout(() => setFlashIds(new Set()), 1500);
      }

      // Update prev map
      const newMap = new Map<string, number>();
      for (const r of newResults) {
        newMap.set(r.icu_unit_id, r.available_beds);
      }
      prevResultsRef.current = newMap;

      setResults(newResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [lat, lng, selectedType]);

  // ── Supabase Realtime subscription ──────────────────────────────────
  useEffect(() => {
    if (lat === null || lng === null) return;

    fetchResults();

    const supabase = createBrowserClient();
    const channel = supabase
      .channel('icu-units-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'icu_units',
        },
        () => {
          // Re-fetch results when any ICU unit changes
          fetchResults();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lat, lng, selectedType, fetchResults]);

  // ── Transfer form callbacks ─────────────────────────────────────────
  const handleTransferSubmitted = (transferId: string) => {
    setTransferUnit(null);
    window.location.href = `/${lang}/icu/transfer/${transferId}`;
  };

  return (
    <div dir={dir} className="min-h-screen bg-gray-50">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 px-4 py-5">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">
            {t('icu.pageTitle', lang)}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('icu.pageSubtitle', lang)}
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* ── Location ────────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={getLocation}
              disabled={locationLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <span>📍</span>
              {locationLoading
                ? t('common.loading', lang)
                : t('icu.myLocation', lang)}
            </button>

            {lat !== null && lng !== null && (
              <span className="text-sm text-green-600 font-medium">
                ✓ {lang === 'ar' ? 'تم تحديد الموقع' : 'Location set'}
              </span>
            )}
          </div>

          {locationError && (
            <p className="text-sm text-red-600 mt-2">{locationError}</p>
          )}
        </section>

        {/* ── Unit type filter ────────────────────────────────────────── */}
        <section className="flex flex-wrap gap-2">
          {UNIT_TYPES.map((type) => {
            const label =
              type === 'all'
                ? t('icu.allTypes', lang)
                : t(`icu.unitTypes.${type}`, lang);

            const isActive = selectedType === type;

            return (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            );
          })}
        </section>

        {/* ── Error ───────────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* ── Loading ─────────────────────────────────────────────────── */}
        {loading && (
          <div className="text-center py-12 text-gray-500">
            {t('common.loading', lang)}
          </div>
        )}

        {/* ── No results ──────────────────────────────────────────────── */}
        {!loading && lat !== null && results.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              {t('icu.noBedsFound', lang)}
            </p>
            <p className="text-gray-400 text-sm mt-2">
              {t('icu.callAmbulance', lang)}
            </p>
          </div>
        )}

        {/* ── Results ─────────────────────────────────────────────────── */}
        {!loading && results.length > 0 && (
          <div className="space-y-3">
            {results.map((result) => {
              const staleness = getStalenessLevel(result.last_updated_at);
              const styles = stalenessStyles(staleness);
              const isFlashing = flashIds.has(result.icu_unit_id);

              const hospitalName =
                lang === 'ar'
                  ? result.hospital_name_ar
                  : result.hospital_name_en || result.hospital_name_ar;

              const unitName =
                lang === 'ar'
                  ? result.unit_name_ar
                  : result.unit_name_en || result.unit_name_ar;

              const bedsLabel =
                result.available_beds === 1
                  ? t('icu.bedsAvailable', lang)
                  : t('icu.bedsAvailablePlural', lang);

              return (
                <div
                  key={result.icu_unit_id}
                  className={`bg-white rounded-xl border-2 ${styles.border} ${styles.bg} p-4 transition-all duration-300 ${
                    isFlashing ? 'ring-2 ring-blue-400 ring-offset-1' : ''
                  }`}
                >
                  {/* Top row: staleness dot + hospital name + distance */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-3 h-3 rounded-full flex-shrink-0 ${styles.dot}`}
                      />
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 truncate">
                          {hospitalName}
                        </h3>
                        <p className="text-sm text-gray-500">{unitName}</p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-400 flex-shrink-0">
                      {result.distance_km.toFixed(1)} km
                    </span>
                  </div>

                  {/* Beds info */}
                  <div className="mt-3 flex items-center gap-3">
                    {result.available_beds > 0 ? (
                      <span className="text-lg font-bold text-green-700">
                        {result.available_beds}{' '}
                        <span className="text-sm font-normal text-gray-500">
                          {bedsLabel}{' '}
                          {lang === 'ar' ? 'من' : 'of'} {result.total_beds}
                        </span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                        {t('icu.fullyOccupied', lang)}
                      </span>
                    )}
                  </div>

                  {/* Staleness warning for unreliable data */}
                  {staleness === 'unreliable' && (
                    <div className="mt-2 flex items-center gap-1.5 text-sm text-gray-500 bg-gray-100 rounded-lg px-3 py-1.5">
                      <span>⚠️</span>
                      <span>{t('icu.dataStale', lang)}</span>
                    </div>
                  )}

                  {/* Last updated + phone */}
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                    <span>
                      {t('icu.lastUpdated', lang)}:{' '}
                      {formatRelativeTime(result.last_updated_at, lang)}
                    </span>
                    {result.phone_direct && (
                      <a
                        href={`tel:${result.phone_direct}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        📞 {result.phone_direct}
                      </a>
                    )}
                  </div>

                  {/* Transfer button */}
                  {result.available_beds > 0 && result.accepts_transfers && (
                    <button
                      onClick={() => setTransferUnit(result)}
                      className="mt-3 w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                      {t('icu.requestTransfer', lang)}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Prompt to get location if not set ───────────────────────── */}
        {!loading && lat === null && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-5xl mb-4">📍</p>
            <p className="text-lg">{t('icu.searchNearby', lang)}</p>
          </div>
        )}
      </main>

      {/* ── Transfer Form Modal ───────────────────────────────────────── */}
      {transferUnit && (
        <IcuTransferForm
          lang={lang}
          unit={transferUnit}
          onClose={() => setTransferUnit(null)}
          onSubmitted={handleTransferSubmitted}
        />
      )}
    </div>
  );
}
