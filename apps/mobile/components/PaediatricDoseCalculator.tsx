/**
 * PaediatricDoseCalculator — Mobile React Native Version
 *
 * Separate implementation from web — does NOT share code with Next.js.
 * Same API, same logic flow, uses View/Text/TouchableOpacity.
 * Fully bilingual (Arabic / English) via useLang() hook.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { useLang } from '../hooks/useLang';

// ─── Types ──────────────────────────────────────────────────────────────────

type Lang = 'ar' | 'en';

interface PaediatricDoseCalculatorProps {
  weightKg: number;
  ageMonths: number;
  onCopyToPrescription: (dose: CopyDosePayload) => void;
  apiBaseUrl: string;
}

export interface CopyDosePayload {
  drugNameAr: string;
  drugNameEn: string;
  dose: string;
  frequencyAr: string;
  frequencyEn: string;
}

interface DrugListItem {
  id: string;
  drug_name_en: string;
  drug_name_ar: string;
  indication_ar: string | null;
}

interface CalculatedFormulation {
  form: string;
  concentration: string;
  unit: string;
  notesAr?: string;
  minVolumePerDose: number | null;
  maxVolumePerDose: number | null;
  volumeUnit: string;
  isSuitable: boolean;
  unsuitableReason?: string;
}

interface CalculatedDose {
  drugId: string;
  drugNameAr: string;
  drugNameEn: string;
  indicationAr: string | null;
  dosesPerDay: number;
  formulaDescription: string;
  minDosePerDose: number;
  maxDosePerDose: number;
  cappedMinPerDose: number;
  cappedMaxPerDose: number;
  cappedMinDaily: number;
  cappedMaxDaily: number;
  maxSingleDoseMg: number | null;
  maxDailyDoseMg: number | null;
  notesAr: string | null;
  formulations: CalculatedFormulation[];
}

// ─── Strings ────────────────────────────────────────────────────────────────

const S = {
  title: { ar: 'حاسبة جرعة الأطفال', en: 'Paediatric Dose Calculator' },
  searchPlaceholder: { ar: 'ابحث عن الدواء...', en: 'Search for drug...' },
  noResults: { ar: 'لا توجد نتائج', en: 'No results' },
  loading: { ar: 'جاري البحث...', en: 'Searching...' },
  formula: { ar: 'المعادلة', en: 'Formula' },
  perDose: { ar: 'لكل جرعة', en: 'Per dose' },
  daily: { ar: 'يومياً', en: 'Daily' },
  minDose: { ar: 'الحد الأدنى', en: 'Minimum' },
  maxDose: { ar: 'الحد الأقصى', en: 'Maximum' },
  maxSingleDose: { ar: 'أقصى جرعة واحدة', en: 'Max single dose' },
  maxDailyDose: { ar: 'أقصى جرعة يومية', en: 'Max daily dose' },
  capped: { ar: '(محددة)', en: '(capped)' },
  copyToPrescription: { ar: 'نسخ للروشتة', en: 'Copy to prescription' },
  notSuitable: { ar: 'غير مناسب لهذا الوزن', en: 'Not suitable for this weight' },
  noMatch: { ar: 'لا يوجد دواء مطابق', en: 'No matching drug' },
  weight: { ar: 'الوزن', en: 'Weight' },
  age: { ar: 'العمر', en: 'Age' },
  months: { ar: 'شهر', en: 'months' },
  formulations: { ar: 'التركيزات المتاحة', en: 'Available formulations' },
} as const;

function frequencyText(dosesPerDay: number): { ar: string; en: string } {
  const map: Record<number, { ar: string; en: string }> = {
    1: { ar: 'مرة واحدة يومياً', en: 'Once daily' },
    2: { ar: 'مرتين يومياً', en: 'Twice daily' },
    3: { ar: '3 مرات يومياً', en: '3 times daily' },
    4: { ar: '4 مرات يومياً', en: '4 times daily' },
    6: { ar: '6 مرات يومياً', en: '6 times daily' },
  };
  return map[dosesPerDay] ?? { ar: `${dosesPerDay} مرات يومياً`, en: `${dosesPerDay} times daily` };
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function PaediatricDoseCalculator({
  weightKg,
  ageMonths,
  onCopyToPrescription,
  apiBaseUrl,
}: PaediatricDoseCalculatorProps) {
  const { lang } = useLang();
  const isRtl = lang === 'ar';
  const str = useCallback((key: keyof typeof S) => S[key][lang], [lang]);

  const [allDrugs, setAllDrugs] = useState<DrugListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDrug, setSelectedDrug] = useState<DrugListItem | null>(null);
  const [calculated, setCalculated] = useState<CalculatedDose[]>([]);
  const [calcLoading, setCalcLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Load drug list on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/doctor/paediatric-dose`);
        if (res.ok) {
          const json = await res.json();
          setAllDrugs(json.drugs ?? []);
        }
      } catch {
        // Silent
      }
    })();
  }, [apiBaseUrl]);

  const filteredDrugs = searchQuery.length >= 1
    ? allDrugs.filter(
        (d) =>
          d.drug_name_ar.includes(searchQuery) ||
          d.drug_name_en.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allDrugs;

  const handleSelectDrug = useCallback(async (drug: DrugListItem) => {
    setSelectedDrug(drug);
    setSearchQuery(lang === 'ar' ? drug.drug_name_ar : drug.drug_name_en);
    setShowDropdown(false);
    setCalcLoading(true);

    try {
      const res = await fetch(
        `${apiBaseUrl}/api/doctor/paediatric-dose?drug_name=${encodeURIComponent(drug.drug_name_en)}&weight_kg=${weightKg}&age_months=${ageMonths}`
      );
      if (res.ok) {
        const json = await res.json();
        setCalculated(json.calculated ?? []);
      }
    } catch {
      setCalculated([]);
    } finally {
      setCalcLoading(false);
    }
  }, [weightKg, ageMonths, lang, apiBaseUrl]);

  const handleCopy = (dose: CalculatedDose, formulation?: CalculatedFormulation) => {
    const freq = frequencyText(dose.dosesPerDay);
    const doseStr = formulation && formulation.isSuitable && formulation.maxVolumePerDose
      ? `${formulation.minVolumePerDose}–${formulation.maxVolumePerDose} ${formulation.volumeUnit} (${dose.cappedMinPerDose}–${dose.cappedMaxPerDose} mg)`
      : `${dose.cappedMinPerDose}–${dose.cappedMaxPerDose} mg`;

    onCopyToPrescription({
      drugNameAr: dose.drugNameAr,
      drugNameEn: dose.drugNameEn,
      dose: doseStr,
      frequencyAr: freq.ar,
      frequencyEn: freq.en,
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🧮</Text>
        <Text style={[styles.headerTitle, isRtl && styles.rtlText]}>{str('title')}</Text>
      </View>

      {/* Patient info bar */}
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>
          {str('weight')}: <Text style={styles.infoBold}>{weightKg} kg</Text>
        </Text>
        <Text style={styles.infoDivider}>|</Text>
        <Text style={styles.infoText}>
          {str('age')}: <Text style={styles.infoBold}>{ageMonths} {str('months')}</Text>
        </Text>
      </View>

      {/* Search */}
      <TextInput
        style={[styles.searchInput, isRtl && styles.rtlText]}
        placeholder={str('searchPlaceholder')}
        placeholderTextColor="#9CA3AF"
        value={searchQuery}
        onChangeText={(text) => {
          setSearchQuery(text);
          setShowDropdown(true);
          setSelectedDrug(null);
          setCalculated([]);
        }}
        onFocus={() => setShowDropdown(true)}
        textAlign={isRtl ? 'right' : 'left'}
      />

      {/* Dropdown */}
      {showDropdown && !selectedDrug && filteredDrugs.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={filteredDrugs.slice(0, 15)}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => handleSelectDrug(item)}
              >
                <Text style={[styles.drugNameAr, isRtl && styles.rtlText]}>
                  {item.drug_name_ar}
                </Text>
                <Text style={styles.drugNameEn}>{item.drug_name_en}</Text>
                {item.indication_ar && (
                  <Text style={[styles.indication, isRtl && styles.rtlText]}>
                    {item.indication_ar}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Loading */}
      {calcLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#0D9488" />
          <Text style={styles.loadingText}>{str('loading')}</Text>
        </View>
      )}

      {/* No match */}
      {!calcLoading && selectedDrug && calculated.length === 0 && (
        <View style={styles.noMatchContainer}>
          <Text style={[styles.noMatchText, isRtl && styles.rtlText]}>{str('noMatch')}</Text>
        </View>
      )}

      {/* Results */}
      {!calcLoading && calculated.map((dose) => (
        <View key={dose.drugId} style={styles.resultCard}>
          {/* Drug name */}
          <View style={styles.resultHeader}>
            <Text style={[styles.resultDrugAr, isRtl && styles.rtlText]}>{dose.drugNameAr}</Text>
            <Text style={styles.resultDrugEn}>{dose.drugNameEn}</Text>
            {dose.indicationAr && (
              <Text style={[styles.resultIndication, isRtl && styles.rtlText]}>
                {dose.indicationAr}
              </Text>
            )}
          </View>

          {/* Formula — shown prominently */}
          <View style={styles.formulaBox}>
            <Text style={[styles.formulaLabel, isRtl && styles.rtlText]}>{str('formula')}</Text>
            <Text style={styles.formulaValue}>{dose.formulaDescription}</Text>
          </View>

          {/* Dose range */}
          <View style={styles.doseRow}>
            <View style={styles.doseCol}>
              <Text style={[styles.doseLabel, isRtl && styles.rtlText]}>
                {str('minDose')} ({str('perDose')})
              </Text>
              <Text style={styles.doseValue}>{dose.cappedMinPerDose} mg</Text>
            </View>
            <View style={styles.doseCol}>
              <Text style={[styles.doseLabel, isRtl && styles.rtlText]}>
                {str('maxDose')} ({str('perDose')})
              </Text>
              <Text style={styles.doseValue}>{dose.cappedMaxPerDose} mg</Text>
            </View>
          </View>

          {/* Daily total */}
          <View style={styles.dailyRow}>
            <Text style={[styles.dailyText, isRtl && styles.rtlText]}>
              {str('daily')}: {dose.cappedMinDaily}–{dose.cappedMaxDaily} mg
            </Text>
            <Text style={[styles.frequencyText, isRtl && styles.rtlText]}>
              {frequencyText(dose.dosesPerDay)[lang]}
            </Text>
          </View>

          {/* Caps */}
          {dose.maxSingleDoseMg && (
            <Text style={[styles.capText, isRtl && styles.rtlText]}>
              {str('maxSingleDose')}: {dose.maxSingleDoseMg} mg
            </Text>
          )}
          {dose.maxDailyDoseMg && (
            <Text style={[styles.capText, isRtl && styles.rtlText]}>
              {str('maxDailyDose')}: {dose.maxDailyDoseMg} mg
            </Text>
          )}

          {/* Formulations */}
          {dose.formulations.length > 0 && (
            <View style={styles.formulationsSection}>
              <Text style={[styles.formulationsTitle, isRtl && styles.rtlText]}>
                {str('formulations')}
              </Text>
              {dose.formulations.map((f, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.formulationCard,
                    f.isSuitable ? styles.formulationSuitable : styles.formulationNotSuitable,
                  ]}
                >
                  <View style={styles.formulationHeader}>
                    <View>
                      <Text style={styles.formulationForm}>{f.form}</Text>
                      <Text style={styles.formulationConcentration}>{f.concentration}</Text>
                    </View>
                    {f.isSuitable && f.minVolumePerDose !== null && f.maxVolumePerDose !== null ? (
                      <View style={styles.formulationDose}>
                        <Text style={styles.formulationVolume}>
                          {f.minVolumePerDose === f.maxVolumePerDose
                            ? `${f.maxVolumePerDose} ${f.volumeUnit}`
                            : `${f.minVolumePerDose}–${f.maxVolumePerDose} ${f.volumeUnit}`
                          }
                        </Text>
                        <Text style={[styles.formulationPerDose, isRtl && styles.rtlText]}>
                          {str('perDose')}
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.notSuitableText, isRtl && styles.rtlText]}>
                        {str('notSuitable')}
                      </Text>
                    )}
                  </View>

                  {f.isSuitable && (
                    <TouchableOpacity
                      style={styles.copyButtonSmall}
                      onPress={() => handleCopy(dose, f)}
                    >
                      <Text style={[styles.copyButtonSmallText, isRtl && styles.rtlText]}>
                        {str('copyToPrescription')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Underlying calculation */}
          <Text style={styles.calculationText}>
            {weightKg} kg × {dose.formulaDescription} → {dose.minDosePerDose}–{dose.maxDosePerDose} mg/dose
          </Text>

          {/* Notes */}
          {dose.notesAr && (
            <View style={styles.notesBox}>
              <Text style={[styles.notesText, isRtl && styles.rtlText]}>{dose.notesAr}</Text>
            </View>
          )}

          {/* Main copy button */}
          <TouchableOpacity
            style={styles.copyButton}
            onPress={() => handleCopy(dose)}
          >
            <Text style={[styles.copyButtonText, isRtl && styles.rtlText]}>
              {str('copyToPrescription')}
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#99F6E4',
    backgroundColor: '#F0FDFA',
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    fontSize: 18,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#115E59',
    fontFamily: 'Cairo',
  },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#CCFBF1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#0F766E',
    fontFamily: 'Cairo',
  },
  infoBold: {
    fontWeight: '700',
  },
  infoDivider: {
    color: '#5EEAD4',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Cairo',
    backgroundColor: '#FFF',
  },
  dropdown: {
    maxHeight: 200,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  drugNameAr: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Cairo',
  },
  drugNameEn: {
    fontSize: 12,
    color: '#6B7280',
  },
  indication: {
    fontSize: 11,
    color: '#0D9488',
    fontFamily: 'Cairo',
    marginTop: 2,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#0D9488',
    fontFamily: 'Cairo',
  },
  noMatchContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  noMatchText: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Cairo',
  },
  resultCard: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    gap: 10,
    paddingBottom: 12,
  },
  resultHeader: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  resultDrugAr: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Cairo',
  },
  resultDrugEn: {
    fontSize: 12,
    color: '#6B7280',
  },
  resultIndication: {
    fontSize: 11,
    color: '#0D9488',
    fontFamily: 'Cairo',
    marginTop: 2,
  },
  formulaBox: {
    marginHorizontal: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  formulaLabel: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '600',
    fontFamily: 'Cairo',
    marginBottom: 2,
  },
  formulaValue: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#1E3A5F',
  },
  doseRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 12,
  },
  doseCol: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 8,
  },
  doseLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontFamily: 'Cairo',
  },
  doseValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  dailyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 12,
  },
  dailyText: {
    fontSize: 11,
    color: '#6B7280',
    fontFamily: 'Cairo',
  },
  frequencyText: {
    fontSize: 11,
    color: '#6B7280',
    fontFamily: 'Cairo',
  },
  capText: {
    fontSize: 11,
    color: '#D97706',
    fontFamily: 'Cairo',
    marginHorizontal: 12,
  },
  formulationsSection: {
    marginHorizontal: 12,
    gap: 6,
  },
  formulationsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Cairo',
  },
  formulationCard: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  formulationSuitable: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  formulationNotSuitable: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    opacity: 0.6,
  },
  formulationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  formulationForm: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  formulationConcentration: {
    fontSize: 11,
    color: '#6B7280',
  },
  formulationDose: {
    alignItems: 'flex-end',
  },
  formulationVolume: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
  },
  formulationPerDose: {
    fontSize: 10,
    color: '#16A34A',
    fontFamily: 'Cairo',
  },
  notSuitableText: {
    fontSize: 11,
    color: '#DC2626',
    fontFamily: 'Cairo',
  },
  copyButtonSmall: {
    backgroundColor: '#CCFBF1',
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
  },
  copyButtonSmallText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F766E',
    fontFamily: 'Cairo',
  },
  calculationText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#9CA3AF',
    marginHorizontal: 12,
    borderTopWidth: 0.5,
    borderTopColor: '#F3F4F6',
    paddingTop: 6,
  },
  notesBox: {
    marginHorizontal: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  notesText: {
    fontSize: 11,
    color: '#92400E',
    fontFamily: 'Cairo',
  },
  copyButton: {
    marginHorizontal: 12,
    borderWidth: 2,
    borderColor: '#0D9488',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D9488',
    fontFamily: 'Cairo',
  },
  rtlText: {
    textAlign: I18nManager.isRTL ? 'right' : 'left',
    writingDirection: 'rtl',
  },
});
