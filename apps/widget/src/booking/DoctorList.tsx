import React from 'react';
import type { DoctorRecommendation, MatchedDoctor } from '../config';

interface DoctorListProps {
  recommendation: DoctorRecommendation;
  onSelectDoctor: (doctor: MatchedDoctor) => void;
  primaryColor: string;
}

export function DoctorList({ recommendation, onSelectDoctor, primaryColor }: DoctorListProps) {
  return (
    <div className="triaji-doctors-section">
      <div className="triaji-doctors-header">
        {recommendation.specialtyNameAr}
      </div>
      <div className="triaji-doctors-summary">
        {recommendation.summaryAr}
      </div>
      {recommendation.doctors.map((doc) => (
        <div
          key={doc.id}
          className="triaji-doctor-card"
          onClick={() => onSelectDoctor(doc)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onSelectDoctor(doc); }}
        >
          <div className="triaji-doctor-avatar">
            {doc.photoUrl ? (
              <img src={doc.photoUrl} alt={doc.nameAr} />
            ) : (
              '👨‍⚕️'
            )}
          </div>
          <div className="triaji-doctor-info">
            <div className="triaji-doctor-name">{doc.nameAr}</div>
            <div className="triaji-doctor-specialty">
              {doc.titleAr} — {doc.specialtyNameAr}
            </div>
            <div className="triaji-doctor-meta">
              <span>{doc.governorateNameAr}</span>
              {doc.distanceKm > 0 && (
                <span>{doc.distanceKm.toFixed(1)} كم</span>
              )}
              {doc.ratingCount > 0 && (
                <span>⭐ {doc.ratingAvg.toFixed(1)}</span>
              )}
              {doc.consultationFeeEgp != null && (
                <span className="triaji-doctor-fee">
                  {doc.consultationFeeEgp} ج.م
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
