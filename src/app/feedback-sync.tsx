import React, { useEffect, useState } from 'react';
import { Alert, Button, ScrollView, Text, TextInput } from 'react-native';
import { configuredServerUrl, connectPersonalServer, disconnectPersonalServer, feedbackStore,
  personalConnectionStatus, personalStatistics, personalSync, resolvePersonalConflict,
  subscribePersonalState, syncPersonalNow } from '@/services/feedback/local';
import type { PersonalStatistic } from '@/services/feedback/personal';

const reasons: Record<string,string>={INCLUDED:'평균 반영 완료',WITHDRAWN:'평균 반영 철회 완료',
  LABEL_REQUIRED:'포장지 날짜 필요',STORAGE_REQUIRED:'보관 조건 필요',UNOPENED_LABEL_ONLY:'개봉품 제외',
  EXPIRY_BEFORE_PURCHASE:'구매일 이전 날짜 제외'};

export default function FeedbackSync() {
  const [url,setUrl]=useState(configuredServerUrl || personalConnectionStatus().url || '');
  const [code,setCode]=useState('');
  const [busy,setBusy]=useState(false);
  const [jobs,setJobs]=useState(personalSync.statuses());
  const [statistics,setStatistics]=useState<PersonalStatistic[]>(personalStatistics());
  const [connection,setConnection]=useState(personalConnectionStatus());
  const [message,setMessage]=useState('개인 연결 후 기록을 서버에 반영합니다.');
  useEffect(()=>subscribePersonalState(()=>{
    setJobs(personalSync.statuses());setStatistics(personalStatistics());setConnection(personalConnectionStatus());
  }),[]);
  async function run(action:()=>Promise<PersonalStatistic[] | void>) {
    setBusy(true);
    try {const rows=await action();if(rows) setStatistics(rows);setMessage('요청을 마쳤습니다. 아래 반영 상태를 확인해 주세요.');}
    catch(error){setMessage(String(error));}
    finally{setJobs(personalSync.statuses());setConnection(personalConnectionStatus());setBusy(false);}
  }
  const records=feedbackStore.state().records;
  return <ScrollView contentContainerStyle={{padding:24,gap:12}}>
    <Text style={{fontSize:22}}>내 구매 기록 평균</Text>
    <Text>포장지 날짜에서 구매일을 뺀 일수를 계산합니다. 다른 사람의 기록은 섞지 않습니다. 평균이 포장지 날짜나 섭취 가능 여부를 대신하지 않습니다.</Text>
    {!configuredServerUrl && !connection.saved && <Text>서버 연결 전에는 구매와 날짜 수정이 이 기기에 저장됩니다. 개인 평균은 담당자에게 서버 주소와 연결 코드를 받아 등록한 뒤 갱신됩니다.</Text>}
    <Text>{connection.connected ? '개인 서버에 연결됨' : connection.saved ? '저장된 연결 확인 필요' : '개인 연결 코드 등록'}</Text>
    {!connection.saved && <>
      {(!configuredServerUrl || __DEV__) && <TextInput accessibilityLabel="서버 주소" editable={!busy}
        value={url} onChangeText={setUrl} placeholder="https://팀 서버 주소" autoCapitalize="none" style={{borderWidth:1,padding:8}} />}
      <TextInput accessibilityLabel="개인 연결 코드" editable={!busy} secureTextEntry value={code} onChangeText={setCode}
        placeholder="담당자에게 받은 개인 코드" autoCapitalize="none" autoCorrect={false} style={{borderWidth:1,padding:8}} />
      <Button title="개인 연결 등록" disabled={busy || !code || !url}
        onPress={()=>void run(async()=>{const result=await connectPersonalServer(url,code);setCode('');return result;})} />
    </>}
    <Text>연결 정보는 기기에 안전하게 보관합니다. 앱을 다시 열면 전송을 이어갑니다. 코드가 만료되었거나 기기를 바꾸면 같은 계정의 새 코드를 받아 주세요.</Text>
    <Button title="재시도·새로고침" disabled={busy || !connection.saved} onPress={()=>void run(syncPersonalNow)} />
    {connection.saved && <Button title="이 기기 서버 연결 해제" disabled={busy} onPress={()=>Alert.alert(
      '서버 연결 해제','기록과 평균은 유지되며 전송이 중단됩니다. 평균에서 빼려면 아래 품목별 철회를 먼저 완료해 주세요.',[
        {text:'취소',style:'cancel'},{text:'연결 해제',onPress:()=>void run(disconnectPersonalServer)}])} />}
    <Text>{message}</Text>
    {connection.lastError && <Text>{connection.lastError}</Text>}
    {statistics.length===0 && <Text>조회된 통계가 없습니다. 품목의 포장지 날짜·보관 조건을 입력하고 평균 반영을 켜 주세요.</Text>}
    {statistics.map(row=><Text key={`${row.foodName}/${row.storage}`}>
      {row.foodName} · {row.storage}: {row.meanDays.toFixed(2)}일 (구매 {row.count}건)
    </Text>)}
    {jobs.map(job=><React.Fragment key={job.id}>
      <Text>{records[job.id]?.item.standardName ?? '품목'}: {job.error ?? (job.localPending || job.request ? '전송 대기' : reasons[job.reason ?? ''] ?? '서버 응답 확인 필요')}</Text>
      {records[job.id]?.personalAverage && <Button title="이 구매 건의 평균 반영 철회" disabled={busy}
        onPress={()=>{const record=records[job.id];feedbackStore.edit(record.item,record.expiry,record.source,false);
          setJobs(personalSync.statuses());if(connection.saved) void run(syncPersonalNow);}} />}
      {job.error==='REVISION_CONFLICT' && <Button title="충돌: 이 기기의 값으로 다시 반영" disabled={busy}
        onPress={()=>Alert.alert('서버 기록 변경','다른 기기에서 저장한 값을 이 기기의 값으로 바꿉니다.',[
          {text:'취소',style:'cancel'},{text:'반영',onPress:()=>void run(()=>resolvePersonalConflict(job.id))}])} />}
    </React.Fragment>)}
  </ScrollView>;
}
