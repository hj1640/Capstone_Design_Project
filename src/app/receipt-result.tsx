import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { useFridge } from '@/context/FridgeContext';
import { OcrCandidate } from '@/types/food';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, radius, spacing } from '@/constants/theme';
import { validDate } from '@/services/feedback/store';

export default function ReceiptResultScreen() {
  const { pendingReceipt, setPendingReceipt, addConfirmedReceiptItems } = useFridge();
  const [candidates, setCandidates] = useState<OcrCandidate[]>(pendingReceipt?.candidates ?? []);
  const [purchaseDate,setPurchaseDate]=useState(pendingReceipt?.date ?? '');
  const registered=useRef(false);

  useEffect(() => {
    if (!pendingReceipt) {
      // 직접 이 화면으로 들어온 경우 (대기 중인 영수증이 없음) 영수증 등록 화면으로 되돌림
      router.replace('/receipt');
    }
  }, [pendingReceipt]);

  if (!pendingReceipt) return null;

  function updateCandidate(id: string, patch: Partial<OcrCandidate>) {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function toggleReject(id: string) {
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: c.status === 'rejected' ? 'uncertain' : 'rejected' } : c,
      ),
    );
  }

  const includedCount = candidates.filter((c) => c.status !== 'rejected').length;

  function handleConfirmAll() {
    if(registered.current) return;
    if (!validDate(purchaseDate)) {Alert.alert('구매일 확인','실제 구매일을 YYYY-MM-DD 형식으로 입력해 주세요.');return;}
    const stillUncertain = candidates.some((c) => c.status === 'uncertain');
    if (stillUncertain) {
      Alert.alert(
        '확인이 필요한 품목이 있어요',
        '품목명이 불확실한 항목의 후보를 선택하거나 제외해주세요.',
      );
      return;
    }
    registered.current=true;
    try {addConfirmedReceiptItems(candidates, '영수증',purchaseDate);}
    catch(error){registered.current=false;Alert.alert('등록 확인',String(error));return;}
    setPendingReceipt(null);
    router.replace('/fridge');
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
      <SectionHeader
        title={pendingReceipt.storeName}
        subtitle={`${pendingReceipt.date ?? '구매일 확인 필요'} · OCR로 ${candidates.length}개 품목을 인식했어요${
          pendingReceipt.engine === 'mock' ? ' (모의 데이터)' : ''
        }`}
      />

      {pendingReceipt.engine === 'mock' && (
        <Text style={{ color: colors.statusDanger, fontWeight: '700', marginBottom: spacing.md }}>
          ⚠️ 실제 인식 결과가 아니라 미리 만든 예시 영수증이에요 (ML Kit 개발 빌드에서만 실제 인식)
        </Text>
      )}
      {pendingReceipt.matcherError && (
        <Text style={{ color: colors.statusDanger, fontWeight: '700', marginBottom: spacing.md }}>
          ⚠️ 식품 매칭 모델(ko-sroberta)을 실행하지 못해 OCR 원문만 보여줘요: {pendingReceipt.matcherError}
        </Text>
      )}

      <Text>구매일 확인 (배송일과 구분해 주세요)</Text>
      <TextInput accessibilityLabel="실제 구매일" value={purchaseDate} onChangeText={setPurchaseDate}
        placeholder="YYYY-MM-DD" style={{borderWidth:1,padding:10,marginBottom:16}} />

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={styles.rawLabel}>원문 인식 결과 (OCR)</Text>
        {pendingReceipt.rawLines.map((line, idx) => (
          <Text key={idx} style={styles.rawLine}>
            {line}
          </Text>
        ))}
      </Card>

      {candidates.map((c) => (
        <Card key={c.id} style={{ marginBottom: spacing.md, opacity: c.status === 'rejected' ? 0.5 : 1 }}>
          <View style={styles.candidateTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rawText}>{c.rawText}</Text>
              <Text style={styles.guessedName}>→ {c.guessedName}</Text>
              <TextInput accessibilityLabel="확인할 식품명" value={c.guessedName}
                onChangeText={text=>updateCandidate(c.id,{guessedName:text,status:'uncertain'})}
                style={{borderWidth:1,padding:8}} />
              <Pressable onPress={()=>{if(c.guessedName.trim()) updateCandidate(c.id,{guessedName:c.guessedName.trim(),status:'confirmed'});}}>
                <Text>이 식품명으로 확인</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => toggleReject(c.id)}>
              <Text style={styles.rejectText}>{c.status === 'rejected' ? '복구' : '제외'}</Text>
            </Pressable>
          </View>

          {c.status === 'uncertain' && (
            <View style={styles.uncertainBox}>
              <Text style={styles.uncertainLabel}>
                분류 후보를 확인해 선택해주세요. 점수는 확률이 아닙니다.
              </Text>
              <View style={styles.chipRow}>
                {[c.guessedName, ...c.alternativeNames].map((name) => (
                  <Pressable
                    key={name}
                    style={styles.candidateChip}
                    onPress={() => updateCandidate(c.id, { guessedName: name, status: 'confirmed' })}
                  >
                    <Text style={styles.candidateChipText}>{name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={styles.qtyRow}>
            <Text style={styles.qtyLabel}>구매 수량 (0이면 확인 필요)</Text>
            <TextInput
              style={styles.qtyInput}
              keyboardType="numeric"
              value={String(c.quantity)}
              onChangeText={(text) => updateCandidate(c.id, { quantity: Number(text) || 0 })}
            />
            <Text style={styles.unitLabel}>{c.unit}</Text>
          </View>
        </Card>
      ))}

      <Pressable onPress={()=>setCandidates(previous=>[...previous,{id:`manual-${Date.now()}-${previous.length}`,
        rawText:'직접 추가',guessedName:'',alternativeNames:[],confidence:0,category:'가공식품',quantity:0,unit:'개',status:'uncertain'}])}>
        <Text>인식에서 빠진 품목 직접 추가</Text>
      </Pressable>
      <Pressable style={styles.confirmButton} onPress={handleConfirmAll}>
        <Text style={styles.confirmButtonText}>{includedCount}개 품목 냉장고에 등록하기</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  rawLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: spacing.xs },
  rawLine: { fontSize: 12, color: colors.textSecondary, fontFamily: 'monospace' },
  candidateTop: { flexDirection: 'row', alignItems: 'flex-start' },
  rawText: { fontSize: 12, color: colors.textMuted },
  guessedName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  rejectText: { fontSize: 12, color: colors.accent, fontWeight: '600' },
  uncertainBox: {
    marginTop: spacing.sm,
    backgroundColor: '#FFF7ED',
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  uncertainLabel: { fontSize: 11, color: '#B45309', marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  candidateChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  candidateChipText: { fontSize: 12, color: '#92400E', fontWeight: '600' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  qtyLabel: { fontSize: 12, color: colors.textSecondary, marginRight: spacing.sm },
  qtyInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    width: 70,
    fontSize: 13,
    marginRight: spacing.xs,
  },
  unitLabel: { fontSize: 12, color: colors.textSecondary },
  confirmButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  confirmButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
