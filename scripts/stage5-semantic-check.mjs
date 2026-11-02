import fs from 'node:fs';
import assert from 'node:assert/strict';
import { foods, products, catalogVersion } from '../src/data/catalog-stage3.ts';
import { createSemanticSearch } from '../src/services/catalog/semantic.ts';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const index=read('../src/data/catalog-embeddings-stage5.json');
const golden=read('../benchmarks/stage5-query-vectors.json');
const report=read('../benchmarks/stage5-report.json');
const catalog={foods,products,version:catalogVersion,synthetic:true};
const expected=report.results.find(r=>r.variant==='local_int8').rows;
const embed=async text=>golden.cases.find(r=>r.query===text).vector;
const search=createSemanticSearch(catalog,index,embed,golden.modelSha256);
for (const row of golden.cases) {
  const result=await search(row.query);
  const python=expected.find(r=>r.id===row.id);
  assert.deepEqual(result.candidates.map(c=>c.productId),python.ranked.slice(0,3).map(c=>c.productId));
  assert.equal(result.resolution,'needs_review'); assert.equal(result.selectedFoodId,null);
}
assert.equal((await search('')).resolution,'no_match');
assert.throws(()=>createSemanticSearch(catalog,index,embed,'wrong-model-hash'));
assert.throws(()=>createSemanticSearch({...catalog,version:'changed'},index,embed,golden.modelSha256));
assert.throws(()=>createSemanticSearch(catalog,{...index,productIds:['missing']},embed,golden.modelSha256));
const invalid=createSemanticSearch(catalog,index,async()=>new Array(384).fill(0),golden.modelSha256);
await assert.rejects(()=>invalid('query'));
const invalidDim=createSemanticSearch(catalog,index,async()=>[1,2],golden.modelSha256);
await assert.rejects(()=>invalidDim('query'));
console.log(`PASS: ${golden.cases.length} Python/TS semantic rankings and version/vector guards`);
