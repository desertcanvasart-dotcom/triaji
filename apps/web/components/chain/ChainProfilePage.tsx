'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { t, type Lang } from '@triaji/shared/i18n/strings';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChainInfo {
  id: string;
  name_ar: string;
  name_en: string | null;
  slug: string;
  chain_type: string;
  logo_url: string | null;
  main_phone: string | null;
  main_email: string | null;
  website: string | null;
  primary_color: string;
  specialties: string[];
}

interface BranchInfo {
  tenant_id: string;
  branch_name: string;
  branch_name_en: string | null;
  branch_number: number;
  slug: string | null;
  address_ar: string | null;
  address_en: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  working_hours_ar: string | null;
  working_hours_en: string | null;
  is_active: boolean;
  distance_km: number | null;
  tenant_type: string;
}

interface ChainProfilePageProps {
  slug: string;
  lang: Lang;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const CHAIN_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  clinic_chain: { ar: 'سلسلة عيادات', en: 'Clinic Chain' },
  lab_chain: { ar: 'سلسلة معامل', en: 'Lab Chain' },
  radiology_chain: { ar: 'سلسلة أشعة', en: 'Radiology Chain' },
  pharmacy_chain: { ar: 'سلسلة صيدليات', en: 'Pharmacy Chain' },
  mixed: { ar: 'سلسلة متعددة', en: 'Mixed Chain' },
};

function getTenantBookingPath(
  lang: Lang,
  tenantType: string,
  branchSlug: string | null,
  tenantId: string
): string {
  const slug = branchSlug ?? tenantId;
  if (tenantType === 'lab') return `/${lang}/lab/${slug}`;
  if (tenantType === 'pharmacy') return `/${lang}/pharmacy/${slug}`;
  return `/${lang}/clinic/${slug}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChainProfilePage({ slug, lang }: ChainProfilePageProps) {
  const isRtl = lang === 'ar';

  const [chain, setChain] = useState<ChainInfo | null>(null);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [geoAvailable, setGeoAvailable] = useState(false);

  // ─── Fetch Chain Data ───────────────────────────────────────────────────

  const fetchChainData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/chain/${slug}`);
      if (!res.ok) {
        setError(lang === 'ar' ? 'السلسلة غير موجودة' : 'Chain not found');
        setLoading(false);
        return;
      }

      const data = await res.json();
      setChain(data.chain as ChainInfo);
      const branchList = (data.branches ?? []) as BranchInfo[];

      // ─── Geolocation Sort (AMENDMENT) ─────────────────────────────────
      // Try browser geolocation. If unavailable/denied: fall back to branch_number.
      // Do NOT block page load.

      let sortedBranches = branchList;

      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 300000,
          });
        });

        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        sortedBranches = branchList.map((b) => ({
          ...b,
          distance_km:
            b.lat != null && b.lng != null
              ? Math.round(haversineKm(userLat, userLng, b.lat, b.lng) * 10) / 10
              : null,
        }));

        // Sort by distance (nulls last)
        sortedBranches.sort((a, b) => {
          if (a.distance_km != null && b.distance_km != null)
            return a.distance_km - b.distance_km;
          if (a.distance_km != null) return -1;
          if (b.distance_km != null) return 1;
          return a.branch_number - b.branch_number;
        });

        setGeoAvailable(true);
      } catch {
        // Geolocation unavailable or denied — fall back to branch_number ordering
        sortedBranches = [...branchList].sort(
          (a, b) => a.branch_number - b.branch_number
        );
        setGeoAvailable(false);
      }

      setBranches(sortedBranches);
    } catch {
      setError(lang === 'ar' ? 'حدث خطأ' : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [slug, lang]);

  useEffect(() => {
    fetchChainData();
  }, [fetchChainData]);

  // ─── Loading ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="bg-white rounded-xl shadow-sm animate-pulse h-40" />
        <div className="bg-white rounded-xl shadow-sm animate-pulse h-24" />
        <div className="bg-white rounded-xl shadow-sm animate-pulse h-24" />
      </div>
    );
  }

  // ─── Error ──────────────────────────────────────────────────────────────

  if (error || !chain) {
    return (
      <div
        className="max-w-2xl mx-auto px-4 py-16 text-center"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <span className="text-4xl mb-3 block">&#128308;</span>
        <p className="text-gray-600">{error ?? t('common.error', lang)}</p>
      </div>
    );
  }

  // ─── Derived ────────────────────────────────────────────────────────────

  const chainName = lang === 'en' && chain.name_en ? chain.name_en : chain.name_ar;
  const chainTypeLabel =
    CHAIN_TYPE_LABELS[chain.chain_type]?.[lang] ?? chain.chain_type;
  const activeBranches = branches.filter((b) => b.is_active);
  const firstBranch = activeBranches[0];
  const nearestBranchId =
    geoAvailable && firstBranch && firstBranch.distance_km != null
      ? firstBranch.tenant_id
      : null;

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      className="max-w-2xl mx-auto px-4 py-6 space-y-6"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Chain Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 text-center">
        {chain.logo_url && (
          <img
            src={chain.logo_url}
            alt={chainName}
            className="w-20 h-20 rounded-xl mx-auto mb-3 object-contain"
          />
        )}
        <h1 className="text-2xl font-bold text-gray-900">{chainName}</h1>
        <p className="text-sm text-gray-500 mt-1">{chainTypeLabel}</p>

        {/* Specialties */}
        {chain.specialties.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {chain.specialties.map((spec) => (
              <span
                key={spec}
                className="text-xs bg-violet-50 text-violet-700 px-2 py-1 rounded-full"
              >
                {spec}
              </span>
            ))}
          </div>
        )}

        {/* Contact Info */}
        <div className="flex justify-center gap-4 mt-4 text-sm text-gray-500">
          {chain.main_phone && (
            <a href={`tel:${chain.main_phone}`} className="hover:text-teal-600">
              &#128222; {chain.main_phone}
            </a>
          )}
          {chain.website && (
            <a
              href={chain.website}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-teal-600"
            >
              &#127760; {lang === 'ar' ? 'الموقع' : 'Website'}
            </a>
          )}
        </div>
      </div>

      {/* Branch List */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          {t('chain.ourBranches', lang)}
        </h2>

        {activeBranches.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-gray-500">
              {lang === 'ar' ? 'لا توجد فروع متاحة حالياً' : 'No branches available'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeBranches.map((branch) => {
              const branchName =
                lang === 'en' && branch.branch_name_en
                  ? branch.branch_name_en
                  : branch.branch_name;
              const address =
                lang === 'en' && branch.address_en
                  ? branch.address_en
                  : branch.address_ar;
              const hours =
                lang === 'en' && branch.working_hours_en
                  ? branch.working_hours_en
                  : branch.working_hours_ar;
              const isNearest = branch.tenant_id === nearestBranchId;

              return (
                <div
                  key={branch.tenant_id}
                  className={`bg-white rounded-xl shadow-sm p-4 border ${
                    isNearest ? 'border-teal-300 ring-1 ring-teal-100' : 'border-gray-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{branchName}</h3>
                        {isNearest && (
                          <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                            {t('chain.nearestBranch', lang)}
                          </span>
                        )}
                      </div>

                      {address && (
                        <p className="text-sm text-gray-500 mt-1">
                          &#128205; {address}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                        {hours && (
                          <span>&#128336; {hours}</span>
                        )}
                        {branch.phone && (
                          <a
                            href={`tel:${branch.phone}`}
                            className="hover:text-teal-600"
                          >
                            &#128222; {branch.phone}
                          </a>
                        )}
                        {branch.distance_km != null && (
                          <span className="text-teal-600 font-medium">
                            &#128206; {branch.distance_km} {lang === 'ar' ? 'كم' : 'km'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Book Button */}
                    <Link
                      href={getTenantBookingPath(
                        lang,
                        branch.tenant_type ?? 'clinic',
                        branch.slug,
                        branch.tenant_id
                      )}
                      className="flex-shrink-0 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap"
                    >
                      {t('chain.bookAppointment', lang)}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Disclaimer */}
      <p className="text-center text-xs text-gray-400 pt-4">
        {t('common.disclaimer', lang)}
      </p>
    </div>
  );
}
