import Storage from 'expo-sqlite/kv-store';
import * as SecureStore from 'expo-secure-store';
import { getRandomBytesAsync, randomUUID } from 'expo-crypto';
import { createFeedbackStore } from './store';
import type { Transport } from './store';
import { createPersonalSync } from './personal';
import type { PersonalStatistic } from './personal';
import { createSessionManager, serverOrigin } from './session';
import { createSyncController } from './controller';

const adapter={getItem:(key:string)=>Storage.getItemSync(key),setItem:(key:string,value:string)=>Storage.setItemSync(key,value)};
export const feedbackStore=createFeedbackStore(adapter,randomUUID);
export const personalSync=createPersonalSync(adapter,randomUUID,()=>feedbackStore.state().records);
export const configuredServerUrl=process.env.EXPO_PUBLIC_API_URL ?? '';
let statistics: PersonalStatistic[]=[];
const listeners=new Set<()=>void>();
const notify=()=>listeners.forEach(listener=>listener());
export function subscribePersonalState(listener:()=>void) {listeners.add(listener);return ()=>{listeners.delete(listener);};}
const sessions=createSessionManager({
  get:()=>SecureStore.getItemAsync('fridge-service-session-v1'),
  set:value=>SecureStore.setItemAsync('fridge-service-session-v1',value),
  clear:()=>SecureStore.deleteItemAsync('fridge-service-session-v1'),
},async()=>Array.from(await getRandomBytesAsync(32),value=>value.toString(16).padStart(2,'0')).join(''),
  developmentTransport,async candidate=>{statistics=await personalSync.statistics(candidate.transport,candidate.url);},__DEV__);

const controller=createSyncController({
  async run(){
    await sessions.restore();
    const connection=sessions.client();
    if(!connection) return statistics;
    await personalSync.sync(connection.transport,connection.url);
    statistics=await personalSync.statistics(connection.transport,connection.url);
    return statistics;
  },
  pending:()=>personalSync.statuses().some(job=>(job.localPending || job.request) && !job.error),
  hasCredential:()=>sessions.status().saved,
  changed:notify,
  later:(callback,ms)=>{const timer=setTimeout(callback,ms);return ()=>clearTimeout(timer);},
});
export const personalConnectionStatus=()=>({...sessions.status(),lastError:controller.error()});
export const personalStatistics=()=>statistics;
export async function connectPersonalServer(url:string,code:string) {
  await sessions.enroll(url,code);
  notify();
  return syncPersonalNow();
}
export async function disconnectPersonalServer() {
  controller.reset();
  await controller.current()?.catch(()=>undefined);
  await sessions.disconnect();statistics=[];controller.reset();
  notify();
}
export function syncPersonalNow(): Promise<PersonalStatistic[]> {
  return controller.sync();
}
export async function resolvePersonalConflict(id:string) {
  await controller.current();
  await sessions.restore();
  const connection=sessions.client();
  if(!connection) throw new Error('서버에 먼저 연결해 주세요');
  await personalSync.resolveWithLocal(id,connection.transport,connection.url);
  return syncPersonalNow();
}
export function schedulePersonalSync() {
  controller.schedule();
}
export function setPersonalAppActive(value:boolean) {
  controller.setActive(value);
}

export function developmentTransport(url:string,token:string): Transport {
  const base=serverOrigin(url,__DEV__);
  return async(method,path,body,key)=>{
    const legacyBinding=feedbackStore.state().binding;
    if(path==='/v1/me' && legacyBinding && !legacyBinding.startsWith(`${base}|`))
      throw new Error('기존 기록의 서버로 연결해 주세요');
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),30000);
    try {
      const response=await fetch(new URL(path,base).toString(),{method,signal:controller.signal,
        headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(key ? {'Idempotency-Key':key} : {})},
        body:method==='GET' ? undefined : JSON.stringify(body ?? {})});
      const retry=response.headers.get('Retry-After');
      const parsed=retry ? (/^\d+$/.test(retry) ? Number(retry)*1000 : Math.max(0,Date.parse(retry)-Date.now())) : undefined;
      const retryAfterMs=parsed!==undefined && Number.isFinite(parsed) ? parsed : undefined;
      const data=await response.json();
      if(path==='/v1/me' && response.status===200 && legacyBinding && legacyBinding!==`${base}|${data.ownerId}`)
        throw new Error('기존 기록의 계정으로 연결해 주세요');
      return {status:response.status,body:data,retryAfterMs};
    } finally {clearTimeout(timeout);}
  };
}
