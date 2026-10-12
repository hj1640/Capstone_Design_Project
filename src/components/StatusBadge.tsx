import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusInfo } from '@/types/food';
import { radius, spacing } from '@/constants/theme';

export function StatusBadge({ status }: { status: StatusInfo }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${status.color}1A` }]}>
      <View style={[styles.dot, { backgroundColor: status.color }]} />
      <Text style={[styles.label, { color: status.color }]}>{status.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});
