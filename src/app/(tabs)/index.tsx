import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFridge } from '@/context/FridgeContext';
import { computeStatus } from '@/utils/status';
import { generateRecommendations } from '@/utils/recommend';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { FoodCard } from '@/components/FoodCard';
import { colors, radius, spacing } from '@/constants/theme';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { fridgeItems, purchaseHistory } = useFridge();

  const statusCounts = useMemo(() => {
    const counts = { danger: 0, warning: 0, normal: 0, fresh: 0, unknown:0 };
    fridgeItems.forEach((item) => {
      const s = computeStatus(item.purchaseDate, item.expectedExpiryDate);
      counts[s.level] += 1;
    });
    return counts;
  }, [fridgeItems]);

  const attentionItems = useMemo(() => {
    return fridgeItems
      .map((item) => ({ item, status: computeStatus(item.purchaseDate, item.expectedExpiryDate) }))
      .filter((x) => x.status.level === 'danger' || x.status.level === 'warning')
      .sort((a, b) => (a.status.level === 'danger' ? -1 : 1))
      .slice(0, 4)
      .map((x) => x.item);
  }, [fridgeItems]);

  const recommendations = useMemo(
    () => generateRecommendations(purchaseHistory, fridgeItems).slice(0, 2),
    [purchaseHistory, fridgeItems],
  );


  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: spacing.xl }}
    >
      <Text style={styles.greeting}>안녕하세요 👋</Text>
      <Text style={styles.subGreeting}>오늘 냉장고 상태를 확인해보세요</Text>
      <Pressable onPress={()=>router.push('/feedback-sync')}>
        <Text style={styles.linkText}>내 구매 기록 평균·전송 상태</Text>
      </Pressable>

      <View style={styles.statusRow}>
        <StatusStat label="기한 경과" value={statusCounts.danger} color={colors.statusDanger} />
        <StatusStat label="오늘까지" value={statusCounts.warning} color={colors.statusWarning} />
        <StatusStat label="표시기한 전" value={statusCounts.normal} color={colors.statusNormal} />
        <StatusStat label="기한 미정" value={statusCounts.unknown} color={colors.textMuted} />
      </View>

      {statusCounts.unknown>0 && <Text>기한 미정 {statusCounts.unknown}개 · 품목 상세에서 날짜를 입력해 주세요</Text>}

      <Pressable style={styles.ctaButton} onPress={() => router.push('/receipt')}>
        <Text style={styles.ctaText}>🧾 영수증으로 식재료 등록하기</Text>
      </Pressable>

      {attentionItems.length > 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader
            title="먼저 확인해주세요"
            subtitle="입력한 날짜가 오늘이거나 지난 품목이에요"
            right={
              <Pressable onPress={() => router.push('/fridge')}>
                <Text style={styles.linkText}>전체보기</Text>
              </Pressable>
            }
          />
          <View style={styles.grid}>
            {attentionItems.map((item) => (
              <FoodCard key={item.id} item={item} />
            ))}
          </View>
        </View>
      )}

      {recommendations.length > 0 && (
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader
            title="오늘의 구매 추천"
            subtitle="구매 이력 데이터 기반 추천"
            right={
              <Pressable onPress={() => router.push('/recommend')}>
                <Text style={styles.linkText}>더보기</Text>
              </Pressable>
            }
          />
          <Card>
            {recommendations.map((r, idx) => (
              <View
                key={r.standardName}
                style={[styles.recRow, idx > 0 && { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }]}
              >
                <Text style={{ fontSize: 22, marginRight: spacing.sm }}>{r.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recName}>{r.standardName}</Text>
                  <Text style={styles.recReason} numberOfLines={2}>
                    {r.reason}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </View>
      )}

    </ScrollView>
  );
}

function StatusStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  greeting: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  subGreeting: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  statusRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  ctaButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  ctaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  linkText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  recRow: { flexDirection: 'row', alignItems: 'center' },
  recName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  recReason: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
