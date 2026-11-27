// Run after compiling the two pure TS files; argument is compiled output directory.
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(process.argv[2]);
const f = require(path.join(root,'firebase.js'));
const c = require(path.join(root,'capture.js'));
const auth={localId:'test',idToken:'test-token',refreshToken:'test-refresh',expiresAt:Date.now()+3600000};
const base={owner_uid:'test',device_id:'fridge_01',item_id:'item',item_name:'사과',mode:'T0',step:0,image_count:0,status:'waiting_angle',error:''};
const doc=(data)=>({name:'projects/test/databases/(default)/documents/capture_sessions/session',updateTime:'2026-11-27T00:00:00Z',fields:f.fields(data)});
(async()=>{
  assert.equal(c.ANGLES.flatMap((_,i)=>c.viewsForStep(i)).length,9);
  assert.equal(new Set(c.ANGLES.flatMap((_,i)=>c.viewsForStep(i))).size,9);
  assert.throws(()=>c.viewsForStep(8));
  assert.throws(()=>c.parseSession(doc({...base,image_count:1}),auth,'item'));
  assert.throws(()=>c.parseSession(doc(base),auth,'other'));
  const calls=[];
  global.fetch=async(url,opts)=>{calls.push({url,opts});return {ok:true,json:async()=>opts.method==='GET'?doc(base):{}};};
  const session=await c.createSession(auth,'session','item','사과','T0');
  assert.equal(session.step,0);
  assert.equal(JSON.parse(calls[0].opts.body).writes[0].currentDocument.exists,false);
  for(let i=0;i<8;i++){
    const s=c.parseSession(doc({...base,step:i,image_count:i===0?0:i+1}),auth,'item');
    await c.requestCapture(auth,s);
    const writes=JSON.parse(calls.at(-1).opts.body).writes;
    assert.equal(writes.length,2);
    assert.equal(writes[0].update.fields.views.stringValue,c.viewsForStep(i).join(','));
    assert.equal(writes[0].currentDocument.exists,false);
    assert.equal(writes[1].currentDocument.updateTime,s.updateTime);
  }
  await assert.rejects(c.requestCapture(auth,{...session,status:'pending'}));
  await assert.rejects(c.requestCapture(auth,{...session,step:8}));
  assert.ok(calls.every(x=>x.opts.headers.Authorization==='Bearer test-token'));
  console.log('PASS: 9 unique views / 8 commands, ownership, count, atomic writes, duplicate guards');
})().catch(e=>{console.error(e);process.exitCode=1;});
