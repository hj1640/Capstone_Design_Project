import React, { useState } from 'react';
import { Alert, Button, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useFridge } from '@/context/FridgeContext';
import { feedbackStore } from '@/services/feedback/local';
import type { EditSource } from '@/services/feedback/store';
import type { FoodItem } from '@/types/food';

export function ExpiryEditor({item}:{item:FoodItem}) {
  const {savePersonalExpiry}=useFridge();
  const record=feedbackStore.state().records[item.id];
  const [date,setDate]=useState(record?.expiry ?? item.expectedExpiryDate ?? '');
  const [source,setSource]=useState<EditSource | null>(record?.source ?? null);
  function save(clear=false) {
    try { savePersonalExpiry(item,clear ? null : date,clear ? null : source);
      Alert.alert('저장 완료',clear ? '개인 날짜를 해제했습니다.' : '내 소비기한을 기기에 저장했습니다.'); }
    catch (error) {Alert.alert('저장 실패',String(error));}
  }
  return <View style={{gap:10}}>
    <Text style={{fontWeight:'700'}}>내 소비기한 수정</Text>
    <TextInput accessibilityLabel="소비기한 날짜" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD"
      style={{borderWidth:1,padding:10}} />
    <Button title={`${source==='package_label' ? '✓ ' : ''}포장지에 표시된 날짜`} onPress={()=>setSource('package_label')} />
    <Button title={`${source==='user_estimate' ? '✓ ' : ''}내가 예상한 날짜`} onPress={()=>setSource('user_estimate')} />
    <Button title="내 날짜 저장" onPress={()=>save()} />
    <Button title="개인 날짜 해제" onPress={()=>save(true)} />
    <Text>개인 수정은 자동으로 공유되지 않습니다.</Text>
    {__DEV__ && <Button title="개발용: 수정값 제출·철회" onPress={()=>router.push({pathname:'/feedback-sync',params:{itemId:item.id}})} />}
  </View>;
}
