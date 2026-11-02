import React, { useState } from 'react';
import { Alert, Button, ScrollView, Switch, Text, TextInput } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { developmentTransport, feedbackStore } from '@/services/feedback/local';
import { useFridge } from '@/context/FridgeContext';

export default function FeedbackSync() {
  const {refreshPersonalExpiry}=useFridge();
  const {itemId}=useLocalSearchParams<{itemId:string}>();
  const [url,setUrl]=useState('http://127.0.0.1:8766');
  const [token,setToken]=useState('');
  const [consent,setConsent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [jobs,setJobs]=useState(feedbackStore.state().jobs);
  if (!__DEV__) return <Text>개발 빌드 전용입니다.</Text>;
  function refresh(){setJobs(feedbackStore.state().jobs);}
  function submit(){try {feedbackStore.submit(itemId,'purchase_remaining',consent);setConsent(false);refresh();}
    catch(e){Alert.alert('제출 대기 실패',String(e));}}
  async function sync(){setBusy(true);try {await feedbackStore.sync(developmentTransport(url,token),new URL(url).origin);refresh();}
    catch(e){Alert.alert('동기화 실패',String(e));}finally{setBusy(false);}}
  async function resolve(keepLocal: boolean){setBusy(true);try {
    await feedbackStore.resolveConflict(itemId,developmentTransport(url,token),new URL(url).origin,keepLocal);
    refresh();refreshPersonalExpiry();
  } catch(e){Alert.alert('충돌 해결 실패',String(e));}finally{setBusy(false);}}
  return <ScrollView contentContainerStyle={{padding:24,gap:12}}>
    <Text style={{fontSize:20}}>개발용 수정값 제출</Text>
    <Text>날짜·근거·구매일 snapshot을 개발 서버에 제출합니다. 식품 연결/신뢰도 정책이 미정이라 공유 기본값에는 반영하지 않습니다.</Text>
    <Text>개발용 동의 버전: development-consent-v1</Text>
    <Switch accessibilityLabel="개발 서버 제출 동의" value={consent} onValueChange={setConsent} />
    <Button title="이 수정값을 제출 대기열에 추가" disabled={busy || !consent} onPress={submit} />
    <Button title="이 품목의 제출 동의 철회" disabled={busy} onPress={()=>{feedbackStore.withdraw(itemId);refresh();}} />
    <TextInput accessibilityLabel="개발 서버 주소" editable={!busy} value={url} onChangeText={setUrl} autoCapitalize="none" style={{borderWidth:1,padding:8}} />
    <TextInput accessibilityLabel="개발 인증 토큰" editable={!busy} secureTextEntry value={token} onChangeText={setToken} autoCapitalize="none" style={{borderWidth:1,padding:8}} />
    <Text>토큰은 이 화면의 메모리에만 보관합니다. 철회도 서버에 전달되려면 동기화가 필요합니다.</Text>
    <Button title={busy ? '동기화 중…' : '대기열 동기화'} disabled={busy || !token} onPress={sync} />
    {jobs.some(j=>j.itemId===itemId && j.status==='conflict') && <>
      <Button title="충돌 해결: 내 날짜로 다시 요청" disabled={busy} onPress={()=>resolve(true)} />
      <Button title="충돌 해결: 서버 날짜 사용" disabled={busy} onPress={()=>resolve(false)} />
    </>}
    {jobs.filter(j=>j.itemId===itemId).map(j=><Text selectable key={j.id}>{j.kind}: {j.status}{j.error ? ` (${j.error})` : ''}
      {j.receipt ? `\n${JSON.stringify(j.receipt)}` : ''}</Text>)}
  </ScrollView>;
}
