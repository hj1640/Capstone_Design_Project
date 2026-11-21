import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createSessionManager} from '../src/services/feedback/session.ts';
let saved=null,readsFail=false,writesFail=false,requests=0;
const secrets={get:async()=>{if(readsFail) throw Error('storage unavailable');return saved;},
  set:async value=>{if(writesFail) throw Error('storage unavailable');saved=value;},clear:async()=>{saved=null;}};
const manager=createSessionManager(secrets,async()=>randomBytes(32).toString('hex'),()=>async()=>{
  requests++;return {status:200,body:{ownerId:'synthetic-owner',expiresAt:2000000000}};
},async()=>{});
await assert.rejects(()=>manager.enroll('https://synthetic.test','typo'),/형식/);
assert.equal(manager.status().saved,false);assert.equal(requests,0);
writesFail=true;
await assert.rejects(()=>manager.enroll('https://synthetic.test',randomBytes(32).toString('hex')),/storage/);
assert.equal(manager.status().saved,false);assert.equal(requests,0);
writesFail=false;
await manager.enroll('https://synthetic.test',randomBytes(32).toString('hex'));
assert.equal(manager.status().connected,true);
readsFail=true;await assert.rejects(()=>manager.restore(),/storage/);
assert.equal(manager.status().connected,false);assert.equal(manager.client(),undefined);
console.log('PASS: invalid code and failed secure save never connect or send; secure read failure removes verified status');
