import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useFridge } from '@/context/FridgeContext';
import { computeStatus } from '@/utils/status';
import { FoodCard } from '@/components/FoodCard';
import { StatusLevel } from '@/types/food';
import { colors, radius, spacing } from '@/constants/theme';

type FilterKey = 'all' | StatusLevel;

const FILTERS: { key: FilterKey; label: string; color?: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'danger', label: '확인 필요', color: colors.statusDanger },
  { key: 'warning', label: '임박', color: colors.statusWarning },
  { key: 'normal', label: '정상', color: colors.statusNormal },
  { key: 'fresh', label: '여유', color: colors.statusFresh },
];

export default function FridgeScreen() {
  const { fridgeItems } = useFridge();
  const [filter, setFilter] = useState<FilterKey>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return fridgeItems;
    return fridgeItems.filter(
      (item) => computeStatus(item.purchaseDate, item.expectedExpiryDate).level === filter,
    );
  }, [fridgeItems, filter]);

  return (
    <View style={styles.screen}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: spacing.lg }}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.chip,
                active && { backgroundColor: f.color ?? colors.accent, borderColor: f.color ?? colors.accent },
              ]}
            >
              <Text style={[styles.chipText, active && { color: '#fff' }]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>해당하는 품목이 없어요</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {filtered.map((item) => (
            <FoodCard key={item.id} item={item} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  filterRow: { flexGrow: 0, marginTop: spacing.md, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: spacing.sm,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 14 },
});
