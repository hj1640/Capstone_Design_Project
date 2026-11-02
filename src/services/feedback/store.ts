import type { FoodItem, PurchaseHistoryEntry } from '../../types/food';
import type { PersonalItem, DurationBasis } from '../../contracts/catalog-v1';

export type EditSource = 'package_label' | 'user_estimate';
interface RecordValue {
  item: FoodItem;
  baseExpiry: string | null;
  expiry: string | null;
  source: EditSource | null;
  revision: number;
  serverRevision: number;
  hidden?: boolean;
  history?: PurchaseHistoryEntry;
}
interface Job {
  id: string;
  kind: 'edit' | 'submit' | 'withdraw';
  itemId: string;
  status: 'pending' | 'done' | 'conflict' | 'failed' | 'cancelled';
  snapshot?: RecordValue;
  basis?: DurationBasis;
  submitKey?: string;
  request?: { method: string; path: string; body: object };
  error?: string;
  receipt?: object;
  retryAt?: number;
}
interface State { version: 1; binding?: string; records: Record<string,RecordValue>; jobs: Job[] }
export interface Storage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type Transport = (method: string, path: string, body?: object, key?: string)=>Promise<{status:number; body:Record<string,unknown>; retryAfterMs?:number}>;
const KEY='expiry-feedback-v1';

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  if (value.startsWith('0000-')) return false;
  const time=Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0,10)===value;
}

export function createFeedbackStore(storage: Storage, newId: ()=>string) {
  let syncing=false;
  const read=(): State => {
    const raw=storage.getItem(KEY);
    const state: State=raw ? JSON.parse(raw) : {version:1,records:{},jobs:[]};
    if (state.version!==1 || !state.records || !Array.isArray(state.jobs)) throw new Error('Unsupported local data');
    return state;
  };
  const write=(state: State)=>storage.setItem(KEY,JSON.stringify(state));
  function cancelSubmissions(state: State,itemId: string) {
    for (const job of [...state.jobs]) {
      if (job.itemId!==itemId || job.kind!=='submit' || job.status==='cancelled') continue;
      job.status='cancelled';
      // Tombstone works even if a POST succeeded but its response was lost.
      state.jobs.push({id:newId(),kind:'withdraw',itemId,submitKey:job.id,status:'pending'});
    }
  }
  return {
    state: read,
    remember(items: FoodItem[],history: PurchaseHistoryEntry[]) {
      if (items.length!==history.length) throw new Error('Purchase snapshot mismatch');
      const state=read();
      items.forEach((item,i)=>{
        if (state.records[item.id]) throw new Error('Duplicate local item ID');
        state.records[item.id]={item,baseExpiry:item.expectedExpiryDate,expiry:null,source:null,
          revision:0,serverRevision:0,history:history[i]};
      });
      write(state);
    },
    purchaseHistory(): PurchaseHistoryEntry[] {
      return Object.values(read().records).flatMap(record=>record.history ? [record.history] : []);
    },
    edit(item: FoodItem,expiry: string | null,source: EditSource | null) {
      if (expiry!==null && !validDate(expiry)) throw new Error('YYYY-MM-DD 형식의 실제 날짜를 입력해 주세요');
      if ((expiry===null && source!==null) || (expiry!==null && source!=='package_label' && source!=='user_estimate'))
        throw new Error('날짜의 근거를 선택해 주세요');
      const state=read(), previous=state.records[item.id];
      cancelSubmissions(state,item.id);
      for (const job of state.jobs) if (job.itemId===item.id && job.kind==='edit' && job.status==='pending' && !job.request)
        job.status='cancelled'; // Coalesce edits which have never been sent.
      const record: RecordValue={item,baseExpiry:previous ? previous.baseExpiry : item.expectedExpiryDate,expiry,source,
        revision:(previous?.revision ?? 0)+1,serverRevision:previous?.serverRevision ?? 0,history:previous?.history};
      state.records[item.id]=record;
      state.jobs.push({id:newId(),kind:'edit',itemId:item.id,snapshot:JSON.parse(JSON.stringify(record)),status:'pending'});
      write(state);
    },
    submit(itemId: string,basis: DurationBasis,consent: boolean) {
      if (!consent) throw new Error('공유 제출 동의가 필요합니다');
      if (!['purchase_remaining','after_opening'].includes(basis)) throw new Error('기간 의미를 선택해 주세요');
      const state=read(),record=state.records[itemId];
      if (!record?.expiry || record.hidden) throw new Error('먼저 개인 소비기한을 저장해 주세요');
      if (state.jobs.some(j=>j.itemId===itemId && j.kind==='submit' && j.status!=='cancelled'))
        throw new Error('이미 제출했거나 전송 대기 중입니다');
      state.jobs.push({id:newId(),kind:'submit',itemId,basis,status:'pending'});
      write(state);
    },
    withdraw(itemId: string) {
      const state=read(); cancelSubmissions(state,itemId); write(state);
    },
    hide(item: FoodItem) {
      const state=read(); cancelSubmissions(state,item.id);
      if (state.records[item.id]) state.records[item.id].hidden=true;
      write(state);
    },
    overlay(items: FoodItem[]): FoodItem[] {
      const records=read().records;
      const merged=new Map(items.map(item=>[item.id,item]));
      for (const [id,record] of Object.entries(records)) {
        if (record.hidden) merged.delete(id);
        else merged.set(id,{...(merged.get(id) ?? record.item),expectedExpiryDate:record.expiry ?? record.baseExpiry});
      }
      return [...merged.values()];
    },
    async resolveConflict(itemId: string,transport: Transport,serverIdentity: string,keepLocal: boolean) {
      if (syncing) throw new Error('동기화가 끝난 뒤 충돌을 해결해 주세요');
      const auth=await transport('GET','/v1/me');
      const state=read();
      if (auth.status!==200 || state.binding!==`${serverIdentity}|${auth.body.ownerId}`)
        throw new Error('기존 서버/계정으로 연결해 주세요');
      const response=await transport('GET',`/v1/me/items/${encodeURIComponent(itemId)}`);
      if (response.status!==200 || !Number.isInteger(response.body.revision)) throw new Error('서버 기록을 읽지 못했습니다');
      const latest=read(),record=latest.records[itemId];
      cancelSubmissions(latest,itemId);
      for (const job of latest.jobs) if (job.itemId===itemId && job.kind==='edit' && job.status!=='done') job.status='cancelled';
      record.serverRevision=Number(response.body.revision);
      if (keepLocal) latest.jobs.push({id:newId(),kind:'edit',itemId,status:'pending',snapshot:JSON.parse(JSON.stringify(record))});
      else {
        record.expiry=response.body.overrideExpiryDate as string | null;
        record.source=response.body.overrideSource as EditSource | null;
      }
      write(latest);
    },
    async sync(transport: Transport, serverIdentity: string) {
      if (syncing) throw new Error('동기화 중입니다');
      syncing=true;
      try {
        const auth=await transport('GET','/v1/me');
        if (auth.status!==200 || typeof auth.body.ownerId!=='string' || auth.body.consentVersion!=='development-consent-v1')
          throw new Error('서버 인증 또는 동의 버전 확인에 실패했습니다');
        const binding=`${serverIdentity}|${auth.body.ownerId}`;
        const initial=read();
        if (initial.binding && initial.binding!==binding) throw new Error('다른 서버/계정의 대기열을 전송할 수 없습니다');
        initial.binding=binding; write(initial);
        for (;;) {
          const state=read();
          const blocked=new Set(state.jobs.filter(j=>j.status==='conflict' || j.status==='failed').map(j=>j.itemId));
          const consented=new Set(state.jobs.filter(j=>j.kind==='submit' && j.status!=='cancelled').map(j=>j.itemId));
          const ready=(j: Job)=>j.status==='pending' && (!j.retryAt || j.retryAt<=Date.now());
          const job=state.jobs.find(j=>ready(j) && j.kind==='withdraw') ??
            state.jobs.find((j,i)=>ready(j) && !blocked.has(j.itemId) &&
              !state.jobs.slice(0,i).some(older=>older.itemId===j.itemId && older.status==='pending' && older.kind!=='withdraw') &&
              (consented.has(j.itemId) || state.records[j.itemId].serverRevision>0 || !!j.request));
          if (!job) break;
          const record=state.records[job.itemId];
          if (!job.request) {
            if (job.kind==='edit') {
              const snapshot=job.snapshot!;
              if (record.serverRevision===0) {
                const item: PersonalItem={itemId:job.itemId,foodId:null,productId:null,
                  purchaseDate:validDate(snapshot.item.purchaseDate) ? snapshot.item.purchaseDate : null,
                  openedDate:null,conditions:null,suggestedExpiryDate:snapshot.baseExpiry,
                  overrideExpiryDate:snapshot.expiry,overrideSource:snapshot.source,ruleSnapshot:null,revision:1};
                job.request={method:'PUT',path:`/v1/me/items/${encodeURIComponent(job.itemId)}`,body:{item,expectedRevision:0}};
              } else job.request={method:'PATCH',path:`/v1/me/items/${encodeURIComponent(job.itemId)}/expiry`,
                body:{expectedRevision:record.serverRevision,expiryDate:snapshot.expiry,source:snapshot.source}};
            } else if (job.kind==='submit') job.request={method:'POST',path:'/v1/me/expiry-feedback',
              body:{itemId:job.itemId,itemRevision:record.serverRevision,basis:job.basis,consentVersion:'development-consent-v1'}};
            else job.request={method:'DELETE',path:`/v1/me/expiry-feedback/by-key/${encodeURIComponent(job.submitKey!)}`,body:{}};
            write(state); // Persist exact request before network I/O, including timeout/restart cases.
          }
          let response;
          try { response=await transport(job.request.method,job.request.path,job.request.body,job.id); }
          catch { break; } // Leave stable key/payload for reconnect or response-loss recovery.
          const latest=read(),current=latest.jobs.find(j=>j.id===job.id)!;
          if (response.status>=500 || response.status===429 || response.status===401) {
            if (response.retryAfterMs) current.retryAt=Date.now()+response.retryAfterMs;
            write(latest); break;
          }
          if (response.status>=400) {
            if (current.status!=='cancelled') current.status=response.status===409 ? 'conflict' : 'failed';
            current.error=String((response.body.error as {code?:string})?.code ?? response.status);
          } else {
            if (current.status!=='cancelled') current.status='done';
            current.receipt=response.body;
            if (job.kind==='edit') latest.records[job.itemId].serverRevision=Number(response.body.revision);
          }
          write(latest);
        }
      } finally { syncing=false; }
    },
  };
}
