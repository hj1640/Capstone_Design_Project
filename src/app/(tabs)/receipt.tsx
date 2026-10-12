import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useFridge } from '@/context/FridgeContext';
import { runReceiptOcrPipeline, mlkitOcrEngine } from '@/services/ocr';
import { foodDatabase } from '@/data/foodDatabase';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, radius, spacing } from '@/constants/theme';

export default function ReceiptScreen() {
  const { setPendingReceipt, addConfirmedReceiptItems } = useFridge();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualQuantity, setManualQuantity] = useState('1');

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('권한 필요', '사진 보관함 접근 권한을 허용해주세요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('권한 필요', '카메라 접근 권한을 허용해주세요.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  }

  async function startRecognition() {
    if (!imageUri) return;
    setIsRecognizing(true);
    try {
      // 실기기 개발 빌드(ML Kit 네이티브 모듈 연결됨)에서는 실제 OCR+매칭 결과를,
      // Expo Go/웹 등 네이티브 모듈이 없는 환경에서는 모의 데이터를 반환한다.
      // (판단 로직은 src/services/ocr/index.ts 참고)
      const result = await runReceiptOcrPipeline(imageUri);
      setPendingReceipt(result);
      setImageUri(null);
      router.push('/receipt-result');
    } finally {
      setIsRecognizing(false);
    }
  }

  function submitManualEntry() {
    if (!manualName.trim()) {
      Alert.alert('품목명을 입력해주세요');
      return;
    }
    const match = foodDatabase.find(
      (f) => f.standardName === manualName.trim() || f.synonyms.includes(manualName.trim()),
    );
    const quantity = Number(manualQuantity) || 1;

    addConfirmedReceiptItems(
      [
        {
          id: `manual-${Date.now()}`,
          rawText: manualName.trim(),
          guessedName: match?.standardName ?? manualName.trim(),
          alternativeNames: [],
          confidence: match ? 1 : 0.5,
          category: match?.category ?? '가공식품',
          quantity,
          unit: match?.unit ?? '개',
          status: 'confirmed',
        },
      ],
      '수기입력',
    );

    setManualName('');
    setManualQuantity('1');
    setShowManualEntry(false);
    Alert.alert('등록 완료', `${manualName.trim()}이(가) 냉장고 현황에 추가되었어요.`);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}
    >
      <SectionHeader
        title="영수증 등록"
        subtitle="영수증을 촬영하거나 갤러리에서 선택하면 식재료가 자동으로 인식돼요"
      />

      <View style={styles.engineBadge}>
        <Text style={styles.engineBadgeText}>
          {mlkitOcrEngine.isAvailable()
            ? '🟢 Google ML Kit 실제 인식 사용 중'
            : '🟡 개발 빌드가 아니라 모의 인식 데이터를 사용해요'}
        </Text>
      </View>

      <Card>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>🧾</Text>
            <Text style={styles.placeholderText}>등록할 영수증 이미지가 없어요</Text>
          </View>
        )}

        <View style={styles.buttonRow}>
          <Pressable style={[styles.actionButton, styles.secondaryButton]} onPress={takePhoto}>
            <Text style={styles.secondaryButtonText}>📷 촬영하기</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, styles.secondaryButton]} onPress={pickFromLibrary}>
            <Text style={styles.secondaryButtonText}>🖼️ 갤러리</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.primaryButton, (!imageUri || isRecognizing) && styles.disabledButton]}
          onPress={startRecognition}
          disabled={!imageUri || isRecognizing}
        >
          {isRecognizing ? (
            <View style={styles.row}>
              <ActivityIndicator color="#fff" style={{ marginRight: spacing.sm }} />
              <Text style={styles.primaryButtonText}>인식 중...</Text>
            </View>
          ) : (
            <Text style={styles.primaryButtonText}>인식 시작하기</Text>
          )}
        </Pressable>
      </Card>

      <Pressable style={styles.manualToggle} onPress={() => setShowManualEntry((v) => !v)}>
        <Text style={styles.manualToggleText}>
          {showManualEntry ? '수기 입력 닫기' : '영수증이 없나요? 수기로 입력하기'}
        </Text>
      </Pressable>

      {showManualEntry && (
        <Card style={{ marginTop: spacing.sm }}>
          <Text style={styles.inputLabel}>품목명</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 흰우유, 바나나"
            value={manualName}
            onChangeText={setManualName}
          />
          <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>수량</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={manualQuantity}
            onChangeText={setManualQuantity}
          />
          <Pressable style={[styles.primaryButton, { marginTop: spacing.md }]} onPress={submitManualEntry}>
            <Text style={styles.primaryButtonText}>냉장고에 추가</Text>
          </Pressable>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  preview: { width: '100%', height: 180, borderRadius: radius.md, marginBottom: spacing.md },
  engineBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.md,
  },
  engineBadgeText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  placeholder: {
    height: 160,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  placeholderIcon: { fontSize: 32, marginBottom: spacing.xs },
  placeholderText: { color: colors.textMuted, fontSize: 13 },
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  secondaryButton: { backgroundColor: colors.accentSoft },
  secondaryButtonText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  primaryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  disabledButton: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
  manualToggle: { marginTop: spacing.lg, alignItems: 'center' },
  manualToggleText: { color: colors.textSecondary, fontSize: 13, textDecorationLine: 'underline' },
  inputLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.textPrimary,
  },
});
