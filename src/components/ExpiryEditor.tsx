import React, { useState } from 'react';
import { Alert, Button, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useFridge } from '@/context/FridgeContext';
import { feedbackStore } from '@/services/feedback/local';
import type { FoodItem, StorageType } from '@/types/food';

export function ExpiryEditor({item}:{item:FoodItem}) {
  const {savePersonalExpiry}=useFridge();
  const record=feedbackStore.state().records[item.id];
  const [name,setName]=useState(item.standardName);
  const [purchaseDate,setPurchaseDate]=useState(item.purchaseDate);
  const [opened,setOpened]=useState(item.isOpened);
  const [date,setDate]=useState(record?.source==='package_label' ? record.expiry ?? '' : '');
  const [storage,setStorage]=useState<StorageType>(item.storageType);
  const [include,setInclude]=useState(record?.personalAverage===true);
  function save(clear=false) {
    try {
      savePersonalExpiry({...item,standardName:name.trim(),purchaseDate,isOpened:opened,storageType:storage},clear ? null : date,clear ? null : 'package_label',include);
      if(clear) setDate('');
      Alert.alert('기기에 저장 완료','서버 연결 중이면 내 평균에 반영을 시도합니다. 전송 상태는 내 평균 화면에서 확인해 주세요.');
    } catch(error) {Alert.alert('저장 실패',String(error));}
  }
  return <View style={{gap:10}}>
    <Text style={{fontWeight:'700'}}>포장지 소비기한</Text>
    <Text>평균을 묶을 식품명 (예: 두부)</Text>
    <TextInput accessibilityLabel="평균을 묶을 식품명" value={name} onChangeText={setName} style={{borderWidth:1,padding:10}} />
    <Text>실제 구매일 (인식이 틀렸다면 수정)</Text>
    <TextInput accessibilityLabel="구매일 수정" value={purchaseDate} onChangeText={setPurchaseDate}
      placeholder="YYYY-MM-DD" style={{borderWidth:1,padding:10}} />
    <Text>포장지에 표시된 날짜</Text>
    <TextInput accessibilityLabel="포장지 소비기한 날짜" value={date} onChangeText={setDate}
      placeholder="YYYY-MM-DD" style={{borderWidth:1,padding:10}} />
    <Text>보관 조건</Text>
    {(['냉장','냉동','실온','미정'] as const).map(value=><Button key={value}
      title={`${storage===value ? '✓ ' : ''}${value}`} onPress={()=>setStorage(value)} />)}
    <Text>이 날짜를 기록할 때 이미 개봉한 품목</Text>
    <Switch accessibilityLabel="기록 당시 개봉 여부" value={opened} onValueChange={setOpened} />
    <Text>이 구매 건을 내 평균에 반영</Text>
    <Switch accessibilityLabel="이 구매 건을 내 평균에 반영" value={include} onValueChange={setInclude} />
    <Text>포장지 날짜에서 구매일을 뺀 일수를, 같은 식품명·보관 조건끼리 평균냅니다. 개봉품·보관 조건 미정·구매일 이전 날짜는 평균에서 제외합니다.</Text>
    <Text>스위치를 끄고 저장하면 평균 반영을 철회합니다. 서버 전송 전까지 기존 서버 값은 남아 있습니다.</Text>
    <Button title="날짜와 평균 설정 저장" onPress={()=>save()} />
    <Button title="포장지 날짜 해제" onPress={()=>save(true)} />
    <Button title="내 평균·전송 상태" onPress={()=>router.push('/feedback-sync')} />
  </View>;
}
