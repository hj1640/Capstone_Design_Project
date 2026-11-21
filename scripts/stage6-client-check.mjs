import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createFeedbackStore} from '../src/services/feedback/store.ts';
import {formatDateKo} from '../src/utils/date.ts';
const base=process.argv[2];
assert.equal(formatDateKo('2026-11-12'),'11월 12일');
const token='integration-test-token'; // Accepted only by the temporary integration harness.
const dir=new URL('../.stage0-stage6-client/',import.meta.url);
fs.mkdirSync(dir,{recursive:true});
const file=new URL('state.json',dir);
fs.writeFileSync(file,'');
const storage={getItem:()=>fs.readFileSync(file,'utf8') || null,setItem:(_,v)=>fs.writeFileSync(file,v)};
const make=()=>createFeedbackStore(storage,randomUUID);
const transport=async(method,path,body,key)=>{
  const response=await fetch(base+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',
    ...(key ? {'Idempotency-Key':key} : {})},body:method==='GET' ? undefined : JSON.stringify(body ?? {})});
  return {status:response.status,body:await response.json()};
};
const item={id:'client-item',standardName:'가상 두부',category:'가공식품',storageType:'냉장',icon:'',purchaseDate:'2026-11-01',
  expectedExpiryDate:'2026-11-10',isOpened:false,totalQuantity:1,remainingQuantity:1,unit:'개',consumptionPattern:'주기형',
  nutrition:{calories:0,protein:0,fat:0,carbs:0},source:'온라인주문'};
let store=make();
assert.throws(()=>store.edit(item,'2026-02-30','package_label'));
assert.throws(()=>store.edit(item,'0000-01-01','package_label'));
store.edit(item,'2026-11-12','package_label');
assert.throws(()=>store.submit(item.id,'purchase_remaining',false));
await store.sync(transport,base);
assert.equal((await transport('GET',`/v1/me/items/${item.id}`)).status,404);
store.submit(item.id,'purchase_remaining',true);
await assert.rejects(()=>store.sync(async()=>{throw new Error('offline');},base));
store=make(); // Disk reload after offline process restart.
assert.equal(store.overlay([])[0].expectedExpiryDate,'2026-11-12');
await store.sync(transport,base);
assert.ok(store.state().jobs.filter(j=>j.kind==='submit').every(j=>j.status==='done'));
assert.equal(store.state().jobs.find(j=>j.kind==='submit').receipt.state,'held');
await assert.rejects(()=>store.sync(async()=>({status:200,body:{ownerId:'other',consentVersion:'development-consent-v1'}}),base));

store.edit(item,'2026-11-15','user_estimate');
store.submit(item.id,'purchase_remaining',true);
let lost;
await store.sync(async(...args)=>{
  const response=await transport(...args);
  if (args[0]==='POST') {lost=response.body.feedbackId;throw new Error('response lost');}
  return response;
},base);
assert.ok(lost);
store=make();
await store.sync(transport,base);
assert.equal(store.state().jobs.filter(j=>j.kind==='submit').at(-1).receipt.feedbackId,lost);

store.edit(item,'2026-11-16','package_label');
store.submit(item.id,'purchase_remaining',true);
let unknown;
await store.sync(async(...args)=>{
  const response=await transport(...args);
  if (args[0]==='POST') {unknown=response.body.feedbackId;throw new Error('response lost');}
  return response;
},base);
store.withdraw(item.id);
await store.sync(transport,base);
assert.equal((await transport('GET',`/v1/me/expiry-feedback/${unknown}`)).body.state,'withdrawn');
assert.equal(store.state().records[item.id].expiry,'2026-11-16');

const remote=(await transport('GET',`/v1/me/items/${item.id}`)).body;
await transport('PATCH',`/v1/me/items/${item.id}/expiry`,{expectedRevision:remote.revision,expiryDate:'2026-11-18',source:'package_label'},randomUUID());
store.edit(item,'2026-11-20','user_estimate');
await store.sync(transport,base);
assert.ok(store.state().jobs.some(j=>j.status==='conflict'));
assert.equal(store.state().records[item.id].expiry,'2026-11-20');
await store.resolveConflict(item.id,transport,base,true);
await store.sync(transport,base);
assert.equal((await transport('GET',`/v1/me/items/${item.id}`)).body.overrideExpiryDate,'2026-11-20');

store.edit(item,'2026-11-21','user_estimate');
let newer=false;
await store.sync(async(...args)=>{
  const response=await transport(...args);
  if (!newer && args[0]==='PATCH') {newer=true;store.edit(item,'2026-11-22','package_label');}
  return response;
},base);
assert.equal(store.state().records[item.id].expiry,'2026-11-22');
assert.equal((await transport('GET',`/v1/me/items/${item.id}`)).body.overrideExpiryDate,'2026-11-22');
store.edit(item,null,null);
assert.equal(make().overlay([])[0].expectedExpiryDate,'2026-11-10');
store.hide(item);
assert.equal(make().overlay([item]).length,0);
await store.sync(transport,base);
const other={...item,id:'retry-after-item'};
store.edit(other,'2026-11-12','package_label');
store.submit(other.id,'purchase_remaining',true);
await store.sync(async(...args)=>args[0]==='GET' ? transport(...args) :
  {status:429,body:{},retryAfterMs:60000},base);
let prematureWrites=0;
await store.sync(async(...args)=>{if(args[0]!=='GET') prematureWrites++;return transport(...args);},base);
assert.equal(prematureWrites,0);
const report={timestamp:new Date().toISOString(),node:process.version,platform:process.platform,
  tests:['calendar validation','explicit consent','disk restart','offline retry','duplicate protection after lost response',
    'withdraw unknown receipt','account isolation','revision conflict','explicit conflict retry',
    'concurrent local edit survives response','clear override','hidden item stays hidden',
    'unconsented initial edit is local only','Retry-After blocks dependent writes'],passed:true};
fs.writeFileSync(new URL('../benchmarks/stage6-client-checks.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log('PASS: persistent client outbox / real HTTP server integration');
