/**
 * PatientSummary — compact card showing patient demographics,
 * BRS score, allergies, chronic conditions, and medications.
 */

import { View, Text, StyleSheet } from 'react-native';
import type { Lang } from '@triaji/shared/i18n';
import { s } from '@triaji/shared/i18n';

interface PatientData {
  name: string;
  age: number;
  sex: 'male' | 'female';
  brs_score?: number;
  brs_level?: string;
  allergies: string[];
  chronic_conditions: string[];
  medications: string[];
}

interface PatientSummaryProps {
  patient: PatientData;
  lang: Lang;
  isRtl: boolean;
}

export default function PatientSummary({ patient, lang, isRtl }: PatientSummaryProps) {
  const sexLabel = patient.sex === 'male'
    ? s.doctorConsultation.male[lang]
    : s.doctorConsultation.female[lang];

  return (
    <View style={styles.card}>
      {/* Demographics */}
      <View style={[styles.row, isRtl && styles.rowRtl]}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{patient.name[0] ?? '?'}</Text>
        </View>
        <View style={styles.nameContainer}>
          <Text style={[styles.name, isRtl && styles.textRtl]} numberOfLines={1}>
            {patient.name}
          </Text>
          <Text style={[styles.meta, isRtl && styles.textRtl]}>
            {patient.age} {s.doctorConsultation.age[lang]} · {sexLabel}
          </Text>
        </View>
        {patient.brs_score != null && (
          <View style={[
            styles.brsBadge,
            patient.brs_level === 'high' && styles.brsBadgeHigh,
            patient.brs_level === 'medium' && styles.brsBadgeMedium,
          ]}>
            <Text style={[
              styles.brsText,
              patient.brs_level === 'high' && styles.brsTextHigh,
              patient.brs_level === 'medium' && styles.brsTextMedium,
            ]}>
              BRS {patient.brs_score}
            </Text>
          </View>
        )}
      </View>

      {/* Allergies */}
      {patient.allergies.length > 0 && (
        <View style={styles.allergyBanner}>
          <Text style={[styles.allergyLabel, isRtl && styles.textRtl]}>
            🚨 {s.doctorConsultation.allergies[lang]}
          </Text>
          <Text style={[styles.allergyText, isRtl && styles.textRtl]}>
            {patient.allergies.join(', ')}
          </Text>
        </View>
      )}

      {/* Chronic Conditions */}
      {patient.chronic_conditions.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isRtl && styles.textRtl]}>
            {s.doctorConsultation.chronicConditions[lang]}
          </Text>
          <View style={[styles.tagsRow, isRtl && styles.rowRtl]}>
            {patient.chronic_conditions.map((c, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{c}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Medications */}
      {patient.medications.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isRtl && styles.textRtl]}>
            {s.doctorConsultation.activeMedications[lang]}
          </Text>
          {patient.medications.map((med, i) => (
            <Text key={i} style={[styles.medText, isRtl && styles.textRtl]}>
              • {med}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A2F4A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  nameContainer: {
    flex: 1,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
  },
  meta: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Cairo',
    marginTop: 2,
  },
  brsBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  brsBadgeHigh: {
    backgroundColor: '#FFEBEE',
  },
  brsBadgeMedium: {
    backgroundColor: '#FFF8E1',
  },
  brsText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7D32',
    fontFamily: 'Cairo-Bold',
  },
  brsTextHigh: {
    color: '#C62828',
  },
  brsTextMedium: {
    color: '#E65100',
  },
  allergyBanner: {
    backgroundColor: '#FFEBEE',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    marginBottom: 12,
  },
  allergyLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#C62828',
    fontFamily: 'Cairo-Bold',
    marginBottom: 4,
  },
  allergyText: {
    fontSize: 13,
    color: '#B71C1C',
    fontFamily: 'Cairo',
  },
  section: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 6,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: '#F0F4F8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 12,
    color: '#4A5568',
    fontFamily: 'Cairo',
  },
  medText: {
    fontSize: 13,
    color: '#333',
    fontFamily: 'Cairo',
    lineHeight: 22,
  },
});
