/**
 * Records Tab — Health records (prescriptions, lab results) with upload.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useLang } from '@/hooks/useLang';
import { isAuthenticated } from '@/lib/storage';
import { api } from '@/lib/api';
import { s } from '@triaji/shared/i18n';
import type { HealthRecordSummary } from '@triaji/shared/api';

type RecordType = 'prescription' | 'lab_result' | 'radiology' | 'medical_report' | 'other';

const RECORD_TYPE_LABELS: Record<RecordType, { ar: string; en: string }> = {
  prescription: { ar: 'روشتة', en: 'Prescription' },
  lab_result: { ar: 'تحليل', en: 'Lab Result' },
  radiology: { ar: 'أشعة', en: 'Radiology' },
  medical_report: { ar: 'تقرير طبي', en: 'Medical Report' },
  other: { ar: 'مستند آخر', en: 'Other Document' },
};

const RECORD_TYPE_ICONS: Record<RecordType, string> = {
  prescription: '💊',
  lab_result: '🧪',
  radiology: '🩻',
  medical_report: '📋',
  other: '📄',
};

export default function RecordsScreen() {
  const { lang, isRtl } = useLang();
  const [records, setRecords] = useState<HealthRecordSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchRecords = useCallback(async () => {
    if (!isAuthenticated()) {
      setLoading(false);
      return;
    }
    try {
      const result = await api.getRecords();
      setRecords(result.records);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleUpload = async () => {
    const typeOptions: { label: string; value: RecordType }[] = [
      { label: RECORD_TYPE_LABELS.prescription[lang], value: 'prescription' },
      { label: RECORD_TYPE_LABELS.lab_result[lang], value: 'lab_result' },
      { label: RECORD_TYPE_LABELS.radiology[lang], value: 'radiology' },
      { label: RECORD_TYPE_LABELS.medical_report[lang], value: 'medical_report' },
      { label: RECORD_TYPE_LABELS.other[lang], value: 'other' },
    ];

    Alert.alert(
      lang === 'ar' ? 'نوع المستند' : 'Document Type',
      lang === 'ar' ? 'اختر نوع المستند' : 'Select document type',
      [
        ...typeOptions.map((opt) => ({
          text: opt.label,
          onPress: () => pickAndUpload(opt.value),
        })),
        { text: s.common.cancel[lang], style: 'cancel' as const },
      ]
    );
  };

  const pickAndUpload = async (recordType: RecordType) => {
    Alert.alert(
      lang === 'ar' ? 'مصدر الملف' : 'File Source',
      '',
      [
        {
          text: lang === 'ar' ? '📷 كاميرا' : '📷 Camera',
          onPress: () => uploadFromCamera(recordType),
        },
        {
          text: lang === 'ar' ? '🖼 معرض الصور' : '🖼 Photo Library',
          onPress: () => uploadFromGallery(recordType),
        },
        {
          text: lang === 'ar' ? '📄 ملف' : '📄 File',
          onPress: () => uploadFromFiles(recordType),
        },
        { text: s.common.cancel[lang], style: 'cancel' as const },
      ]
    );
  };

  const uploadFromCamera = async (recordType: RecordType) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      await doUpload(
        { uri: asset.uri, name: 'photo.jpg', type: asset.mimeType ?? 'image/jpeg' },
        recordType
      );
    }
  };

  const uploadFromGallery = async (recordType: RecordType) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      await doUpload(
        { uri: asset.uri, name: asset.fileName ?? 'photo.jpg', type: asset.mimeType ?? 'image/jpeg' },
        recordType
      );
    }
  };

  const uploadFromFiles = async (recordType: RecordType) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      await doUpload(
        { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' },
        recordType
      );
    }
  };

  const doUpload = async (
    file: { uri: string; name: string; type: string },
    recordType: RecordType
  ) => {
    setUploading(true);
    try {
      await api.uploadRecord(file, recordType);
      await fetchRecords();
    } catch {
      Alert.alert(s.common.error[lang], s.common.tryAgain[lang]);
    } finally {
      setUploading(false);
    }
  };

  if (!isAuthenticated()) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyTitle, isRtl && styles.textRtl]}>
          {s.history.loginRequired[lang]}
        </Text>
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => router.push('/(auth)/otp')}
        >
          <Text style={styles.loginBtnText}>{s.login.title[lang]}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0D7A7A" />
      </View>
    );
  }

  const renderRecord = ({ item }: { item: HealthRecordSummary }) => {
    const type = item.record_type as RecordType;
    const icon = RECORD_TYPE_ICONS[type] ?? '📄';
    const label = RECORD_TYPE_LABELS[type]?.[lang] ?? item.record_type;
    const summary = lang === 'ar' ? item.summary_ar : (item.summary_en ?? item.summary_ar);

    return (
      <View style={styles.recordCard}>
        <View style={[styles.recordHeader, isRtl && styles.rowRtl]}>
          <Text style={styles.recordIcon}>{icon}</Text>
          <View style={styles.recordInfo}>
            <Text style={[styles.recordType, isRtl && styles.textRtl]}>
              {label}
            </Text>
            <Text style={[styles.recordDate, isRtl && styles.textRtl]}>
              {new Date(item.uploaded_at).toLocaleDateString(
                lang === 'ar' ? 'ar-EG' : 'en-US'
              )}
            </Text>
          </View>
          {item.has_abnormal_values && (
            <View style={styles.abnormalBadge}>
              <Text style={styles.abnormalText}>⚠️</Text>
            </View>
          )}
        </View>

        {summary && (
          <Text
            style={[styles.recordSummary, isRtl && styles.textRtl]}
            numberOfLines={3}
          >
            {summary}
          </Text>
        )}

        {!item.analysed && (
          <View style={styles.analysingBadge}>
            <ActivityIndicator size="small" color="#0D7A7A" />
            <Text style={styles.analysingText}>
              {lang === 'ar' ? 'جاري التحليل...' : 'Analysing...'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRtl && styles.textRtl]}>
          {lang === 'ar' ? 'التحاليل والروشتات' : 'Records & Prescriptions'}
        </Text>
      </View>

      {uploading && (
        <View style={styles.uploadingBar}>
          <ActivityIndicator size="small" color="#FFF" />
          <Text style={styles.uploadingText}>
            {lang === 'ar' ? 'جاري الرفع...' : 'Uploading...'}
          </Text>
        </View>
      )}

      {records.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={[styles.emptyTitle, isRtl && styles.textRtl]}>
            {lang === 'ar' ? 'لا يوجد سجلات بعد' : 'No records yet'}
          </Text>
          <Text style={[styles.emptyDesc, isRtl && styles.textRtl]}>
            {lang === 'ar'
              ? 'ارفع روشتة أو تحليل لتتبع سجلك الطبي'
              : 'Upload a prescription or lab result to track your medical records'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          renderItem={renderRecord}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchRecords();
              }}
              tintColor="#0D7A7A"
            />
          }
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={handleUpload}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
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
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Cairo-Bold',
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
  uploadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D7A7A',
    paddingVertical: 8,
    gap: 8,
  },
  uploadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Cairo',
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  recordIcon: {
    fontSize: 28,
  },
  recordInfo: {
    flex: 1,
  },
  recordType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
  },
  recordDate: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'Cairo',
  },
  abnormalBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  abnormalText: {
    fontSize: 16,
  },
  recordSummary: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    fontFamily: 'Cairo',
  },
  analysingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#E0F2F1',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  analysingText: {
    fontSize: 13,
    color: '#0D7A7A',
    fontFamily: 'Cairo',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A2F4A',
    marginBottom: 8,
    fontFamily: 'Cairo-SemiBold',
  },
  emptyDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'Cairo',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0D7A7A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabIcon: {
    fontSize: 32,
    color: '#FFFFFF',
    lineHeight: 34,
  },
  loginBtn: {
    backgroundColor: '#0D7A7A',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 16,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
});
