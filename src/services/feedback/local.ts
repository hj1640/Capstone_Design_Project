import Storage from 'expo-sqlite/kv-store';
import { randomUUID } from 'expo-crypto';
import { createFeedbackStore } from './store';
import type { Transport } from './store';

export const feedbackStore=createFeedbackStore({getItem:key=>Storage.getItemSync(key),
  setItem:(key,value)=>Storage.setItemSync(key,value)},randomUUID);

export function developmentTransport(url: string,token: string): Transport {
  const base=new URL(url);
  if (!['http:','https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash)
    throw new Error('서버 주소를 확인해 주세요');
  return async (method,path,body,key)=>{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),30000); // Development network timeout, not a model policy.
    try {
      const response=await fetch(new URL(path,base).toString(),{method,signal:controller.signal,
        headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(key ? {'Idempotency-Key':key} : {})},
        body:method==='GET' ? undefined : JSON.stringify(body ?? {})});
      const retry=response.headers.get('Retry-After');
      const retryAfterMs=retry ? (/^\d+$/.test(retry) ? Number(retry)*1000 : Math.max(0,Date.parse(retry)-Date.now())) : undefined;
      return {status:response.status,body:await response.json(),retryAfterMs};
    } finally {clearTimeout(timeout);}
  };
}
