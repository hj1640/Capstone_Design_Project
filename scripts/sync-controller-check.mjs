import assert from 'node:assert/strict';
import {createSyncController} from '../src/services/feedback/controller.ts';
const turn=()=>new Promise(resolve=>setImmediate(resolve));
let calls=0, pending=true, release, notifications=0, failed=false;
const timers=[];
const controller=createSyncController({
  async run(){calls++;if(calls===1) await new Promise(resolve=>{release=resolve;});if(failed) throw Error('offline');return calls;},
  pending:()=>pending,hasCredential:()=>true,changed:()=>notifications++,
  later:(callback,ms)=>{const timer={callback,ms,cancelled:false};timers.push(timer);return ()=>{timer.cancelled=true;};},
});
controller.setActive(true);
const first=controller.sync();
assert.equal(controller.sync(),first);
release();await first;
assert.equal(calls,2); // Edit/new request while the prior fetch was awaiting is drained.
assert.equal(timers.at(-1).ms,5000);
failed=true;timers.at(-1).callback();await turn();
assert.equal(controller.error(),'Error: offline');assert.equal(timers.at(-1).ms,10000);
controller.setActive(false);assert.equal(timers.at(-1).cancelled,true);
const stopped=calls;controller.schedule();await turn();assert.equal(calls,stopped);
failed=false;pending=false;controller.setActive(true);await turn();
assert.equal(calls,stopped+1);assert.equal(controller.error(),undefined);
assert.ok(notifications>=3);
console.log('PASS: coalesced requests, edit during IO, persisted pending retry, backoff, background pause and foreground resume');
