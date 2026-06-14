'use client';

import type { DoctorRecommendation, MatchedDoctor } from '@triaji/shared/types';
import type { Lang } from '@triaji/shared/i18n';
import DoctorCard from './DoctorCard';

interface DoctorListProps {
  recommendation: DoctorRecommendation;
  onBookDoctor?: (doctor: MatchedDoctor, appointmentType?: 'in_person' | 'telehealth') => void;
  lang?: Lang;
}

const TEXTS = {
  header:       { ar: 'الأطباء المتاحون', en: 'Available Doctors' },
  specialty:    { ar: 'تخصص:', en: 'Specialty:' },
  noDoctors:    { ar: 'لا يوجد أطباء متاحون حالياً لهذا التخصص. يرجى المحاولة لاحقاً أو التواصل معنا للمساعدة.',
                  en: 'No doctors are currently available for this specialty. Please try again later or contact us for assistance.' },
};

export default function DoctorList({ recommendation, onBookDoctor, lang = 'ar' }: DoctorListProps) {
  const { doctors, specialtyNameAr, urgencyLevel } = recommendation;

  return (
    <div className="w-full animate-fade-in-up">
      {/* Header */}
      <div className="text-center mb-4 pt-2">
        <h2 className="text-lg font-bold text-gray-800">
          {TEXTS.header[lang]}
        </h2>
        <p className="text-sm text-teal-600 font-medium mt-1">
          {TEXTS.specialty[lang]} {specialtyNameAr}
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
              <DoctorCard doctor={doctor} urgencyLevel={urgencyLevel} onBookDoctor={onBookDoctor} />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl p-6 text-center">
          <p className="text-gray-500">
            {TEXTS.noDoctors[lang]}
          </p>
        </div>
      )}
    </div>
  );
}
