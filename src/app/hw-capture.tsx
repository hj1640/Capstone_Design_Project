import React, { useEffect, useRef, useState } from 'react';
import { AppState, Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { useFridge } from '@/context/FridgeContext';
import { signIn, type Auth } from '@/services/hardware/firebase';
import { ANGLES, VIEWS, createSession, readSession, requestCapture, type Session } from '@/services/hardware/capture';
import { colors } from '@/constants/theme';
const WAITING = ['pending','capturing','uploading','ready_for_inference','processing'];
export default function HardwareCaptureScreen() {
  const {id} = useLocalSearchParams<{id:string}>();
  const {fridgeItems}=useFridge();
  const item=fridgeItems.find(i=>i.id===id);
  const [email,setEmail]=useState('fridge-test@example.com');
  const [password,setPassword]=useState('');
  const [auth,setAuth]=useState<Auth|null>(null);
  const [session,setSession]=useState<Session|null>(null);
  const [sessionId,setSessionId]=useState('');
  const [mode,setMode]=useState<Session['mode']>('T0');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [active,setActive]=useState(AppState.currentState==='active');
  const lock=useRef(false);
  useEffect(()=>{const sub=AppState.addEventListener('change',s=>setActive(s==='active'));return()=>sub.remove();},[]);
  async function run(fn:()=>Promise<void>) {
    if(lock.current)return; lock.current=true;setBusy(true);setError('');
    try{await fn();}catch(e){setError(e instanceof Error?e.message:'통신 실패');}finally{lock.current=false;setBusy(false);}
  }
  useEffect(()=>{
    if(!auth||!session||!active||!id||!WAITING.includes(session.status))return;
    let disposed=false; let inFlight=false;
    const timer=setInterval(async()=>{
      if(disposed||inFlight||lock.current)return;
      inFlight=true;
      try{const fresh=await readSession(auth,session.id,id);if(!disposed&&!lock.current){setSession(fresh);setError('');}}
      catch(e){if(!disposed)setError(e instanceof Error?e.message:'상태 조회 실패');}
      finally{inFlight=false;}
    },5000);
    return()=>{disposed=true;clearInterval(timer);};
  },[auth,session,active,id]);
  if(!item||!id)return <Text style={styles.text}>품목을 찾을 수 없습니다.</Text>;
  return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>{item.standardName} · 카메라 측정</Text>
    <Text style={styles.text}>개발용 기능입니다. 실제 장치 응답이 있어야 진행되며 기존 잔여량은 변경하지 않습니다.</Text>
    {!auth?<View style={styles.card}>
      <Text style={styles.text}>Firebase HW 테스트 계정 로그인</Text>
      <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="이메일"/>
      <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} placeholder="비밀번호"/>
      <Button title="로그인" disabled={busy||!email.trim()||!password} onPress={()=>void run(async()=>{try{setAuth(await signIn(email.trim(),password));}finally{setPassword('');}})}/>
    </View>:<>
      <Text style={styles.text}>인증됨 · fridge_01 (장치 연결 여부는 아직 확인하지 않음)</Text>
      {!session&&<View style={styles.card}>
        <Text style={styles.text}>측정 상태 선택 (실험용 태그)</Text>
        <View style={styles.row}>{(['T0','T1','T2'] as const).map(m=><Button key={m} title={mode===m?`✓ ${m}`:m} disabled={busy} onPress={()=>setMode(m)}/>)}</View>
        <Button title="새 촬영 세션 생성" disabled={busy||!!sessionId} onPress={()=>void run(async()=>{const sid=randomUUID();setSessionId(sid);setSession(await createSession(auth,sid,id,item.standardName,mode));})}/>
        <Text style={styles.text}>기존 세션 복구 (응답 유실 또는 화면 재진입 시)</Text>
        <TextInput style={styles.input} autoCapitalize="none" value={sessionId} onChangeText={setSessionId} placeholder="촬영 세션 ID"/>
        <Button title="세션 불러오기" disabled={busy||!sessionId.trim()} onPress={()=>void run(async()=>setSession(await readSession(auth,sessionId.trim(),id)))}/>
      </View>}
      {session&&<View style={styles.card}>
        <Text selectable style={styles.text}>세션 ID: {session.id}</Text>
        <Text style={styles.title}>{session.imageCount}/9장 · {session.mode}</Text>
        <Text style={styles.text}>상태: {session.status}</Text>
        {VIEWS.map((v,i)=><Text key={v} style={styles.text}>{i<session.imageCount?'완료':'대기'} · {v}</Text>)}
        {session.status==='waiting_angle'&&session.step<8&&<>
          <Text style={styles.title}>회전판을 {ANGLES[session.step]}°에 맞춰주세요.</Text>
          <Text style={styles.text}>{session.step===0?'위쪽 1장 + 측면 1장':'측면 1장'} · 회전판이 멈춘 후 촬영</Text>
          <Button title={`${ANGLES[session.step]}° 촬영 요청`} disabled={busy} onPress={()=>void run(async()=>{try{await requestCapture(auth,session);}finally{setSession(await readSession(auth,session.id,id));}})}/>
        </>}
        {WAITING.includes(session.status)&&<Text style={styles.text}>장치 또는 분석 프로그램의 응답을 기다리는 중입니다. 5초마다 상태를 조회합니다.</Text>}
        {session.status==='failed'&&<Text style={styles.error}>실패: {session.error||'장치 로그를 확인하세요.'}</Text>}
        {session.status==='completed'&&<Text style={styles.text}>분석 완료 상태 수신. 결과 반영은 후속 단계입니다.</Text>}
        <Button title="상태 새로고침" disabled={busy} onPress={()=>void run(async()=>setSession(await readSession(auth,session.id,id)))}/>
        <Button title="세션 화면 닫기 (서버 작업 취소 아님)" disabled={busy} onPress={()=>{setSession(null);setSessionId('');}}/>
      </View>}
      <Button title="HW 계정 로그아웃" disabled={busy} onPress={()=>{setAuth(null);setSession(null);setSessionId('');setError('');}}/>
    </>}
    {busy&&<Text style={styles.text}>통신 중…</Text>}
    {!!error&&<Text style={styles.error}>{error}</Text>}
  </ScrollView>;
}
const styles=StyleSheet.create({container:{padding:16,gap:12,backgroundColor:colors.background},card:{padding:16,gap:12,backgroundColor:colors.card,borderRadius:12},title:{fontSize:18,fontWeight:'700',color:colors.textPrimary},text:{fontSize:14,color:colors.textPrimary},input:{borderWidth:1,borderColor:colors.border,borderRadius:8,padding:12,color:colors.textPrimary},row:{flexDirection:'row',justifyContent:'space-around'},error:{color:colors.statusDanger}});
