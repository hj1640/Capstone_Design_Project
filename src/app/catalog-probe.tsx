import React, { useEffect, useState } from 'react';
import { Button, ScrollView, Text, TextInput, Share, Platform } from 'react-native';
import * as Device from 'expo-device';
import { useLocalSearchParams } from 'expo-router';
import { syntheticCatalog } from '@/services/catalog/synthetic';
import { searchSemanticProducts } from '@/services/catalog/mobile';
import { closeNative } from '@/services/embedding/native';
import type { SearchResult } from '@/contracts/catalog-v1';

export default function CatalogProbe() {
  const params=useLocalSearchParams<{query?: string}>();
  const [query, setQuery] = useState(typeof params.query === 'string' ? params.query : '간편한 국내산 제주');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selection, setSelection] = useState('');
  const [error, setError] = useState('');
  const [busy,setBusy]=useState(false);
  const [semantic,setSemantic]=useState(false);
  const [elapsed,setElapsed]=useState<number | null>(null);
  useEffect(()=>()=>{ void closeNative().catch(()=>undefined); },[]);
  if (!__DEV__) return <Text>개발 빌드 전용 화면입니다.</Text>;
  async function search(text: string) {
    setBusy(true); setQuery(text); setSelection(''); setError(''); setResult(null);
    const start=performance.now();
    try { setResult(await (semantic ? searchSemanticProducts(text) : syntheticCatalog.searchProducts(text)));
      setElapsed(performance.now()-start); }
    catch (e) { setError(String(e)); }
    finally {setBusy(false);}
  }
  return <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }}>
    <Text style={{ fontSize: 22 }}>상품 검색 비교 실험</Text>
    <Text>합성 상품 7개·표준 식품 5개입니다. 후보는 등록된 원문이며 잘린 텍스트의 복원을 보장하지 않습니다.</Text>
    <Button disabled={busy} title={semantic ? '검색 방식: MiniLM 로컬 INT8' : '검색 방식: 문자 기반'} onPress={()=>{
      setSemantic(!semantic);setResult(null);setSelection('');setElapsed(null);
    }} />
    <TextInput editable={!busy} accessibilityLabel="검색할 상품명" value={query} onChangeText={text => {
      setQuery(text); setResult(null); setSelection('');
    }} style={{ borderWidth: 1, padding: 10 }} />
    <Button disabled={busy} title={busy ? '검색 중…' : '검색'} onPress={() => search(query)} />
    {['가상 바른농장', '간편한 국내산 제주', '당근', '가상 부침용 두부 300g', '무관한외부상품'].map(text =>
      <Button disabled={busy} key={text} title={text} onPress={() => search(text)} />)}
    {!!error && <Text>{error}</Text>}
    {result && <>
      <Text>처리: {result.resolution}</Text>
      <Text>경과: {elapsed?.toFixed(1)}ms (첫 MiniLM 검색은 모델 로딩 포함)</Text>
      <Button title="검색 결과 공유" onPress={()=>Share.share({message:JSON.stringify({timestamp:new Date().toISOString(),
        platform:Platform.OS,osVersion:Device.osVersion,device:Device.modelName,physicalDevice:Device.isDevice,
        elapsedMs:elapsed,method:semantic ? 'local_int8' : 'lexical',result},null,2)})} />
      <Text>연결 식품: {result.selectedFoodId ? syntheticCatalog.food(result.selectedFoodId)?.name : '확인 필요'}</Text>
      {result.candidates.map(candidate => <React.Fragment key={candidate.productId}>
        <Text>{candidate.title} → {candidate.foodId ? syntheticCatalog.food(candidate.foodId)?.name : '미연결'}</Text>
        <Button title="이 후보 선택" disabled={!candidate.foodId} onPress={() => setSelection(JSON.stringify({
          productId: candidate.productId, foodId: candidate.foodId, catalogVersion: result.catalogVersion,
          decision: 'user_selected',
        }, null, 2))} />
      </React.Fragment>)}
      <Text>소비기한: 알 수 없음 (검증된 보관 규칙 미제공)</Text>
    </>}
    {!!selection && <Text selectable>이 화면에서 선택한 값: {selection}</Text>}
  </ScrollView>;
}
