import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {parseOnlineOrder} from '../src/services/ocr/onlineOrder.ts';
import {syntheticOnlineOrderLines} from '../src/data/onlineOrder.synthetic.ts';
import {foods,products,catalogVersion} from '../src/data/catalog-stage3.ts';
import {searchCatalog} from '../src/services/catalog/search.ts';
import {buildRegistration} from '../src/services/registration.ts';
import {createFeedbackStore} from '../src/services/feedback/store.ts';
import {computeStatus} from '../src/utils/status.ts';
const base=process.argv[2];
const checkpoints=[];
const mark=name=>checkpoints.push(name);
const parsed=parseOnlineOrder(syntheticOnlineOrderLines);
assert.equal(parsed.orderDate,'2026-11-01');
assert.equal(parsed.items.length,2);assert.equal(parsed.items[0].quantity,2);
assert.equal(parseOnlineOrder(['배송일: 2026-11-03','가상 두부']).orderDate,null);
assert.equal(parseOnlineOrder(['주문일: 2026-02-30']).orderDate,null);
assert.equal(parseOnlineOrder(['주문일: 2026-11-01','주문일: 2026-11-02']).orderDate,null);
assert.equal(parseOnlineOrder(['할인특가 당근 1kg']).items.length,1);
mark('online order date/quantity parsing; missing/conflicting dates remain unknown');
const catalog={foods,products,version:catalogVersion,synthetic:true};
const matched=searchCatalog(parsed.items[0].nameCandidate,catalog);
assert.equal(matched.selectedFoodId,'food-tofu');
assert.equal(searchCatalog(parsed.items[1].nameCandidate,catalog).resolution,'needs_review');
mark('two-layer matching; ambiguous truncated name needs review');
const candidate={id:'candidate',rawText:parsed.items[0].rawText,guessedName:'두부',alternativeNames:[],
  confidence:1,category:'가공식품',quantity:2,unit:'개',status:'confirmed'};
assert.throws(()=>buildRegistration([candidate],'온라인주문','',randomUUID));
assert.throws(()=>buildRegistration([{...candidate,status:'uncertain'}],'온라인주문',parsed.orderDate,randomUUID));
const purchase=buildRegistration([candidate],'온라인주문',parsed.orderDate,randomUUID);
assert.equal(purchase.items[0].purchaseDate,'2026-11-01');
assert.equal(purchase.items[0].expectedExpiryDate,null);
assert.equal(computeStatus(purchase.items[0].purchaseDate,null).level,'unknown');
mark('explicit confirmation and purchase date; no invented expiry');
const directory=new URL('../.stage0-stage8-flow/',import.meta.url);
fs.mkdirSync(directory,{recursive:true});
const file=new URL('personal.json',directory);fs.writeFileSync(file,'');
const storage={getItem:()=>fs.readFileSync(file,'utf8') || null,setItem:(_,v)=>fs.writeFileSync(file,v)};
const make=()=>createFeedbackStore(storage,randomUUID);
let store=make();store.remember(purchase.items,purchase.history);
store=make();assert.equal(store.overlay([]).length,1);assert.equal(store.purchaseHistory().length,1);
const item=store.overlay([])[0];store.edit(item,'2026-11-11','user_estimate');
store.edit(store.overlay([])[0],'2026-11-12','package_label');
assert.equal(store.state().records[item.id].baseExpiry,null);
store.edit(store.overlay([])[0],null,null);assert.equal(store.overlay([])[0].expectedExpiryDate,null);
store.edit(store.overlay([])[0],'2026-11-11','package_label');
store.submit(item.id,'purchase_remaining',true);
mark('persistent registration/history and repeated personal edits; clear restores unknown');
const transport=async(method,path,body,key)=>{
  const response=await fetch(base+path,{method,headers:{Authorization:'Bearer stage8-test-token','Content-Type':'application/json',
    ...(key ? {'Idempotency-Key':key} : {})},body:method==='GET' ? undefined : JSON.stringify(body ?? {})});
  return {status:response.status,body:await response.json()};
};
await store.sync(transport,base);
const receipt=store.state().jobs.find(j=>j.kind==='submit').receipt;
assert.equal(receipt.state,'held');
mark('consented submission over HTTP is held before mapping review');
// Only the temporary test server implements this synthetic review callback.
const reviewed=await fetch(base+'/__synthetic_review__',{method:'POST',headers:{Authorization:'Bearer stage8-test-token','Content-Type':'application/json'},
  body:JSON.stringify({feedbackId:receipt.feedbackId})});
assert.equal(reviewed.status,200);
const rules=(await transport('GET','/v1/foods/food-tofu/storage-rules?storage=refrigerated&opened=false&basis=purchase_remaining')).body.rules;
assert.equal(rules.length,1);assert.equal(rules[0].days,10);
assert.equal(make().overlay([])[0].expectedExpiryDate,'2026-11-11');
mark('synthetic operator review and test-only N gate publish rule without overwriting personal date');
store.withdraw(item.id);await store.sync(transport,base);
assert.equal((await transport('GET','/v1/foods/food-tofu/storage-rules')).body.rules.length,0);
assert.equal(make().overlay([])[0].expectedExpiryDate,'2026-11-11');
mark('withdrawal removes contribution and rule; personal date survives');
fs.writeFileSync(new URL('../benchmarks/stage8-flow-report.json',import.meta.url),JSON.stringify({
  timestamp:new Date().toISOString(),node:process.version,platform:process.platform,synthetic:true,passed:true,checkpoints,
  limitations:['Input is synthetic OCR text; actual image OCR and Android SQLite/UI not executed.',
    'Review callback exists only in this temporary test handler; production policy stays disabled.']
},null,2)+'\n');
console.log('PASS: online text → catalog → registration → personal edit → HTTP submission → synthetic review → rules → withdrawal');
