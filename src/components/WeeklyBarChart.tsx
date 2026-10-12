import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WeeklyWaste } from '@/utils/insights';
import { colors, radius, spacing } from '@/constants/theme';

// 단일 시리즈(주차별 추정 손실액) 막대 그래프.
// 시리즈가 하나뿐이라 범례는 생략하고, 막대 수가 4개뿐이라 값은 직접 라벨로 표기한다.
const BAR_COLOR = colors.accent;
const CHART_HEIGHT = 96;

export function WeeklyBarChart({ data }: { data: WeeklyWaste[] }) {
  const max = Math.max(1, ...data.map((d) => d.valueWon));

  return (
    <View>
      <View style={styles.row}>
        {data.map((d) => {
          const barHeight = Math.max(4, (d.valueWon / max) * CHART_HEIGHT);
          return (
            <View key={d.weekLabel} style={styles.col}>
              <Text style={styles.value}>
                {d.valueWon > 0 ? `${(d.valueWon / 1000).toFixed(1)}천` : '0'}
              </Text>
              <View style={[styles.barTrack, { height: CHART_HEIGHT }]}>
                <View
                  style={[
                    styles.bar,
                    { height: barHeight, backgroundColor: BAR_COLOR },
                  ]}
                />
              </View>
              <Text style={styles.label}>{d.weekLabel}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  col: {
    flex: 1,
    alignItems: 'center',
  },
  value: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  barTrack: {
    width: '100%',
    maxWidth: 36,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '70%',
    borderRadius: radius.sm,
  },
  label: {
    marginTop: spacing.xs,
    fontSize: 11,
    color: colors.textMuted,
  },
});
