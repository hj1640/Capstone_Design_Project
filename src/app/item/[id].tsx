import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useFridge } from '@/context/FridgeContext';
import { computeStatus } from '@/utils/status';
import { formatDateKo } from '@/utils/date';
import { Card } from '@/components/Card';
import { ExpiryEditor } from '@/components/ExpiryEditor';
import { StatusBadge } from '@/components/StatusBadge';
import { ProgressBar } from '@/components/ProgressBar';
import { colors, radius, spacing } from '@/constants/theme';
import type { FoodItem } from '@/types/food';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { fridgeItems, removeItem, setRemaining } = useFridge();
  const item = fridgeItems.find((i) => i.id === id);

  if (!item) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>품목을 찾을 수 없어요. 이미 처리되었을 수 있어요.</Text>
      </View>
    );
  }

  const status = computeStatus(item.purchaseDate, item.expectedExpiryDate);

  function handleFinish(outcome: 'consumed' | 'discarded') {
    Alert.alert(
      outcome === 'consumed' ? '다 먹었어요' : '폐기할게요',
      outcome === 'consumed'
        ? `${item!.standardName}을(를) 냉장고 목록에서 제거할까요?`
        : `${item!.standardName}을(를) 폐기 처리할까요? 소비 데이터 분석에 기록돼요.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '확인',
          style: outcome === 'discarded' ? 'destructive' : 'default',
          onPress: () => {
            removeItem(item!.id, outcome);
            router.back();
          },
        },
      ],
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
      <Card>
        <View style={styles.headerRow}>
          <Text style={styles.icon}>{item.icon}</Text>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.name}>{item.standardName}</Text>
            <Text style={styles.meta}>
              {item.category} · {item.storageType} 보관 · {item.consumptionPattern}
            </Text>
          </View>
          <StatusBadge status={status} />
        </View>

        <View style={styles.dateRow}>
          <DateChip label="구매일" value={formatDateKo(item.purchaseDate)} />
          <DateChip label="입력한 기한" value={formatDateKo(item.expectedExpiryDate)} />
        </View>
        <Text style={[styles.statusDesc, { color: status.color }]}>{status.description}</Text>
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <ExpiryEditor item={item} />
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <RemainingControl item={item} onChange={(value) => setRemaining(item.id, value)} />
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={styles.sectionTitle}>영양정보 (기준량 당)</Text>
        {item.nutritionVerified===false ? <Text>확인된 영양정보가 없습니다.</Text> : <View style={styles.nutritionRow}>
          <NutritionItem label="칼로리" value={`${item.nutrition.calories}kcal`} />
          <NutritionItem label="단백질" value={`${item.nutrition.protein}g`} />
          <NutritionItem label="지방" value={`${item.nutrition.fat}g`} />
          <NutritionItem label="탄수화물" value={`${item.nutrition.carbs}g`} />
        </View>}
      </Card>

      <View style={styles.finishRow}>
        <Pressable style={[styles.finishButton, styles.consumeButton]} onPress={() => handleFinish('consumed')}>
          <Text style={styles.consumeButtonText}>✅ 다 먹었어요</Text>
        </Pressable>
        <Pressable style={[styles.finishButton, styles.discardButton]} onPress={() => handleFinish('discarded')}>
          <Text style={styles.discardButtonText}>🗑️ 버렸어요</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// 남은 양: 비율 버튼(0·25·50·75·100%)은 정확히 그 비율로 맞춘다 (1개짜리도 0.5개처럼 나눠서 기록).
// −/+는 4개 이상 개수 단위면 1개씩, 그 외(1~3개, g·ml 등)는 전체의 25%씩.
function RemainingControl({ item, onChange }: { item: FoodItem; onChange: (value: number) => void }) {
  const total = item.totalQuantity;
  const remaining = item.remainingQuantity ?? total;
  const countable = ['개', '마리', '팩', '봉'].includes(item.unit);
  const step = countable && total >= 4 ? 1 : total * 0.25;
  const format = (value: number) => String(Math.round(value * 100) / 100);
  const ratio = total > 0 ? remaining / total : 0;
  const clamp = (value: number) => Math.max(0, Math.min(total, Math.round(value * 100) / 100));
  return (
    <View>
      <View style={styles.remainHeader}>
        <Text style={styles.sectionTitle}>남은 양</Text>
        <Text style={styles.remainValue}>
          {format(remaining)} / {format(total)}
          {item.unit} ({Math.round(ratio * 100)}%)
        </Text>
      </View>
      <ProgressBar ratio={ratio} />
      <View style={styles.qtyControlRow}>
        {[0, 0.25, 0.5, 0.75, 1].map((r) => {
          const selected = Math.abs(ratio - r) < 0.001;
          return (
            <Pressable
              key={r}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              hitSlop={6}
              style={[styles.qtyButton, selected && styles.qtyButtonActive]}
              onPress={() => onChange(clamp(total * r))}
            >
              <Text style={[styles.qtyButtonText, selected && styles.qtyButtonTextActive]}>{r * 100}%</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.qtyControlRow}>
        <Pressable hitSlop={6} style={[styles.qtyButton, { flex: 1 }]} onPress={() => onChange(clamp(remaining - step))}>
          <Text style={styles.qtyButtonText}>− {format(step)}{item.unit}</Text>
        </Pressable>
        <Pressable hitSlop={6} style={[styles.qtyButton, { flex: 1 }]} onPress={() => onChange(clamp(remaining + step))}>
          <Text style={styles.qtyButtonText}>+ {format(step)}{item.unit}</Text>
        </Pressable>
      </View>
      {remaining === 0 && <Text style={styles.remainHint}>다 먹었다면 아래 ‘다 먹었어요’를 눌러 목록에서 빼 주세요.</Text>}
    </View>
  );
}

function DateChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dateChip}>
      <Text style={styles.dateLabel}>{label}</Text>
      <Text style={styles.dateValue}>{value}</Text>
    </View>
  );
}

function NutritionItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.nutritionValue}>{value}</Text>
      <Text style={styles.nutritionLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  emptyText: { color: colors.textMuted, fontSize: 13 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 40 },
  name: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  dateRow: { flexDirection: 'row', marginTop: spacing.lg, gap: spacing.sm },
  dateChip: {
    flex: 1,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  dateLabel: { fontSize: 11, color: colors.textSecondary },
  dateValue: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  statusDesc: { marginTop: spacing.md, fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  remainHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  remainValue: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  remainHint: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm },
  qtyControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  qtyButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  qtyButtonText: { color: colors.accent, fontWeight: '700', fontSize: 12, textAlign: 'center' },
  qtyButtonActive: { backgroundColor: colors.accent },
  qtyButtonTextActive: { color: '#FFFFFF' },
  qtyValue: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  nutritionRow: { flexDirection: 'row' },
  nutritionValue: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  nutritionLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  finishRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  finishButton: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  consumeButton: { backgroundColor: colors.statusNormal },
  consumeButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  discardButton: { backgroundColor: '#FEE2E2' },
  discardButtonText: { color: colors.statusDanger, fontWeight: '700', fontSize: 13 },
});
