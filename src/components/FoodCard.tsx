import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { FoodItem } from '@/types/food';
import { computeStatus } from '@/utils/status';
import { formatDateKo } from '@/utils/date';
import { StatusBadge } from './StatusBadge';
import { colors, radius, spacing } from '@/constants/theme';

export function FoodCard({ item }: { item: FoodItem }) {
  const status = computeStatus(item.purchaseDate, item.expectedExpiryDate);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
    >
      <View style={styles.topRow}>
        <Text style={styles.icon}>{item.icon}</Text>
        <StatusBadge status={status} />
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {item.standardName}
      </Text>
      <Text style={styles.meta}>{status.description}</Text>

      <View style={{ marginTop: spacing.sm }}>
        <View style={styles.qtyRow}>
          <Text style={styles.dateText}>~{formatDateKo(item.expectedExpiryDate)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  icon: {
    fontSize: 26,
  },
  name: {
    marginTop: spacing.sm,
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  meta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  qtyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  qtyText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  dateText: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
