'use client';

import type { DoctorRecommendation } from '@triaji/shared/types';
import DoctorCard from './DoctorCard';

interface DoctorListProps {
  recommendation: DoctorRecommendation;
}

export default function DoctorList({ recommendation }: DoctorListProps) {
  const { doctors, specialtyNameAr, urgencyLevel } = recommendation;

  return (
    <div className="w-full animate-fade-in-up">
      {/* Header */}
      <div className="text-center mb-4 pt-2">
        <h2 className="text-lg font-bold text-gray-800">
          الأطباء المتاحون في منطقتك
        </h2>
        <p className="text-sm text-teal-600 font-medium mt-1">
          تخصص: {specialtyNameAr}
        </p>
      </div>

      {/* Doctor Cards */}
      {doctors.length > 0 ? (
        <div className="space-y-3">
          {doctors.slice(0, 5).map((doctor, index) => (
            <div
              key={doctor.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <DoctorCard doctor={doctor} urgencyLevel={urgencyLevel} />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl p-6 text-center">
          <p className="text-gray-500">
            لا يوجد أطباء متاحون حالياً في منطقتك، جاري البحث في مناطق أخرى...
          </p>
        </div>
      )}
    </div>
  );
}
