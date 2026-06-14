/**
 * VitalTrendChart — line chart for vital sign trends using Victory Native.
 * Falls back to a simple text list if Victory is unavailable.
 */

import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import type { Lang } from '@triaji/shared/i18n';

interface VitalDataPoint {
  date: string;
  value: number;
}

interface VitalTrendChartProps {
  data: VitalDataPoint[];
  label: string;
  unit: string;
  normalRange?: { min: number; max: number };
  lang: Lang;
}

let VictoryLine: any = null;
let VictoryChart: any = null;
let VictoryAxis: any = null;
let VictoryArea: any = null;
let VictoryTheme: any = null;

try {
  const victory = require('victory-native');
  VictoryLine = victory.VictoryLine;
  VictoryChart = victory.VictoryChart;
  VictoryAxis = victory.VictoryAxis;
  VictoryArea = victory.VictoryArea;
  VictoryTheme = victory.VictoryTheme;
} catch {
  // Victory not available — use fallback
}

const SCREEN_WIDTH = Dimensions.get('window').width;

function formatDate(dateStr: string, lang: Lang): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function ChartContent({
  data,
  label,
  unit,
  normalRange,
  lang,
  width,
  height,
}: VitalTrendChartProps & { width: number; height: number }) {
  const isRtl = lang === 'ar';

  if (!VictoryChart || !VictoryLine) {
    // Fallback: simple text list
    return (
      <View style={styles.fallbackContainer}>
        <Text style={[styles.fallbackTitle, isRtl && styles.textRtl]}>
          {label} ({unit})
        </Text>
        {data.map((point, idx) => (
          <View key={idx} style={[styles.fallbackRow, isRtl && styles.rowRtl]}>
            <Text style={styles.fallbackDate}>{formatDate(point.date, lang)}</Text>
            <Text
              style={[
                styles.fallbackValue,
                normalRange &&
                  (point.value < normalRange.min || point.value > normalRange.max) &&
                  styles.abnormalValue,
              ]}
            >
              {point.value} {unit}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  const chartData = data.map((d, i) => ({ x: i, y: d.value, label: formatDate(d.date, lang) }));

  return (
    <VictoryChart
      theme={VictoryTheme?.material}
      width={width}
      height={height}
      padding={{ top: 20, bottom: 40, left: 50, right: 20 }}
    >
      <VictoryAxis
        tickFormat={(t: number) => (data[t] ? formatDate(data[t].date, lang) : '')}
        style={{
          tickLabels: { fontSize: 10, fontFamily: 'Cairo', fill: '#888' },
          grid: { stroke: 'transparent' },
        }}
      />
      <VictoryAxis
        dependentAxis
        style={{
          tickLabels: { fontSize: 10, fontFamily: 'Cairo', fill: '#888' },
          grid: { stroke: '#F0F0F0' },
        }}
      />
      {normalRange && (
        <VictoryArea
          data={[
            { x: 0, y: normalRange.max, y0: normalRange.min },
            { x: data.length - 1, y: normalRange.max, y0: normalRange.min },
          ]}
          style={{
            data: { fill: '#E8F5E9', opacity: 0.5 },
          }}
        />
      )}
      <VictoryLine
        data={chartData}
        style={{
          data: { stroke: '#0D7A7A', strokeWidth: 2 },
        }}
      />
    </VictoryChart>
  );
}

export default function VitalTrendChart(props: VitalTrendChartProps) {
  const { data, label, lang } = props;
  const [expanded, setExpanded] = useState(false);
  const isRtl = lang === 'ar';

  if (!data || data.length === 0) return null;

  return (
    <>
      <TouchableOpacity
        style={styles.chartCard}
        onPress={() => setExpanded(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.chartLabel, isRtl && styles.textRtl]}>{label}</Text>
        <ChartContent {...props} width={SCREEN_WIDTH - 64} height={180} />
      </TouchableOpacity>

      <Modal visible={expanded} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setExpanded(false)}>
              <Text style={styles.closeBtn}>{lang === 'ar' ? 'إغلاق' : 'Close'}</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, isRtl && styles.textRtl]}>{label}</Text>
            <View style={styles.spacer} />
          </View>
          <ChartContent
            {...props}
            width={SCREEN_WIDTH - 32}
            height={Dimensions.get('window').height * 0.6}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  chartLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 4,
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  closeBtn: {
    fontSize: 16,
    color: '#0D7A7A',
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
  },
  spacer: {
    width: 60,
  },
  // Fallback styles
  fallbackContainer: {
    paddingVertical: 8,
  },
  fallbackTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 8,
  },
  fallbackRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  fallbackDate: {
    fontSize: 13,
    color: '#888',
    fontFamily: 'Cairo',
  },
  fallbackValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
  },
  abnormalValue: {
    color: '#C62828',
  },
});
