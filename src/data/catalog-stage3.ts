import type { Food, Product } from '../contracts/catalog-v1';

// D-039/D-044: synthetic fixtures only. Replace with reviewed, licensed source data.
export const catalogVersion = 'synthetic-stage3-v1';
export const foods: Food[] = [
  { foodId: 'food-carrot', name: '당근', aliases: [], revision: 1 },
  { foodId: 'food-potato', name: '감자', aliases: [], revision: 1 },
  { foodId: 'food-tofu', name: '두부', aliases: [], revision: 1 },
  { foodId: 'food-milk', name: '우유', aliases: ['흰우유'], revision: 1 },
  { foodId: 'food-cheese', name: '치즈', aliases: [], revision: 1 },
];
const common = { marketplace: 'synthetic', externalProductId: null, mappingStatus: 'reviewed' as const,
  conditions: null, provenance: 'synthetic fixture, not an actual marketplace listing', revision: 1 };
export const products: Product[] = [
  { ...common, productId: 'product-carrot-3', originalTitle: '가상 바른농장 제철 당근 1kg', searchText: '가상 바른농장 제철 당근 1kg', foodId: 'food-carrot' },
  { ...common, productId: 'product-carrot-1', originalTitle: '간편한 국내산 제주 햇당근 1kg', searchText: '간편한 국내산 제주 햇당근 1kg', foodId: 'food-carrot' },
  { ...common, productId: 'product-carrot-2', originalTitle: '간편한 국내산 제주 아삭 당근 500g', searchText: '간편한 국내산 제주 아삭 당근 500g', foodId: 'food-carrot' },
  { ...common, productId: 'product-potato-1', originalTitle: '간편한 국내산 제주 햇감자 1kg', searchText: '간편한 국내산 제주 햇감자 1kg', foodId: 'food-potato' },
  { ...common, productId: 'product-tofu-1', originalTitle: '가상 부침용 두부 300g', searchText: '가상 부침용 두부 300g', foodId: 'food-tofu' },
  { ...common, productId: 'product-milk-1', originalTitle: '가상 흰우유 1L', searchText: '가상 흰우유 1L', foodId: 'food-milk' },
  { ...common, productId: 'product-cheese-1', originalTitle: '가상 슬라이스 치즈 10매', searchText: '가상 슬라이스 치즈 10매', foodId: 'food-cheese' },
];
