import assert from 'node:assert/strict';
import fs from 'node:fs';
import { foods, products, catalogVersion } from '../src/data/catalog-stage3.ts';
import { searchCatalog, validateCatalog, createCatalogService } from '../src/services/catalog/search.ts';
const catalog = { foods, products, version: catalogVersion, synthetic: true };
const rows = [];
async function check(name, fn) { await fn(); rows.push({ name, passed: true }); }
const search = text => searchCatalog(text, catalog);
await check('catalog integrity', () => validateCatalog(catalog));
await check('exact product retains full title and stable IDs', () => {
  const r = search(products[0].originalTitle);
  assert.equal(r.resolution, 'product'); assert.equal(r.selectedProductId, products[0].productId);
  assert.equal(r.selectedFoodId, 'food-carrot'); assert.equal(r.candidates[0].title, products[0].originalTitle);
});
await check('truncated prefix spans carrot and potato', () => {
  const r = search('간편한 국내산 제주');
  assert.equal(r.resolution, 'needs_review'); assert.equal(r.selectedFoodId, null); assert.equal(r.selectedProductId, null);
});
await check('multiple products same food only', () => {
  const r = search('당근'); assert.equal(r.resolution, 'food_only'); assert.equal(r.selectedFoodId, 'food-carrot');
  assert.equal(r.selectedProductId, null); assert.equal(r.candidates.length, 3);
});
await check('unique truncated product still only food suggestion', () => {
  const r = search('제주 아삭'); assert.equal(r.resolution, 'food_only'); assert.equal(r.selectedProductId, null);
});
await check('food noun absent but unique catalog prefix resolves food', () => {
  const r = search('가상 바른농장'); assert.equal(r.resolution, 'food_only');
  assert.equal(r.selectedFoodId, 'food-carrot'); assert.equal(r.selectedProductId, null);
});
await check('milk and cheese remain distinct', () => {
  assert.equal(search('흰우유').selectedFoodId, 'food-milk'); assert.equal(search('치즈').selectedFoodId, 'food-cheese');
});
await check('standard food alias fallback without product', () => {
  const r = searchCatalog('흰우유', { ...catalog, products: [] });
  assert.equal(r.selectedFoodId, 'food-milk'); assert.equal(r.selectedProductId, null);
});
await check('unknown and empty input', () => {
  assert.equal(search('무관한외부상품').resolution, 'no_match'); assert.equal(search('').resolution, 'no_match');
});
await check('fuzzy overlap never auto selects product', () => {
  const r = search('제주산 당근배송'); assert.equal(r.resolution, 'needs_review'); assert.equal(r.selectedProductId, null);
});
await check('unreviewed product cannot authorize mapping', () => {
  const r = searchCatalog(products[0].originalTitle, { ...catalog, products: [{ ...products[0], mappingStatus: 'unreviewed' }] });
  assert.equal(r.resolution, 'needs_review'); assert.equal(r.candidates[0].foodId, null);
});
await check('ambiguity uses all matches before candidate limit', () => {
  const r = searchCatalog('간편한 국내산 제주', catalog, 1);
  assert.equal(r.candidates.length, 1); assert.equal(r.resolution, 'needs_review');
});
await check('duplicate product IDs rejected', () => assert.throws(() => validateCatalog({ ...catalog, products: [...products, products[0]] })));
await check('duplicate food IDs rejected', () => assert.throws(() => validateCatalog({ ...catalog, foods: [...foods, foods[0]] })));
await check('broken food reference rejected', () => assert.throws(() => validateCatalog({ ...catalog, products: [{ ...products[0], foodId: 'missing' }] })));
await check('duplicate marketplace external IDs rejected', () => {
  const p = { ...products[0], externalProductId: '123' };
  assert.throws(() => validateCatalog({ ...catalog, products: [p, { ...p, productId: 'different' }] }));
});
await check('invalid schema rejected', () => assert.throws(() => validateCatalog({ ...catalog, foods: [{ ...foods[0], aliases: null }] })));
await check('invalid candidate limits rejected', () => {
  assert.throws(() => searchCatalog('당근', catalog, 0)); assert.throws(() => searchCatalog('당근', catalog, 1.5));
});
await check('async service filters marketplaces', async () => {
  const service = createCatalogService(catalog);
  assert.equal((await service.searchProducts(products[0].originalTitle, 'missing-market')).selectedProductId, null);
});
await check('service snapshot and food copy resist external mutation', async () => {
  const copy = structuredClone(catalog); const service = createCatalogService(copy);
  copy.products[0].originalTitle = 'changed';
  const food = service.food('food-carrot'); food.name = 'changed';
  assert.equal((await service.searchProducts(products[0].originalTitle)).candidates[0].title, products[0].originalTitle);
  assert.equal(service.food('food-carrot').name, '당근');
});
const report = { stage: 3, dataset: 'synthetic fixtures only', timestamp: new Date().toISOString(), node: process.version,
  platform: process.platform, architecture: process.arch, catalogVersion, passed: rows.length, rows };
fs.writeFileSync(new URL('../benchmarks/stage3-checks.json', import.meta.url), JSON.stringify(report, null, 2)+'\n');
console.log(`PASS: ${rows.length} catalog/search checks (synthetic data)`);
