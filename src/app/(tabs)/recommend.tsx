import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { useFridge } from '@/context/FridgeContext';
import { generateRecommendations } from '@/utils/recommend';
import { computeConsumptionInsights } from '@/utils/insights';
import { formatDateKo } from '@/utils/date';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { WeeklyBarChart } from '@/components/WeeklyBarChart';
import { colors, radius, spacing } from '@/constants/theme';
import { PurchaseRecommendation } from '@/types/food';

const URGENCY_META: Record<PurchaseRecommendation['urgency'], { label: string; color: string }> = {
  high: { label: '곧 소진', color: colors.statusDanger },
  medium: { label: '소진 예정', color: colors.statusWarning },
  low: { label: '여유', color: colors.statusFresh },
};

export default function RecommendScreen() {
  const { purchaseHistory, discardLog, fridgeItems } = useFridge();

  const recommendations = useMemo(
    () => generateRecommendations(purchaseHistory, fridgeItems),
    [purchaseHistory, fridgeItems],
  );

  const insights = useMemo(
    () => computeConsumptionInsights(purchaseHistory, discardLog),
    [purchaseHistory, discardLog],
  );

  function openShopping(itemName: string) {
    // 실제 자동결제는 범위에서 제외하고, 외부 쇼핑 검색 페이지로 연결하는 수준까지만 구현한다.
    Linking.openURL(`https://search.shopping.naver.com/search/all?query=${encodeURIComponent(itemName)}`);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
      <SectionHeader
        title="구매 추천"
        subtitle="최근 구매일 · 평균 주기 · 예상 소진일을 조합한 규칙 기반 추천"
      />

      {recommendations.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>
            아직 추천할 만큼 충분한 구매 이력이 쌓이지 않았어요. 영수증을 더 등록해보세요.
          </Text>
        </Card>
      ) : (
        recommendations.map((r) => {
          const meta = URGENCY_META[r.urgency];
          return (
            <Card key={r.standardName} style={{ marginBottom: spacing.md }}>
              <View style={styles.recTop}>
                <Text style={{ fontSize: 24 }}>{r.icon}</Text>
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={styles.recName}>{r.standardName}</Text>
                  <Text style={styles.recCategory}>{r.category}</Text>
                </View>
                <View style={[styles.urgencyBadge, { backgroundColor: `${meta.color}1A` }]}>
                  <Text style={[styles.urgencyText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>
              <Text style={styles.recReason}>{r.reason}</Text>
              <Text style={styles.recDate}>
                예상 소진일: {formatDateKo(r.predictedRunOutDate)} · 평균 주기 {r.avgCycleDays}일
              </Text>
              <Pressable style={styles.shopButton} onPress={() => openShopping(r.standardName)}>
                <Text style={styles.shopButtonText}>🛍️ 구매처 연결</Text>
              </Pressable>
            </Card>
          );
        })
      )}

      <View style={{ marginTop: spacing.xl }}>
        <SectionHeader
          title="데이터 기반 소비 인사이트"
          subtitle="누적된 구매·폐기 데이터를 분석한 결과예요"
        />

        <Card style={{ marginBottom: spacing.md }}>
          <View style={styles.statRow}>
            <Stat label="이번 달 폐기 추정액" value={`${insights.monthlyWasteWon.toLocaleString()}원`} />
            <Stat label="소비기한 내 사용률" value={`${Math.round(insights.usageBeforeExpiryRate * 100)}%`} />
            <Stat
              label="알림 후에도 폐기된 비율"
              value={`${Math.round(insights.warningEffectivenessRate * 100)}%`}
            />
          </View>
        </Card>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={styles.chartTitle}>주차별 폐기 추정액 추이</Text>
          <WeeklyBarChart data={insights.weeklyTrend} />
        </Card>

        {insights.topWastedCategories.length > 0 && (
          <Card>
            <Text style={styles.chartTitle}>가장 많이 버려진 카테고리</Text>
            {insights.topWastedCategories.map((c, idx) => (
              <View
                key={c.category}
                style={[
                  styles.wasteRow,
                  idx > 0 && { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.sm },
                ]}
              >
                <Text style={styles.wasteCategory}>{c.category}</Text>
                <Text style={styles.wasteValue}>
                  {c.totalValueWon.toLocaleString()}원 · {c.count}건
                </Text>
              </View>
            ))}
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  emptyText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  recTop: { flexDirection: 'row', alignItems: 'center' },
  recName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  recCategory: { fontSize: 12, color: colors.textMuted },
  urgencyBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  urgencyText: { fontSize: 11, fontWeight: '700' },
  recReason: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 18 },
  recDate: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },
  shopButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  shopButtonText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  statRow: { flexDirection: 'row' },
  statValue: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  chartTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  wasteRow: { flexDirection: 'row', justifyContent: 'space-between' },
  wasteCategory: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  wasteValue: { fontSize: 12, color: colors.textSecondary },
});
