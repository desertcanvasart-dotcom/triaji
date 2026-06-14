/**
 * Lab Results Detail — individual lab result view with test values,
 * reference ranges, color coding, PDF download, and share.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useLang } from '@/hooks/useLang';
import { api } from '@/lib/api';
import { s } from '@triaji/shared/i18n';

interface TestValue {
  name: string;
  value: number;
  unit: string;
  referenceMin: number;
  referenceMax: number;
  status: 'normal' | 'abnormal' | 'borderline';
}

interface LabResultDetail {
  id: string;
  labName: string;
  date: string;
  orderedBy?: string;
  pdfUrl?: string;
  tests: TestValue[];
}

export default function LabResultDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { lang, isRtl } = useLang();
  const [result, setResult] = useState<LabResultDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const fetchResult = useCallback(async () => {
    try {
      const data = await api.get(`/api/patient/labs/${id}`);
      setResult(data as LabResultDetail);
    } catch {
      Alert.alert(s.common.error[lang]);
    } finally {
      setLoading(false);
    }
  }, [id, lang]);

  useEffect(() => {
    fetchResult();
  }, [fetchResult]);

  const handleDownloadPdf = useCallback(async () => {
    if (!result?.pdfUrl) return;
    setDownloading(true);
    try {
      const filename = `lab-result-${result.id}.pdf`;
      const fileUri = FileSystem.documentDirectory + filename;
      const download = await FileSystem.downloadAsync(result.pdfUrl, fileUri);
      if (download.status === 200) {
        await Sharing.shareAsync(download.uri);
      } else {
        Alert.alert(s.common.error[lang]);
      }
    } catch {
      Alert.alert(s.common.error[lang]);
    } finally {
      setDownloading(false);
    }
  }, [result, lang]);

  const handleShareWithDoctor = useCallback(async () => {
    try {
      await api.post(`/api/patient/labs/${id}/share`, {});
      Alert.alert(s.mobileLabs.shareWithDoctor[lang]);
    } catch {
      Alert.alert(s.common.error[lang]);
    }
  }, [id, lang]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0D7A7A" />
      </View>
    );
  }

  if (!result) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{s.common.error[lang]}</Text>
      </View>
    );
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(
      lang === 'ar' ? 'ar-EG' : 'en-US',
      { day: 'numeric', month: 'long', year: 'numeric' }
    );

  const getStatusStyle = (status: string) => {
    if (status === 'normal') return { bg: '#E8F5E9', color: '#2E7D32' };
    if (status === 'borderline') return { bg: '#FFF8E1', color: '#E65100' };
    return { bg: '#FFEBEE', color: '#C62828' };
  };

  const getStatusLabel = (status: string) => {
    if (status === 'normal') return s.mobileLabs.normal[lang];
    if (status === 'borderline') return s.mobileLabs.borderline[lang];
    return s.mobileLabs.abnormal[lang];
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>{isRtl ? '\u203A' : '\u2039'}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isRtl && styles.textRtl]}>
          {result.labName}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Date & ordered by */}
        <View style={styles.infoSection}>
          <Text style={[styles.dateText, isRtl && styles.textRtl]}>
            {s.mobileLabs.date[lang]}: {formatDate(result.date)}
          </Text>
          {result.orderedBy && (
            <Text style={[styles.orderedBy, isRtl && styles.textRtl]}>
              {s.mobileLabs.orderedBy[lang]}: {result.orderedBy}
            </Text>
          )}
        </View>

        {/* Test results */}
        {result.tests.map((test, idx) => {
          const style = getStatusStyle(test.status);
          return (
            <View key={idx} style={[styles.testCard, { borderLeftColor: style.color }]}>
              <View style={[styles.testHeader, isRtl && styles.rowRtl]}>
                <Text style={[styles.testName, isRtl && styles.textRtl]}>{test.name}</Text>
                <View style={[styles.statusBadge, { backgroundColor: style.bg }]}>
                  <Text style={[styles.statusText, { color: style.color }]}>
                    {getStatusLabel(test.status)}
                  </Text>
                </View>
              </View>

              <View style={[styles.testValues, isRtl && styles.rowRtl]}>
                <View style={styles.valueBlock}>
                  <Text style={[styles.valueLabel, isRtl && styles.textRtl]}>
                    {s.mobileLabs.value[lang]}
                  </Text>
                  <Text style={[styles.valueNumber, { color: style.color }]}>
                    {test.value} {test.unit}
                  </Text>
                </View>
                <View style={styles.valueBlock}>
                  <Text style={[styles.valueLabel, isRtl && styles.textRtl]}>
                    {s.mobileLabs.referenceRange[lang]}
                  </Text>
                  <Text style={styles.referenceText}>
                    {test.referenceMin} - {test.referenceMax} {test.unit}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {result.pdfUrl && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleDownloadPdf}
              disabled={downloading}
              activeOpacity={0.7}
            >
              {downloading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.actionBtnText}>
                  {s.mobileLabs.downloadPdf[lang]}
                </Text>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={handleShareWithDoctor}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnTextSecondary}>
              {s.mobileLabs.shareWithDoctor[lang]}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#0D7A7A',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '300',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Cairo-Bold',
    flex: 1,
  },
  headerSpacer: {
    width: 40,
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#C62828',
    fontFamily: 'Cairo-SemiBold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  // Info section
  infoSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
  },
  orderedBy: {
    fontSize: 13,
    color: '#888',
    fontFamily: 'Cairo',
    marginTop: 4,
  },
  // Test cards
  testCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  testHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  testName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
    flex: 1,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  testValues: {
    flexDirection: 'row',
    gap: 24,
  },
  valueBlock: {
    flex: 1,
  },
  valueLabel: {
    fontSize: 11,
    color: '#999',
    fontFamily: 'Cairo',
    marginBottom: 2,
  },
  valueNumber: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
  referenceText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Cairo',
  },
  // Actions
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#0D7A7A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionBtnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0D7A7A',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
  actionBtnTextSecondary: {
    color: '#0D7A7A',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
});
