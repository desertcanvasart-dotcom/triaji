import React from 'react';
import type { BookingResult } from '../config';

interface ConfirmationProps {
  result: BookingResult;
  onClose: () => void;
  primaryColor: string;
}

export function Confirmation({ result, onClose, primaryColor }: ConfirmationProps) {
  return (
    <div className="triaji-confirmation">
      <div className="triaji-confirm-icon">✓</div>
      <div className="triaji-confirm-title">تم تأكيد الحجز!</div>
      <div className="triaji-confirm-details">
        <div>👨‍⚕️ {result.doctor.nameAr}</div>
        <div>📋 {result.doctor.specialtyNameAr}</div>
        <div>📅 {result.slot.dayAr} — {result.slot.dateAr}</div>
        <div>🕐 {result.slot.timeAr}</div>
        {result.confirmationMessage && (
          <div style={{ marginTop: '8px', fontSize: '13px', color: '#6b7280' }}>
            {result.confirmationMessage}
          </div>
        )}
      </div>
      <button
        className="triaji-confirm-close-btn"
        onClick={onClose}
        style={{ backgroundColor: primaryColor }}
      >
        إغلاق
      </button>
    </div>
  );
}
