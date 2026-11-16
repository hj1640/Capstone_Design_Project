import fs from 'node:fs';
import assert from 'node:assert/strict';
// D-010/D-049: synthetic NEXT PURCHASE date evaluation, never consumption truth.
const streams=[
  {user:'synthetic-weekly',food:'synthetic-food',purchases:[['2026-11-01',1],['2026-11-08',1],['2026-11-15',1],['2026-11-22',1]]},
  {user:'synthetic-varying-quantity',food:'synthetic-food',purchases:[['2026-11-01',1],['2026-11-08',2],['2026-11-22',1],['2026-11-29',2],['2026-12-13',1]]},
];
const day=d=>Date.parse(`${d}T00:00:00Z`)/86400000;
const rows=[];
for (const stream of streams) {
  let count=0,mean=0;
  for(let i=1;i<stream.purchases.length-1;i++) {
    const observed=day(stream.purchases[i][0])-day(stream.purchases[i-1][0]);
    count++;mean+=(observed-mean)/count;
    const actual=day(stream.purchases[i+1][0])-day(stream.purchases[i][0]);
    rows.push({user:stream.user,food:stream.food,lastPurchaseDate:stream.purchases[i][0],quantity:stream.purchases[i][1],
      actualNextPurchaseDate:stream.purchases[i+1][0],actualIntervalDays:actual,
      pastIntervalsUsed:count,meanPredictionDays:mean,lastIntervalPredictionDays:observed,
      meanAbsoluteErrorDays:Math.abs(actual-mean),lastIntervalAbsoluteErrorDays:Math.abs(actual-observed)});
  }
}
const average=values=>values.reduce((a,b)=>a+b,0)/values.length;
assert.equal(rows.filter(r=>r.user==='synthetic-weekly').every(r=>r.meanAbsoluteErrorDays===0),true);
const report={timestamp:new Date().toISOString(),synthetic:true,target:'next_purchase_date',
  update:'incremental arithmetic mean experiment only; no production averaging method selected',
  split:'walk forward: each prediction uses only earlier observed purchase intervals',
  samples:rows.length,meanMAEDays:average(rows.map(r=>r.meanAbsoluteErrorDays)),
  lastIntervalMAEDays:average(rows.map(r=>r.lastIntervalAbsoluteErrorDays)),
  byPriorQuantity:[1,2].map(quantity=>({quantity,count:rows.filter(r=>r.quantity===quantity).length,
    meanNextIntervalDays:average(rows.filter(r=>r.quantity===quantity).map(r=>r.actualIntervalDays))})),
  rows,caveats:['Synthetic encoded patterns, not measured user behavior.',
    'Quantity association is descriptive; not causal and not actual consumption.',
    'Errors use unrounded expected intervals; UI rounding/minimum history/lead days remain open.']};
fs.writeFileSync(new URL('../benchmarks/stage8-purchase-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(`Synthetic next-purchase MAE: mean=${report.meanMAEDays.toFixed(3)} days; last interval=${report.lastIntervalMAEDays.toFixed(3)} days; n=${rows.length}`);
