import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {createSessionManager,serverOrigin} from '../src/services/feedback/session.ts';
import {createFeedbackStore} from '../src/services/feedback/store.ts';
import {createPersonalSync} from '../src/services/feedback/personal.ts';
import {buildRegistration} from '../src/services/registration.ts';
import {deployment} from '../config/deployment.cjs';
const [base,folder,phase]=process.argv.slice(2);
const file=name=>path.join(folder,name+'.json');
const storage={getItem:key=>fs.existsSync(file(key)) ? fs.readFileSync(file(key),'utf8') : null,
  setItem:(key,value)=>fs.writeFileSync(file(key),value)};
const secretStorage={get:async()=>storage.getItem('native-secret-ADAPTER'),
  set:async value=>storage.setItem('native-secret-ADAPTER',value),
  clear:async()=>fs.rmSync(file('native-secret-ADAPTER'),{force:true})};
const fixture=JSON.parse(fs.readFileSync(file('private-fixture'),'utf8'));
const store=createFeedbackStore(storage,randomUUID);
const sync=createPersonalSync(storage,randomUUID,()=>store.state().records);
const transport=(url,token)=>async(method,route,body,key)=>{
  const response=await fetch(url+route,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,
    ...(key ? {'Idempotency-Key':key} : {})},body:method==='GET' ? undefined : JSON.stringify(body ?? {})});
  return {status:response.status,body:await response.json()};
};
const verify=candidate=>sync.statistics(candidate.transport,candidate.url);
const newSecret=async()=>randomBytes(32).toString('hex');
const newManager=(factory=transport,secrets=secretStorage,verifier=verify)=>createSessionManager(secrets,newSecret,factory,verifier,true);
if(phase==='first') {
  assert.throws(()=>serverOrigin(base));
  for(const value of ['http://10.0.0.2','https://user:pass@example.test','https://example.test/path','https://example.test?token=x'])
    assert.throws(()=>serverOrigin(value,true));
  assert.throws(()=>deployment({},true),/빌드 설정/);
  assert.throws(()=>deployment({FRIDGE_EAS_PROJECT_ID:randomUUID(),FRIDGE_ANDROID_PACKAGE:'com.test.fridge',EXPO_PUBLIC_API_URL:'https://example.com'},true));
  let lost=true;
  const first=newManager((url,token)=>async(...args)=>{
    const result=await transport(url,token)(...args);
    if(args[1]==='/v1/auth/enroll' && lost){lost=false;throw Error('synthetic lost enrollment response');}
    return result;
  });
  await assert.rejects(()=>first.enroll(base,fixture.invite.enrollmentCode),/lost enrollment/);
  const before=JSON.parse(await secretStorage.get());
  assert.ok(before.code);
  const session=newManager();
  await session.restore();
  assert.equal(session.status().connected,true);
  assert.equal(JSON.parse(await secretStorage.get()).token,before.token);
  assert.equal(JSON.parse(await secretStorage.get()).code,undefined);
  const candidate={id:'reviewed',rawText:'합성 두부',guessedName:'두부',alternativeNames:[],confidence:0,
    category:'가공식품',quantity:1,unit:'개',status:'confirmed'};
  const purchase=buildRegistration([candidate],'영수증','2026-11-01',randomUUID);
  store.remember(purchase.items,purchase.history);
  const item={...purchase.items[0],storageType:'냉장'};
  store.edit(item,'2026-11-11','package_label',true);
  let lostWrite=true;
  const client=session.client().transport;
  await sync.sync(async(...args)=>{const result=await client(...args);if(args[0]==='PUT' && lostWrite){lostWrite=false;throw Error('lost write response');}return result;},base);
  assert.equal(sync.statuses()[0].localPending,true);
  await sync.sync(client,base);
  assert.deepEqual((await sync.statistics(client,base)).map(row=>[row.meanDays,row.count]),[[10,1]]);
  const responses=await Promise.all(Array.from({length:8},(_,i)=>client('PUT','/v1/me/personal-items/'+item.id,
    {data:{...sync.state().items[item.id].acknowledged,expiryDate:'2026-11-13'},expectedRevision:1},'parallel-'+i)));
  assert.equal(responses.filter(r=>r.status===200).length,1);
  assert.equal(responses.filter(r=>r.status===409).length,7);
  store.edit(item,'2026-11-15','package_label',true);
  await sync.sync(client,base);
  assert.equal(sync.state().items[item.id].error,'REVISION_CONFLICT');
  await sync.resolveWithLocal(item.id,client,base);await sync.sync(client,base);
  assert.equal((await sync.statistics(client,base))[0].meanDays,14);
  console.log('PASS: HTTPS/config gates; enrollment loss/recovery; real HTTP registration/edit/replay; 8 concurrent revisions');
} else {
  const session=newManager();await session.restore();
  assert.equal(session.status().connected,true);
  const client=session.client().transport;
  assert.deepEqual((await sync.statistics(client,base)).map(row=>[row.meanDays,row.count]),[[14,1]]);
  const record=Object.values(store.state().records)[0];
  store.edit(record.item,record.expiry,record.source,false);await sync.sync(client,base);
  assert.deepEqual(await sync.statistics(client,base),[]);
  let anotherSecret;
  const other=newManager(transport,{get:async()=>anotherSecret ?? null,set:async value=>{anotherSecret=value;},clear:async()=>{anotherSecret=undefined;}});
  await assert.rejects(()=>other.enroll(base,fixture.other.enrollmentCode),/계정/);
  assert.equal(other.client(),undefined);
  const rawToken=JSON.parse(await secretStorage.get()).token;
  await session.disconnect();
  assert.equal(await secretStorage.get(),null);
  assert.equal((await transport(base,rawToken)('GET','/v1/me')).status,401);
  assert.equal(Object.keys(store.state().records).length,1);
  console.log('PASS: server+client process restart; same owner/statistics; withdrawal; wrong-owner binding blocked; logout revoked, local data retained');
}
