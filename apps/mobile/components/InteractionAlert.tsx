/**
 * InteractionAlert — Mobile Drug Interaction Warning Panel (React Native)
 *
 * Separate implementation from web — does NOT share code with Next.js.
 *
 * Three visual tiers:
 * - Contraindicated/Major (RED): blocking, requires override reason or drug removal
 * - Moderate (YELLOW): non-blocking, acknowledgement required
 * - Minor (GRAY): info-only, no action required
 *
 * Fully bilingual (Arabic / English) via lang prop.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  I18nManager,
} from 'react-native';
import type { InteractionResult, InteractionSeverity } from '@triaji/shared/types';

// ─── Types ──────────────────────────────────────────────────────────────────

type Lang = 'ar' | 'en';

interface InteractionAlertProps {
  interactions: InteractionResult[];
  lang: Lang;
  onRemoveDrug: (drugName: string) => void;
  onOverride: (drugName: string, reason: string) => void;
  onAcknowledge: (drugName: string) => void;
}

// ─── Strings ────────────────────────────────────────────────────────────────

const INTERACTION_STRINGS = {
  severityLabels: {
    contraindicated: { ar: 'ممنوع الجمع', en: 'Contraindicated' },
    major: { ar: 'تفاعل خطير', en: 'Major Interaction' },
    moderate: { ar: 'تفاعل متوسط', en: 'Moderate Interaction' },
    minor: { ar: 'تفاعل بسيط', en: 'Minor Interaction' },
  },
  mechanism: { ar: 'الآلية:', en: 'Mechanism:' },
  consequence: { ar: 'العاقبة:', en: 'Consequence:' },
  recommendation: { ar: 'التوصية:', en: 'Recommendation:' },
  egyptNote: { ar: 'ملاحظة مصر:', en: 'Egypt Note:' },
  removeDrug: { ar: 'إزالة الدواء', en: 'Remove Drug' },
  overrideWithNote: { ar: 'متابعة مع التوثيق', en: 'Override with Note' },
  overridePlaceholder: {
    ar: 'سبب المتابعة رغم التفاعل (إلزامي)...',
    en: 'Reason for proceeding despite interaction (required)...',
  },
  acknowledge: {
    ar: 'حسناً، سأراعي ذلك',
    en: "Understood, I'll monitor",
  },
  interactionBetween: { ar: 'تفاعل بين', en: 'Interaction between' },
  and: { ar: 'و', en: 'and' },
  blockingWarningTitle: {
    ar: 'تحذير: تفاعل دوائي خطير',
    en: 'Warning: Serious Drug Interaction',
  },
  moderateWarningTitle: {
    ar: 'تنبيه: تفاعل دوائي متوسط',
    en: 'Notice: Moderate Drug Interaction',
  },
  minorNoteTitle: {
    ar: 'ملاحظة دوائية',
    en: 'Drug Note',
  },
} as const;

function str(key: keyof typeof INTERACTION_STRINGS, lang: Lang): string {
  const val = INTERACTION_STRINGS[key];
  if (typeof val === 'object' && 'ar' in val && 'en' in val) {
    return val[lang] as string;
  }
  return '';
}

function severityLabel(severity: InteractionSeverity, lang: Lang): string {
  return INTERACTION_STRINGS.severityLabels[severity][lang];
}

// ─── Severity Helpers ───────────────────────────────────────────────────────

function isBlocking(severity: InteractionSeverity): boolean {
  return severity === 'contraindicated' || severity === 'major';
}

function isModerate(severity: InteractionSeverity): boolean {
  return severity === 'moderate';
}

// ─── Color Themes ───────────────────────────────────────────────────────────

const TIER_COLORS = {
  blocking: {
    bg: '#FEF2F2',
    border: '#FECACA',
    headerBg: '#FEE2E2',
    headerText: '#991B1B',
    bodyText: '#7F1D1D',
    labelText: '#B91C1C',
    btnPrimary: '#DC2626',
    btnPrimaryText: '#FFFFFF',
    btnSecondary: '#FCA5A5',
    btnSecondaryText: '#991B1B',
    badge: '#FEE2E2',
    badgeText: '#991B1B',
  },
  moderate: {
    bg: '#FFFBEB',
    border: '#FDE68A',
    headerBg: '#FEF3C7',
    headerText: '#92400E',
    bodyText: '#78350F',
    labelText: '#B45309',
    btnPrimary: '#F59E0B',
    btnPrimaryText: '#FFFFFF',
    btnSecondary: '#FDE68A',
    btnSecondaryText: '#92400E',
    badge: '#FEF3C7',
    badgeText: '#92400E',
  },
  minor: {
    bg: '#F9FAFB',
    border: '#E5E7EB',
    headerBg: '#F3F4F6',
    headerText: '#374151',
    bodyText: '#4B5563',
    labelText: '#6B7280',
    btnPrimary: '#9CA3AF',
    btnPrimaryText: '#FFFFFF',
    btnSecondary: '#E5E7EB',
    btnSecondaryText: '#374151',
    badge: '#F3F4F6',
    badgeText: '#6B7280',
  },
};

function getTierColors(severity: InteractionSeverity) {
  if (isBlocking(severity)) return TIER_COLORS.blocking;
  if (isModerate(severity)) return TIER_COLORS.moderate;
  return TIER_COLORS.minor;
}

// ─── Blocking Interaction Card ──────────────────────────────────────────────

function BlockingInteractionCard({
  interaction,
  lang,
  onRemoveDrug,
  onOverride,
}: {
  interaction: InteractionResult;
  lang: Lang;
  onRemoveDrug: (drugName: string) => void;
  onOverride: (drugName: string, reason: string) => void;
}) {
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverride, setShowOverride] = useState(false);
  const colors = getTierColors(interaction.severity);
  const isRtl = lang === 'ar';

  const handleOverride = useCallback(() => {
    if (overrideReason.trim().length > 0) {
      onOverride(interaction.drugA, overrideReason.trim());
    }
  }, [overrideReason, interaction.drugA, onOverride]);

  return (
    <View style={[styles.card, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <Text style={[styles.headerIcon]}>🚫</Text>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, { color: colors.headerText }, isRtl && styles.rtlText]}>
            {str('blockingWarningTitle', lang)}
          </Text>
          <View style={[styles.badge, { backgroundColor: colors.badge }]}>
            <Text style={[styles.badgeText, { color: colors.badgeText }]}>
              {severityLabel(interaction.severity, lang)}
            </Text>
          </View>
        </View>
      </View>

      {/* Drug pair */}
      <View style={styles.body}>
        <Text style={[styles.drugPair, { color: colors.bodyText }, isRtl && styles.rtlText]}>
          {interaction.drugA} + {interaction.drugB}
        </Text>

        {/* Details */}
        {interaction.mechanismAr && (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.labelText }, isRtl && styles.rtlText]}>
              {str('mechanism', lang)}
            </Text>
            <Text style={[styles.detailValue, { color: colors.bodyText }, isRtl && styles.rtlText]}>
              {lang === 'ar' ? interaction.mechanismAr : interaction.mechanismEn}
            </Text>
          </View>
        )}

        {interaction.recommendationAr && (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.labelText }, isRtl && styles.rtlText]}>
              {str('recommendation', lang)}
            </Text>
            <Text style={[styles.detailValue, { color: colors.bodyText }, isRtl && styles.rtlText]}>
              {lang === 'ar' ? interaction.recommendationAr : interaction.recommendationEn}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.btnPrimary }]}
            onPress={() => onRemoveDrug(interaction.drugA)}
            activeOpacity={0.7}
          >
            <Text style={[styles.btnText, { color: colors.btnPrimaryText }]}>
              {str('removeDrug', lang)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnOutline, { borderColor: colors.btnPrimary }]}
            onPress={() => setShowOverride(!showOverride)}
            activeOpacity={0.7}
          >
            <Text style={[styles.btnText, { color: colors.btnPrimary }]}>
              {str('overrideWithNote', lang)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Override reason input */}
        {showOverride && (
          <View style={styles.overrideSection}>
            <TextInput
              style={[styles.overrideInput, isRtl && styles.rtlText]}
              placeholder={str('overridePlaceholder', lang)}
              placeholderTextColor="#9CA3AF"
              value={overrideReason}
              onChangeText={setOverrideReason}
              multiline
              textAlign={isRtl ? 'right' : 'left'}
            />
            <TouchableOpacity
              style={[
                styles.btn,
                {
                  backgroundColor:
                    overrideReason.trim().length > 0 ? colors.btnPrimary : '#D1D5DB',
                },
              ]}
              onPress={handleOverride}
              disabled={overrideReason.trim().length === 0}
              activeOpacity={0.7}
            >
              <Text style={[styles.btnText, { color: colors.btnPrimaryText }]}>
                {str('overrideWithNote', lang)}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Moderate Interaction Card ──────────────────────────────────────────────

function ModerateInteractionCard({
  interaction,
  lang,
  onAcknowledge,
}: {
  interaction: InteractionResult;
  lang: Lang;
  onAcknowledge: (drugName: string) => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const colors = getTierColors(interaction.severity);
  const isRtl = lang === 'ar';

  const handleAcknowledge = useCallback(() => {
    setAcknowledged(true);
    onAcknowledge(interaction.drugA);
  }, [interaction.drugA, onAcknowledge]);

  return (
    <View style={[styles.card, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <Text style={styles.headerIcon}>⚠️</Text>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, { color: colors.headerText }, isRtl && styles.rtlText]}>
            {str('moderateWarningTitle', lang)}
          </Text>
          <View style={[styles.badge, { backgroundColor: colors.badge }]}>
            <Text style={[styles.badgeText, { color: colors.badgeText }]}>
              {severityLabel(interaction.severity, lang)}
            </Text>
          </View>
        </View>
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={[styles.drugPair, { color: colors.bodyText }, isRtl && styles.rtlText]}>
          {interaction.drugA} + {interaction.drugB}
        </Text>

        {interaction.mechanismAr && (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.labelText }, isRtl && styles.rtlText]}>
              {str('mechanism', lang)}
            </Text>
            <Text style={[styles.detailValue, { color: colors.bodyText }, isRtl && styles.rtlText]}>
              {lang === 'ar' ? interaction.mechanismAr : interaction.mechanismEn}
            </Text>
          </View>
        )}

        {interaction.recommendationAr && (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.labelText }, isRtl && styles.rtlText]}>
              {str('recommendation', lang)}
            </Text>
            <Text style={[styles.detailValue, { color: colors.bodyText }, isRtl && styles.rtlText]}>
              {lang === 'ar' ? interaction.recommendationAr : interaction.recommendationEn}
            </Text>
          </View>
        )}

        {/* Acknowledge */}
        {!acknowledged ? (
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.btnPrimary, marginTop: 12 }]}
            onPress={handleAcknowledge}
            activeOpacity={0.7}
          >
            <Text style={[styles.btnText, { color: colors.btnPrimaryText }]}>
              {str('acknowledge', lang)}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.acknowledgedBadge, { backgroundColor: colors.badge }]}>
            <Text style={[styles.acknowledgedText, { color: colors.badgeText }]}>
              ✓ {str('acknowledge', lang)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Minor Interaction Card ─────────────────────────────────────────────────

function MinorInteractionCard({
  interaction,
  lang,
}: {
  interaction: InteractionResult;
  lang: Lang;
}) {
  const colors = getTierColors(interaction.severity);
  const isRtl = lang === 'ar';

  return (
    <View style={[styles.card, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <Text style={styles.headerIcon}>ℹ️</Text>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, { color: colors.headerText }, isRtl && styles.rtlText]}>
            {str('minorNoteTitle', lang)}
          </Text>
          <View style={[styles.badge, { backgroundColor: colors.badge }]}>
            <Text style={[styles.badgeText, { color: colors.badgeText }]}>
              {severityLabel(interaction.severity, lang)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={[styles.drugPair, { color: colors.bodyText }, isRtl && styles.rtlText]}>
          {interaction.drugA} + {interaction.drugB}
        </Text>

        {interaction.mechanismAr && (
          <Text style={[styles.detailValue, { color: colors.bodyText, marginTop: 4 }, isRtl && styles.rtlText]}>
            {lang === 'ar' ? interaction.mechanismAr : interaction.mechanismEn}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function InteractionAlert({
  interactions,
  lang,
  onRemoveDrug,
  onOverride,
  onAcknowledge,
}: InteractionAlertProps) {
  if (interactions.length === 0) return null;

  // Sort: blocking first, then moderate, then minor
  const sorted = [...interactions].sort((a, b) => {
    const order: Record<InteractionSeverity, number> = {
      contraindicated: 0,
      major: 1,
      moderate: 2,
      minor: 3,
    };
    return order[a.severity] - order[b.severity];
  });

  return (
    <View style={styles.container}>
      {sorted.map((ix, idx) => {
        if (isBlocking(ix.severity)) {
          return (
            <BlockingInteractionCard
              key={`${ix.drugA}-${ix.drugB}-${idx}`}
              interaction={ix}
              lang={lang}
              onRemoveDrug={onRemoveDrug}
              onOverride={onOverride}
            />
          );
        }

        if (isModerate(ix.severity)) {
          return (
            <ModerateInteractionCard
              key={`${ix.drugA}-${ix.drugB}-${idx}`}
              interaction={ix}
              lang={lang}
              onAcknowledge={onAcknowledge}
            />
          );
        }

        return (
          <MinorInteractionCard
            key={`${ix.drugA}-${ix.drugB}-${idx}`}
            interaction={ix}
            lang={lang}
          />
        );
      })}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  headerIcon: {
    fontSize: 20,
  },
  headerTextWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  body: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  drugPair: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 8,
  },
  detailRow: {
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 1,
  },
  detailValue: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Cairo',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  overrideSection: {
    marginTop: 12,
    gap: 10,
  },
  overrideInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    fontFamily: 'Cairo',
    minHeight: 72,
    textAlignVertical: 'top',
    backgroundColor: '#FFFFFF',
  },
  acknowledgedBadge: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  acknowledgedText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
