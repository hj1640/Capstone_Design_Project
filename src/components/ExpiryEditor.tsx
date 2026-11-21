import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFridge } from '@/context/FridgeContext';
import { feedbackStore } from '@/services/feedback/local';
import { validDate } from '@/services/feedback/store';
import { userFoods } from '@/services/userFoods';
import { daysBetween } from '@/utils/date';
import { colors, radius, spacing } from '@/constants/theme';
import type { FoodItem, StorageType } from '@/types/food';

const STORAGE_OPTIONS: Exclude<StorageType, '미정'>[] = ['냉장', '냉동', '실온'];

// 품목 상세: 보관 방법과 포장지 날짜만 입력받고, 바뀌는 즉시 저장한다.
// 저장하면 내 평균에 항상 반영되고, 내 식품 DB에 "보관 방법별 평균 일수"로 기억되어
// 다음에 같은 식품을 등록할 때 소비기한이 자동으로 채워진다.
export function ExpiryEditor({ item }: { item: FoodItem }) {
  const { savePersonalExpiry } = useFridge();
  const record = feedbackStore.state().records[item.id];
  const [date, setDate] = useState(record?.expiry ?? item.expectedExpiryDate ?? '');
  const [storage, setStorage] = useState<StorageType>(item.storageType);
  const [message, setMessage] = useState('');

  function save(nextStorage: StorageType, nextDate: string) {
    const hasDate = validDate(nextDate);
    try {
      savePersonalExpiry(
        { ...item, storageType: nextStorage, isOpened: false },
        hasDate ? nextDate : null,
        hasDate ? 'package_label' : null,
        true,
      );
      if (hasDate) {
        userFoods.learnShelfLife(item.standardName, item.category, nextStorage, daysBetween(item.purchaseDate, nextDate));
      } else if (nextStorage !== '미정') {
        userFoods.rememberStorage(item.standardName, item.category, nextStorage);
      }
      setMessage(hasDate ? '✓ 저장됨 · 다음에 같은 식품을 등록하면 자동으로 채워져요' : '✓ 보관 방법 저장됨');
    } catch (error) {
      setMessage(`저장 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function onChangeDate(text: string) {
    // 숫자만 쳐도 되도록 20261121 → 2026-11-21 로 맞춰준다
    const digits = text.replace(/\D/g, '').slice(0, 8);
    const formatted = digits.length > 6 ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`
      : digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
    setDate(formatted);
    if (formatted.length === 10) {
      if (validDate(formatted)) save(storage, formatted);
      else setMessage('날짜를 확인해 주세요');
    } else {
      setMessage('');
    }
  }

  function onSelectStorage(value: StorageType) {
    setStorage(value);
    save(value, date);
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={styles.label}>보관 방법</Text>
      <View style={styles.segment}>
        {STORAGE_OPTIONS.map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: storage === value }}
            onPress={() => onSelectStorage(value)}
            style={[styles.segmentItem, storage === value && styles.segmentItemActive]}
          >
            <Text style={[styles.segmentText, storage === value && styles.segmentTextActive]}>{value}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>포장지에 적힌 소비기한</Text>
      <TextInput
        accessibilityLabel="포장지 소비기한 날짜"
        value={date}
        onChangeText={onChangeDate}
        placeholder="예: 20271121"
        keyboardType="number-pad"
        maxLength={10}
        style={styles.input}
      />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  segment: { flexDirection: 'row', backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: 4 },
  segmentItem: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm },
  segmentItemActive: { backgroundColor: colors.accent },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.accent },
  segmentTextActive: { color: '#FFFFFF' },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 16, color: colors.textPrimary,
  },
  message: { fontSize: 12, color: colors.textSecondary },
});
