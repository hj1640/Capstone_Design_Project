import React, { useState } from 'react';
import { Button, Platform, ScrollView, Share, Text } from 'react-native';
import * as Device from 'expo-device';
import { runProbe } from '@/services/embedding/probe';

export default function ModelProbe() {
  const [report, setReport] = useState('합성 입력 8개로 토큰 일치·384차원 벡터·실행 시간을 검사합니다.');
  const [busy, setBusy] = useState(false);
  if (!__DEV__) return <Text>개발 빌드 전용 화면입니다.</Text>;
  async function run() {
    setBusy(true);
    try {
      const result = await runProbe();
      setReport(JSON.stringify({ timestamp: new Date().toISOString(), platform: Platform.OS,
        osVersion: Device.osVersion, model: Device.modelName, physicalDevice: Device.isDevice,
        ...result }, null, 2));
    } catch (error) { setReport(`실행 실패: ${String(error)}`); }
    finally { setBusy(false); }
  }
  return <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
    <Text style={{ fontSize: 22 }}>2단계 모델 실행 검증</Text>
    <Button title={busy ? '검사 중…' : '검사 실행'} disabled={busy} onPress={run} />
    <Button title="결과 공유" disabled={busy} onPress={() => Share.share({ message: report })} />
    <Text selectable>{report}</Text>
  </ScrollView>;
}
