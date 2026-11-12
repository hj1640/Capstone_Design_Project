import Storage from 'expo-sqlite/kv-store';
import { randomUUID } from 'expo-crypto';
import { createFeedbackStore } from './store';
import type { Transport } from './store';
import { createPersonalSync } from './personal';

export const feedbackStore=createFeedbackStore({getItem:key=>Storage.getItemSync(key),
  setItem:(key,value)=>Storage.setItemSync(key,value)},randomUUID);

export const personalSync=createPersonalSync({getItem:key=>Storage.getItemSync(key),
  setItem:(key,value)=>Storage.setItemSync(key,value)},randomUUID,()=>feedbackStore.state().records);
let connection: {transport: Transport; identity: string} | undefined;
let lastError: string | undefined;
export const personalConnectionStatus=()=>({connected:!!connection,lastError});
export async function connectPersonalServer(url: string, token: string) {
  const candidate={transport:developmentTransport(url,token),identity:new URL(url).origin};
  await personalSync.statistics(candidate.transport,candidate.identity);
  connection=candidate;
  return syncPersonalNow();
}
export async function syncPersonalNow() {
  if (!connection) throw new Error('시험 서버에 먼저 연결해 주세요');
  await personalSync.sync(connection.transport,connection.identity);
  const statistics=await personalSync.statistics(connection.transport,connection.identity);
  lastError=undefined;
  return statistics;
}
export async function resolvePersonalConflict(id: string) {
  if (!connection) throw new Error('시험 서버에 먼저 연결해 주세요');
  await personalSync.resolveWithLocal(id,connection.transport,connection.identity);
  return syncPersonalNow();
}
export function schedulePersonalSync() {
  if (connection) void syncPersonalNow().catch(error=>{lastError=String(error);});
}

export function developmentTransport(url: string,token: string): Transport {
  const base=new URL(url);
  if (!['http:','https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash)
    throw new Error('서버 주소를 확인해 주세요');
  return async (method,path,body,key)=>{
    const legacyBinding=feedbackStore.state().binding;
    // Existing v1 data must not silently move to another owner's account.
    if(path==='/v1/me' && legacyBinding && !legacyBinding.startsWith(`${base.origin}|`))
      throw new Error('기존 기록의 서버로 연결해 주세요');
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),30000); // Development network timeout, not a model policy.
    try {
      const response=await fetch(new URL(path,base).toString(),{method,signal:controller.signal,
        headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(key ? {'Idempotency-Key':key} : {})},
        body:method==='GET' ? undefined : JSON.stringify(body ?? {})});
      const retry=response.headers.get('Retry-After');
      const retryAfterMs=retry ? (/^\d+$/.test(retry) ? Number(retry)*1000 : Math.max(0,Date.parse(retry)-Date.now())) : undefined;
      const data=await response.json();
      if(path==='/v1/me' && response.status===200 && legacyBinding && legacyBinding!==`${base.origin}|${data.ownerId}`)
        throw new Error('기존 기록의 계정으로 연결해 주세요');
      return {status:response.status,body:data,retryAfterMs};
    } finally {clearTimeout(timeout);}
  };
}
