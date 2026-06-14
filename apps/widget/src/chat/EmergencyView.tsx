import React from 'react';

interface EmergencyViewProps {
  reasonAr: string;
  instructionsAr: string;
}

export function EmergencyView({ reasonAr, instructionsAr }: EmergencyViewProps) {
  return (
    <div className="triaji-emergency">
      <div className="triaji-emergency-icon">🚨</div>
      <div className="triaji-emergency-title">حالة طوارئ</div>
      <div className="triaji-emergency-text">{reasonAr}</div>
      <div className="triaji-emergency-text">{instructionsAr}</div>
      <div className="triaji-emergency-phone">123</div>
      <div className="triaji-emergency-text">اتصل بالإسعاف فوراً</div>
    </div>
  );
}
