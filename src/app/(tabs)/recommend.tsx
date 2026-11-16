import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { useFridge } from '@/context/FridgeContext';
import { generateRecommendations } from '@/utils/recommend';
import { formatDateKo } from '@/utils/date';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, radius, spacing } from '@/constants/theme';
import { PurchaseRecommendation } from '@/types/food';

const URGENCY_META: Record<PurchaseRecommendation['urgency'], { label: string; color: string }> = {
  high: { label: '곧 소진', color: colors.statusDanger },
  medium: { label: '소진 예정', color: colors.statusWarning },
  low: { label: '여유', color: colors.statusFresh },
};

export default function RecommendScreen() {
  const { purchaseHistory, fridgeItems } = useFridge();

  const recommendations = useMemo(
    () => generateRecommendations(purchaseHistory, fridgeItems),
    [purchaseHistory, fridgeItems],
  );


  function openShopping(itemName: string) {
    // 실제 자동결제는 범위에서 제외하고, 외부 쇼핑 검색 페이지로 연결하는 수준까지만 구현한다.
    Linking.openURL(`https://search.shopping.naver.com/search/all?query=${encodeURIComponent(itemName)}`);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
      <SectionHeader
        title="구매 추천"
        subtitle="구매 기록을 바탕으로 다음 구매 시점을 안내하는 기능입니다"
      />

      {recommendations.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>
            구매 추천 기능을 준비 중입니다. 등록한 구매 기록은 보관됩니다.
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

    </ScrollView>
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
});
