'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { t, type Lang } from '@triaji/shared/i18n/strings';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Branch {
  branchId: string;
  nameAr: string;
  nameEn: string | null;
  addressAr: string;
  phone: string | null;
  distanceKm: number | null;
  openingTime: string | null;
  closingTime: string | null;
  homeCollection: boolean;
}

interface ChainBranchFinderProps {
  chainCode: string;
  chainNameAr: string;
  chainNameEn: string;
  lang: Lang;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ChainBranchFinder({
  chainCode,
  chainNameAr,
  chainNameEn,
  lang,
}: ChainBranchFinderProps) {
  const isRtl = lang === 'ar';
  const chainName = lang === 'ar' ? chainNameAr : chainNameEn;

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ─── Fetch branches ───────────────────────────────────────────────────

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    setLocationError(false);
    setFetchError(null);

    try {
      // Request browser geolocation
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation not supported'));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000, // 5 min cache
        });
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      const params = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        radius_km: '20',
      });

      const res = await fetch(`/api/lab/chains/${chainCode}/branches?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setFetchError(data.error ?? t('common.error', lang));
        return;
      }

      setBranches(data.branches ?? []);
    } catch (err) {
      // Check if geolocation was denied
      if (err instanceof GeolocationPositionError || (err instanceof Error && err.message.includes('Geolocation'))) {
        setLocationError(true);
      } else {
        setFetchError(t('common.error', lang));
      }
    } finally {
      setLoading(false);
    }
  }, [chainCode, lang]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {t('labChain.chainBranches', lang)} — {chainName}
        </h2>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 mt-3 text-sm">{t('labChain.locatingYou', lang)}</p>
        </div>
      )}

      {/* Location denied error */}
      {!loading && locationError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <p className="text-red-700 text-sm">{t('labChain.locationDenied', lang)}</p>
          <button
            onClick={fetchBranches}
            className="mt-3 text-sm text-teal-600 hover:underline"
          >
            {t('common.tryAgain', lang)}
          </button>
        </div>
      )}

      {/* Fetch error */}
      {!loading && fetchError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <p className="text-red-700 text-sm">{fetchError}</p>
          <button
            onClick={fetchBranches}
            className="mt-3 text-sm text-teal-600 hover:underline"
          >
            {t('common.tryAgain', lang)}
          </button>
        </div>
      )}

      {/* No branches found */}
      {!loading && !locationError && !fetchError && branches.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <p className="text-gray-500 text-sm">{t('labChain.noBranchesFound', lang)}</p>
        </div>
      )}

      {/* Branch list */}
      {!loading && branches.length > 0 && (
        <div className="space-y-3">
          {branches.map((branch) => {
            const branchName = lang === 'ar'
              ? branch.nameAr
              : (branch.nameEn ?? branch.nameAr);

            return (
              <div
                key={branch.branchId}
                className="bg-white rounded-xl shadow-sm p-5 space-y-3"
              >
                {/* Branch name + distance */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-teal-600">&#128205;</span>
                    <h3 className="font-medium text-gray-900">{branchName}</h3>
                  </div>
                  {branch.distanceKm !== null && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full whitespace-nowrap">
                      {branch.distanceKm} {t('labChain.distanceKm', lang)}
                    </span>
                  )}
                </div>

                {/* Address */}
                <p className="text-sm text-gray-500">{branch.addressAr}</p>

                {/* Working hours */}
                {branch.openingTime && branch.closingTime && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-gray-400">&#128336;</span>
                    <span>
                      {t('labChain.workingHours', lang)}: {branch.openingTime} — {branch.closingTime}
                    </span>
                  </div>
                )}

                {/* Phone */}
                {branch.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-gray-400">&#128222;</span>
                    <a
                      href={`tel:${branch.phone}`}
                      dir="ltr"
                      className="text-teal-600 hover:underline"
                    >
                      {branch.phone}
                    </a>
                  </div>
                )}

                {/* Badges + action */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex gap-2">
                    {branch.homeCollection && (
                      <span className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full font-medium">
                        {t('labChain.homeCollection', lang)}
                      </span>
                    )}
                  </div>

                  <Link
                    href={`/${lang}/lab/${chainCode}/book?branch=${branch.branchId}`}
                    className="text-sm font-medium bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    {t('labChain.bookAtBranch', lang)}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
