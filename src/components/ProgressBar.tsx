import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radius } from '@/constants/theme';

export function ProgressBar({
  ratio,
  color = colors.accent,
  height = 8,
}: {
  ratio: number; // 0~1
  color?: string;
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View
        style={[
          styles.fill,
          {
            width: `${clamped * 100}%`,
            backgroundColor: color,
            borderRadius: height / 2,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
