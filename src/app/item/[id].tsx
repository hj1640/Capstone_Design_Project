import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useFridge } from '@/context/FridgeContext';
import { computeStatus, remainingRatio } from '@/utils/status';
import { formatDateKo } from '@/utils/date';
import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { StatusBadge } from '@/components/StatusBadge';
import { colors, radius, spacing } from '@/constants/theme';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { fridgeItems, adjustRemaining, removeItem } = useFridge();
  const item = fridgeItems.find((i) => i.id === id);

  if (!item) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>품목을 찾을 수 없어요. 이미 처리되었을 수 있어요.</Text>
      </View>
    );
  }

  const status = computeStatus(item.purchaseDate, item.expectedExpiryDate);
  const ratio = remainingRatio(item.totalQuantity, item.remainingQuantity);
  const isCountable = item.unit === '개' || item.unit === '마리';
  const step = isCountable ? 1 / item.totalQuantity : 0.1;

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
          <DateChip label="예상 소비기한" value={formatDateKo(item.expectedExpiryDate)} />
        </View>
        <Text style={[styles.statusDesc, { color: status.color }]}>{status.description}</Text>
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={styles.sectionTitle}>잔여량</Text>
        <ProgressBar ratio={ratio} color={status.color} height={10} />
        <View style={styles.qtyControlRow}>
          <Pressable style={styles.qtyButton} onPress={() => adjustRemaining(item.id, -step)}>
            <Text style={styles.qtyButtonText}>− 사용</Text>
          </Pressable>
          <Text style={styles.qtyValue}>
            {isCountable
              ? `${item.remainingQuantity}/${item.totalQuantity} ${item.unit}`
              : `${Math.round(item.remainingQuantity)}/${item.totalQuantity} ${item.unit}`}
          </Text>
          <Pressable style={styles.qtyButton} onPress={() => adjustRemaining(item.id, step)}>
            <Text style={styles.qtyButtonText}>+ 보충</Text>
          </Pressable>
        </View>
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={styles.sectionTitle}>영양정보 (기준량 당)</Text>
        <View style={styles.nutritionRow}>
          <NutritionItem label="칼로리" value={`${item.nutrition.calories}kcal`} />
          <NutritionItem label="단백질" value={`${item.nutrition.protein}g`} />
          <NutritionItem label="지방" value={`${item.nutrition.fat}g`} />
          <NutritionItem label="탄수화물" value={`${item.nutrition.carbs}g`} />
        </View>
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
  qtyControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  qtyButton: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  qtyButtonText: { color: colors.accent, fontWeight: '700', fontSize: 12 },
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
