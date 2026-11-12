import React, { useState } from 'react';
import { Alert, Button, ScrollView, Text, TextInput } from 'react-native';
import { connectPersonalServer, feedbackStore, personalConnectionStatus, personalSync,
  resolvePersonalConflict, syncPersonalNow } from '@/services/feedback/local';
import type { PersonalStatistic } from '@/services/feedback/personal';

export default function FeedbackSync() {
  const [url,setUrl]=useState('http://127.0.0.1:8766');
  const [token,setToken]=useState('');
  const [busy,setBusy]=useState(false);
  const [jobs,setJobs]=useState(personalSync.statuses());
  const [statistics,setStatistics]=useState<PersonalStatistic[]>([]);
  const [message,setMessage]=useState('서버 통계를 아직 조회하지 않았습니다.');
  async function run(action:()=>Promise<PersonalStatistic[]>) {
    setBusy(true);
    try {setStatistics(await action());setMessage('서버 조회 완료. 아래 요청 상태도 확인해 주세요.');}
    catch(error){setMessage(String(error));}
    finally{setJobs(personalSync.statuses());setBusy(false);}
  }
  return <ScrollView contentContainerStyle={{padding:24,gap:12}}>
    <Text style={{fontSize:22}}>내 구매 기록 평균</Text>
    <Text>평균 = 포장지 소비기한 − 구매일. 다른 사람의 기록은 섞지 않습니다. 실제 섭취 가능 기간을 보증하거나 포장지 날짜를 대신하지 않습니다.</Text>
    <Text>팀 시험 서버 연결</Text>
    <TextInput accessibilityLabel="서버 주소" editable={!busy} value={url} onChangeText={setUrl}
      autoCapitalize="none" style={{borderWidth:1,padding:8}} />
    <TextInput accessibilityLabel="계정 토큰" editable={!busy} secureTextEntry value={token} onChangeText={setToken}
      autoCapitalize="none" style={{borderWidth:1,padding:8}} />
    <Text>토큰은 메모리에만 보관합니다. 앱을 완전히 재시작하면 같은 서버·계정으로 다시 연결해 주세요. 구매 기록과 전송 요청은 기기에 남습니다.</Text>
    <Button title="연결하고 전송" disabled={busy || !token} onPress={()=>void run(()=>connectPersonalServer(url,token))} />
    <Button title="재시도·새로고침" disabled={busy || !personalConnectionStatus().connected}
      onPress={()=>void run(syncPersonalNow)} />
    <Text>{message}</Text>
    {statistics.length===0 && <Text>조회된 통계가 없습니다. 품목의 포장지 날짜·보관 조건을 입력하고 평균 반영을 켜 주세요.</Text>}
    {statistics.map(row=><Text key={`${row.foodName}/${row.storage}`}>
      {row.foodName} · {row.storage}: {row.meanDays.toFixed(2)}일 (구매 {row.count}건)
    </Text>)}
    {jobs.map(job=><React.Fragment key={job.id}>
      <Text>{feedbackStore.state().records[job.id]?.item.standardName ?? '품목'}: {job.error ?? (job.localPending || job.request ? '전송 대기' : ({INCLUDED:'평균 반영 완료',WITHDRAWN:'평균 반영 철회 완료',LABEL_REQUIRED:'포장지 날짜 필요',STORAGE_REQUIRED:'보관 조건 필요',UNOPENED_LABEL_ONLY:'개봉품 제외',EXPIRY_BEFORE_PURCHASE:'구매일 이전 날짜 제외'}[job.reason ?? ''] ?? '서버 응답 확인 필요'))}</Text>
      {feedbackStore.state().records[job.id]?.personalAverage && <Button title="이 구매 건의 평균 반영 철회" disabled={busy}
        onPress={()=>{const record=feedbackStore.state().records[job.id];
          feedbackStore.edit(record.item,record.expiry,record.source,false);
          setJobs(personalSync.statuses());
          if(personalConnectionStatus().connected) void run(syncPersonalNow);
        }} />}
      {job.error==='REVISION_CONFLICT' && <Button title="충돌: 이 기기의 값으로 다시 반영" disabled={busy}
        onPress={()=>Alert.alert('서버 기록 변경','다른 기기에서 저장한 값을 이 기기의 값으로 바꿉니다.',[
          {text:'취소',style:'cancel'},{text:'반영',onPress:()=>void run(()=>resolvePersonalConflict(job.id))}])} />}
    </React.Fragment>)}
  </ScrollView>;
}
