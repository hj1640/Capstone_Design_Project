import fs from 'node:fs';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { foods, products, catalogVersion } from '../src/data/catalog-stage3.ts';
import { rankJaccard, searchCatalog, validateCatalog } from '../src/services/catalog/search.ts';
const external = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : null;
const catalog = external?.catalog ?? { foods, products, version: catalogVersion, synthetic: true };
validateCatalog(catalog);
assert.ok(catalog.products.length, 'At least one indexed product is required');
const groups = [
  ['dev', 'product-carrot-3', 'food-carrot', ['가상 바른농장', '바른농장 제철 당근', '당근 제철 바른농장']],
  ['dev', 'product-tofu-1', 'food-tofu', ['가상 부침용 두부', '부침용 두부 300그램', '두부 부침용']],
  ['dev', 'product-milk-1', 'food-milk', ['가상 흰우유', '흰 우유 일 리터', '우유 1리터']],
  ['test', 'product-carrot-1', 'food-carrot', ['간편한 국내산 제주 햇당근', '제주 햇당근 1kg', '햇 당근 제주산']],
  ['test', 'product-carrot-2', 'food-carrot', ['제주 아삭 당근', '아삭 당근 500g', '간편한 국내산 제주 아삭']],
  ['test', 'product-potato-1', 'food-potato', ['제주 햇감자', '햇 감자 1kg', '간편한 국내산 제주 햇감']],
  ['test', 'product-cheese-1', 'food-cheese', ['가상 슬라이스 치즈', '치즈 슬라이스 열 장', '슬라이스치즈 10매']],
];
const ownership = new Map();
const cases = groups.flatMap(([split, productId, foodId, queries]) => {
  assert.ok(products.some(p => p.productId === productId && p.foodId === foodId));
  assert.ok(!ownership.has(productId) || ownership.get(productId) === split);
  ownership.set(productId, split);
  return queries.map((query, i) => ({ id: `${productId}-${i}`, split, kind: 'known', query,
    expectedProductIds: [productId], expectedFoodIds: [foodId] }));
});
cases.push(
  { id: 'ambiguous-prefix', split: 'test', kind: 'ambiguous', query: '간편한 국내산 제주',
    expectedProductIds: ['product-carrot-1','product-carrot-2','product-potato-1'], expectedFoodIds: ['food-carrot','food-potato'] },
  ...['무관한외부상품', '무선 충전기', '싱싱한 생연어'].map((query,i) => ({ id: `unknown-${i}`, split: 'test',
    kind: 'unknown', query, expectedProductIds: [], expectedFoodIds: [] })),
);
const evaluationCases = external?.cases ?? cases;
const splitByProduct = new Map();
const caseIds = new Set();
for (const c of evaluationCases) {
  assert.ok(typeof c.id === 'string' && !caseIds.has(c.id)); caseIds.add(c.id);
  assert.ok(typeof c.query === 'string' && c.query.trim());
  assert.ok(['dev','test'].includes(c.split) && ['known','ambiguous','unknown'].includes(c.kind));
  assert.ok(Array.isArray(c.expectedProductIds) && Array.isArray(c.expectedFoodIds));
  if (c.kind === 'unknown') assert.ok(!c.expectedProductIds.length && !c.expectedFoodIds.length);
  if (c.kind === 'known') assert.ok(c.expectedProductIds.length && c.expectedFoodIds.length);
  for (const id of c.expectedFoodIds) assert.ok(catalog.foods.some(f => f.foodId === id));
  for (const id of c.expectedProductIds) {
    assert.ok(catalog.products.some(p => p.productId === id && c.expectedFoodIds.includes(p.foodId)));
    if (c.kind === 'known') {
      assert.ok(!splitByProduct.has(id) || splitByProduct.get(id) === c.split, 'Product query group split leakage');
      splitByProduct.set(id,c.split);
    }
  }
  const runs = [];
  rankJaccard(c.query, catalog.products); // warmup
  for (let i=0; i<3; i++) { const start=performance.now(); rankJaccard(c.query,catalog.products); runs.push(performance.now()-start); }
  c.jaccard = rankJaccard(c.query,catalog.products);
  c.jaccardWarmMs = runs;
  c.stage3 = searchCatalog(c.query,catalog);
}
fs.writeFileSync(new URL('../benchmarks/stage4-input.json',import.meta.url), JSON.stringify({
  description: `${catalog.synthetic ? 'Synthetic smoke evaluation' : 'User-supplied evaluation'}; product-disjoint query groups. All retrieval candidates remain indexed.`,
  catalog, node: process.version, platform: process.platform, warmup:1, repeats:3, cases: evaluationCases,
},null,2)+'\n');
console.log(`Exported ${evaluationCases.length} cases; synthetic=${catalog.synthetic}; product-disjoint query groups`);
