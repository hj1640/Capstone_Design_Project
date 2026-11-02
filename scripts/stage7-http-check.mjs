import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
const [base,feedbackId]=process.argv.slice(2);
const route='/v1/foods/synthetic-food/storage-rules';
const request=async(path,method='GET',authorized=true)=>{
  const r=await fetch(base+path,{method,headers:authorized ? {Authorization:'Bearer fixture-token-0',
    ...(method==='DELETE' ? {'Idempotency-Key':randomUUID(),'Content-Type':'application/json'} : {})} : {},
    body:method==='DELETE' ? '{}' : undefined});
  return {status:r.status,body:await r.json()};
};
assert.equal((await request(route,'GET',false)).status,401);
const before=await request(route+'?storage=refrigerated&opened=false&basis=purchase_remaining&overrideSource=package_label');
assert.equal(before.body.rules.length,1);
assert.equal(before.body.rules[0].days,10);
assert.ok(!('contributors' in before.body.rules[0]));
assert.equal((await request(route+'?storage=frozen')).body.rules.length,0);
assert.equal((await request(route+'?opened=invalid')).status,422);
assert.equal((await request(`/v1/me/expiry-feedback/${feedbackId}`,'DELETE')).status,200);
assert.equal((await request(route)).body.rules.length,0);
fs.writeFileSync(new URL('../benchmarks/stage7-http-checks.json',import.meta.url),JSON.stringify({
  timestamp:new Date().toISOString(),node:process.version,platform:process.platform,synthetic:true,
  passed:true,checks:['authenticated lookup','qualified publication','condition filter','invalid filter',
    'no private aggregate fields','withdrawal removes public rule'],
  note:'Temporary loopback sandbox only. The real policy configuration remains disabled.'
},null,2)+'\n');
console.log('PASS: trust-engine publication/lookup/withdrawal over actual loopback HTTP');
