import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFridge } from '@/context/FridgeContext';
import { computeStatus } from '@/utils/status';
import { generateRecommendations } from '@/utils/recommend';
import { computeConsumptionInsights } from '@/utils/insights';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { FoodCard } from '@/components/FoodCard';
import { colors, radius, spacing } from '@/constants/theme';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { fridgeItems, purchaseHistory, discardLog } = useFridge();

  const statusCounts = useMemo(() => {
    const counts = { danger: 0, warning: 0, normal: 0, fresh: 0 };
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

  const insights = useMemo(
    () => computeConsumptionInsights(purchaseHistory, discardLog),
    [purchaseHistory, discardLog],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: spacing.xl }}
    >
      <Text style={styles.greeting}>안녕하세요 👋</Text>
      <Text style={styles.subGreeting}>오늘 냉장고 상태를 확인해보세요</Text>

      <View style={styles.statusRow}>
        <StatusStat label="확인 필요" value={statusCounts.danger} color={colors.statusDanger} />
        <StatusStat label="임박" value={statusCounts.warning} color={colors.statusWarning} />
        <StatusStat label="정상" value={statusCounts.normal} color={colors.statusNormal} />
        <StatusStat label="여유" value={statusCounts.fresh} color={colors.statusFresh} />
      </View>

      <Pressable style={styles.ctaButton} onPress={() => router.push('/receipt')}>
        <Text style={styles.ctaText}>🧾 영수증으로 식재료 등록하기</Text>
      </Pressable>

      {attentionItems.length > 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader
            title="먼저 확인해주세요"
            subtitle="임박하거나 기한이 지난 품목이에요"
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

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="데이터로 보는 소비 인사이트" subtitle="최근 30일 누적 데이터 분석" />
        <Card>
          <View style={styles.insightRow}>
            <InsightStat
              label="이번 달 폐기 추정액"
              value={`${insights.monthlyWasteWon.toLocaleString()}원`}
            />
            <InsightStat
              label="소비기한 내 사용률"
              value={`${Math.round(insights.usageBeforeExpiryRate * 100)}%`}
            />
          </View>
          <Text style={styles.insightFooter}>
            최근 30일간 구매 {insights.purchaseCount30d}건 중 {insights.discardCount30d}건이
            기한 경과로 폐기된 것으로 추정돼요. 자세한 분석은 구매추천 탭에서 확인하세요.
          </Text>
        </Card>
      </View>
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

function InsightStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.insightValue}>{value}</Text>
      <Text style={styles.insightLabel}>{label}</Text>
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
  insightRow: { flexDirection: 'row' },
  insightValue: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  insightLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  insightFooter: {
    marginTop: spacing.md,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
