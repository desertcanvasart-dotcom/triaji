'use client';

import { useState } from 'react';
import { t, type Lang } from '@triaji/shared/i18n';

export interface AdherenceRecord {
  id: string;
  drug_name_ar: string;
  drug_name_en: string;
  dose: string;
  frequency_ar: string;
  frequency_en: string;
  status: 'dispensed' | 'sent_to_pharmacy' | 'not_dispensed';
  prescription_id: string | null;
}

interface MedicationAdherenceListProps {
  medications: AdherenceRecord[];
  lang: Lang;
  readOnly?: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  dispensed: 'bg-green-100 text-green-700',
  sent_to_pharmacy: 'bg-yellow-100 text-yellow-700',
  not_dispensed: 'bg-red-100 text-red-700',
};

export default function MedicationAdherenceList({
  medications,
  lang,
  readOnly = false,
}: MedicationAdherenceListProps) {
  const isRtl = lang === 'ar';
  const [sendingId, setSendingId] = useState<string | null>(null);

  if (medications.length === 0) {
    return (
      <div dir={isRtl ? 'rtl' : 'ltr'}>
        <h3 className="text-base font-bold text-gray-900 mb-2">
          {t('medicalRecord.activeMedications', lang)}
        </h3>
        <p className="text-sm text-gray-400">{t('medicalRecord.noMedications', lang)}</p>
      </div>
    );
  }

  const statusLabel = (status: string): string => {
    switch (status) {
      case 'dispensed':
        return t('medicalRecord.dispensed', lang);
      case 'sent_to_pharmacy':
        return t('medicalRecord.sentToPharmacy', lang);
      default:
        return t('medicalRecord.notDispensed', lang);
    }
  };

  const handleSendToPharmacy = async (medId: string) => {
    setSendingId(medId);
    try {
      await fetch('/api/patient/medical-record/send-to-pharmacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ medication_id: medId }),
      });
    } catch {
      // Silent
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'}>
      <h3 className="text-base font-bold text-gray-900 mb-3">
        {t('medicalRecord.activeMedications', lang)}
      </h3>
      <div className="space-y-2">
        {medications.map((med) => (
          <div
            key={med.id}
            className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {lang === 'ar' ? med.drug_name_ar : med.drug_name_en}
              </p>
              <p className="text-xs text-gray-500">
                {med.dose} &mdash; {lang === 'ar' ? med.frequency_ar : med.frequency_en}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLES[med.status] ?? STATUS_STYLES.not_dispensed}`}
              >
                {statusLabel(med.status)}
              </span>
              {!readOnly && med.status === 'not_dispensed' && (
                <button
                  onClick={() => handleSendToPharmacy(med.id)}
                  disabled={sendingId === med.id}
                  className="text-xs bg-teal-600 text-white px-2.5 py-1 rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 whitespace-nowrap transition-colors"
                >
                  {t('pharmacy.sendToPharmacy', lang)}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
