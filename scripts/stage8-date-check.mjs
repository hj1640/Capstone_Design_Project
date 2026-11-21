import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const url=new URL('../src/utils/date.ts',import.meta.url).href;
for(const [zone,expected] of [['Asia/Seoul','2026-11-02'],['America/Los_Angeles','2026-11-01']]) {
  const code=`import {todayIso,addDays,formatDateKo} from ${JSON.stringify(url)};
    console.log(JSON.stringify({today:todayIso(new Date('2026-11-01T15:30:00Z')),
      next:addDays('2026-03-08',1),label:formatDateKo('2026-11-02')}));`;
  const result=spawnSync(process.execPath,['--input-type=module','-e',code],{env:{...process.env,TZ:zone},encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const actual=JSON.parse(result.stdout);
  assert.equal(actual.today,expected);assert.equal(actual.next,'2026-03-09');assert.equal(actual.label,'11월 2일');
}
console.log('PASS: local calendar day and UTC date arithmetic across timezone/DST boundaries');
