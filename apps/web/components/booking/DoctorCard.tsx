'use client';

import { useState } from 'react';
import type { MatchedDoctor } from '@triaji/shared/types';

interface DoctorCardProps {
  doctor: MatchedDoctor;
  urgencyLevel?: 'routine' | 'urgent' | 'emergency';
  onBookDoctor?: (doctor: MatchedDoctor, appointmentType: 'in_person' | 'telehealth') => void;
}

function StarRating({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.3;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <span className="text-amber-400 text-sm ltr-nums" dir="ltr">
      {'★'.repeat(fullStars)}
      {hasHalf && '★'}
      {'☆'.repeat(emptyStars)}
    </span>
  );
}

function InitialsAvatar({ name }: { name: string }) {
  const cleanName = name.replace(/^د\.\s*/, '');
  const parts = cleanName.split(' ');
  const initials = parts.length >= 2
    ? `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`
    : cleanName.slice(0, 2);

  return (
    <div className="w-16 h-16 rounded-full bg-teal-600 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
      {initials}
    </div>
  );
}

export default function DoctorCard({ doctor, urgencyLevel, onBookDoctor }: DoctorCardProps) {
  const [selectedType, setSelectedType] = useState<'in_person' | 'telehealth'>('in_person');

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Header: Avatar + Name + Specialty */}
      <div className="flex items-start gap-3 mb-3">
        {doctor.photoUrl ? (
          <img
            src={doctor.photoUrl}
            alt={doctor.nameAr}
            className="w-16 h-16 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <InitialsAvatar name={doctor.nameAr} />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-bold text-gray-900 truncate">
              {doctor.nameAr}
            </h3>
            {urgencyLevel === 'urgent' && (
              <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0">
                عاجل
              </span>
            )}
          </div>
          <p className="text-sm text-teal-700 font-medium">{doctor.titleAr}</p>
          <p className="text-sm text-gray-500">{doctor.specialtyNameAr}</p>
          {doctor.insuranceAccepted && doctor.insuranceProviderNameAr && (
            <p className="text-sm text-green-600 font-medium flex items-center gap-1">
              <span>&#10003;</span>
              <span>يقبل {doctor.insuranceProviderNameAr}</span>
            </p>
          )}
        </div>
      </div>

      {/* Info Grid */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <span>📍</span>
          <span>{doctor.governorateNameAr}</span>
          {doctor.distanceKm > 0 && (
            <span className="text-gray-400 ltr-nums">
              {' '}— على بُعد {doctor.distanceKm} كم
            </span>
          )}
        </div>

        {doctor.clinicAddressAr && (
          <p className="text-sm text-gray-500 truncate">{doctor.clinicAddressAr}</p>
        )}

        <div className="flex items-center justify-between">
          {doctor.consultationFeeEgp !== null && (
            <span className="text-sm font-semibold text-gray-700 ltr-nums">
              {selectedType === 'telehealth' && doctor.telehealthFeeEgp !== null
                ? `${doctor.telehealthFeeEgp} جنيه أونلاين`
                : `${doctor.consultationFeeEgp} جنيه للكشف`}
            </span>
          )}
          <div className="flex items-center gap-1">
            <StarRating rating={doctor.ratingAvg} />
            <span className="text-xs text-gray-400 ltr-nums">
              ({doctor.ratingCount})
            </span>
          </div>
        </div>
      </div>

      {/* Telehealth Type Selector */}
      {doctor.offersTelehealth && (
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setSelectedType('in_person')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              selectedType === 'in_person'
                ? 'bg-teal-600 text-white'
                : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            عيادة
          </button>
          <button
            onClick={() => setSelectedType('telehealth')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              selectedType === 'telehealth'
                ? 'bg-teal-600 text-white'
                : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            أونلاين
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onBookDoctor?.(doctor, selectedType)}
          className="flex-1 bg-teal-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-teal-700 transition-colors"
        >
          احجز موعد
        </button>
        <button className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors">
          عرض التفاصيل
        </button>
      </div>
    </div>
  );
}
