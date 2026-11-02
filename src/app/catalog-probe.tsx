import React, { useState } from 'react';
import { Button, ScrollView, Text, TextInput } from 'react-native';
import { syntheticCatalog } from '@/services/catalog/synthetic';
import type { SearchResult } from '@/contracts/catalog-v1';

export default function CatalogProbe() {
  const [query, setQuery] = useState('간편한 국내산 제주');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selection, setSelection] = useState('');
  const [error, setError] = useState('');
  if (!__DEV__) return <Text>개발 빌드 전용 화면입니다.</Text>;
  async function search(text: string) {
    setQuery(text); setSelection(''); setError('');
    try { setResult(await syntheticCatalog.searchProducts(text)); }
    catch (e) { setError(String(e)); }
  }
  return <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }}>
    <Text style={{ fontSize: 22 }}>3단계 상품 검색 실험</Text>
    <Text>합성 상품 7개·표준 식품 5개입니다. 후보는 등록된 원문이며 잘린 텍스트의 복원을 보장하지 않습니다.</Text>
    <TextInput accessibilityLabel="검색할 상품명" value={query} onChangeText={text => {
      setQuery(text); setResult(null); setSelection('');
    }} style={{ borderWidth: 1, padding: 10 }} />
    <Button title="검색" onPress={() => search(query)} />
    {['가상 바른농장', '간편한 국내산 제주', '당근', '가상 부침용 두부 300g', '무관한외부상품'].map(text =>
      <Button key={text} title={text} onPress={() => search(text)} />)}
    {!!error && <Text>{error}</Text>}
    {result && <>
      <Text>처리: {result.resolution}</Text>
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
