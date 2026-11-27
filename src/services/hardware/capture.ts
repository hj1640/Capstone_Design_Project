import { commit, decode, documentName, fields, getDoc, type Auth, type Doc } from './firebase';
export const ANGLES = [0,45,90,135,180,225,270,315] as const;
export const VIEWS = ['top', ...ANGLES.map(a=>`side_${String(a).padStart(3,'0')}`)];
export const DEVICE_ID = 'fridge_01';
export type Status = 'waiting_angle' | 'pending' | 'capturing' | 'uploading' | 'ready_for_inference' | 'processing' | 'completed' | 'failed';
export type Session = { id:string; ownerUid:string; itemId:string; itemName:string; step:number; imageCount:number; status:Status; updateTime:string; mode:'T0'|'T1'|'T2'; error:string };
export function viewsForStep(step:number):string[] {
  if (!Number.isInteger(step)||step<0||step>=ANGLES.length) throw new Error('잘못된 촬영 단계');
  return step===0 ? VIEWS.slice(0,2) : [VIEWS[step+1]];
}
export function parseSession(doc:Doc,auth:Auth,itemId:string):Session {
  const d=decode(doc); const step=Number(d.step); const count=Number(d.image_count);
  const statuses=['waiting_angle','pending','capturing','uploading','ready_for_inference','processing','completed','failed'];
  if(d.owner_uid!==auth.localId||d.item_id!==itemId||d.device_id!==DEVICE_ID) throw new Error('현재 사용자/품목의 촬영 세션이 아닙니다.');
  if(!Number.isInteger(step)||step<0||step>8||count!==(step===0?0:step+1)||!statuses.includes(String(d.status))||!['T0','T1','T2'].includes(String(d.mode))) throw new Error('촬영 상태 데이터가 올바르지 않습니다.');
  return {id:doc.name.split('/').pop()!,ownerUid:auth.localId,itemId,itemName:String(d.item_name),step,imageCount:count,status:d.status as Status,updateTime:doc.updateTime,mode:d.mode as Session['mode'],error:String(d.error||'')};
}
export async function readSession(auth:Auth,id:string,itemId:string) {
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new Error('세션 ID를 확인하세요.');
  return parseSession(await getDoc(auth,'capture_sessions',id),auth,itemId);
}
export async function createSession(auth:Auth,id:string,itemId:string,itemName:string,mode:Session['mode']) {
  await commit(auth,[{update:{name:documentName('capture_sessions',id),fields:fields({owner_uid:auth.localId,device_id:DEVICE_ID,item_id:itemId,item_name:itemName,mode,step:0,image_count:0,status:'waiting_angle',error:'',protocol_version:1})},currentDocument:{exists:false},updateTransforms:[{fieldPath:'created_at',setToServerValue:'REQUEST_TIME'}]}]);
  return readSession(auth,id,itemId);
}
export async function requestCapture(auth:Auth,s:Session) {
  if(s.status!=='waiting_angle'||s.step>=8) throw new Error('현재 촬영 요청을 보낼 수 없습니다.');
  const commandId=`${s.id}_${s.step}`;
  await commit(auth,[
    {update:{name:documentName('capture_commands',commandId),fields:fields({owner_uid:auth.localId,device_id:DEVICE_ID,session_id:s.id,step:s.step,angle:ANGLES[s.step],views:viewsForStep(s.step).join(','),status:'pending',protocol_version:1})},currentDocument:{exists:false},updateTransforms:[{fieldPath:'created_at',setToServerValue:'REQUEST_TIME'}]},
    {update:{name:documentName('capture_sessions',s.id),fields:fields({status:'pending',command_id:commandId})},updateMask:{fieldPaths:['status','command_id']},currentDocument:{updateTime:s.updateTime}}
  ]);
}
