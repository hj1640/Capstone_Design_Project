import type { Food, Product, StorageRule, SearchResult, PersonalItem, AggregationPolicy, FeedbackSubmission } from './catalog-v1';

// Synthetic fixtures ONLY. No real product catalog or validated storage duration.
export const food = { foodId: 'synthetic-carrot', name: '당근', aliases: [], revision: 1 } satisfies Food;
export const product = {
  productId: 'synthetic-product', marketplace: 'synthetic', externalProductId: null,
  originalTitle: '가상 예제 국내산 신선 당근 1kg', searchText: '가상 예제 국내산 신선 당근',
  foodId: food.foodId, mappingStatus: 'reviewed',
  conditions: { storage: 'refrigerated', opened: false, productForm: 'fresh' },
  provenance: 'synthetic fixture; not a Coupang listing', revision: 1,
} satisfies Product;
export const rule = {
  ruleId: 'synthetic-rule', foodId: food.foodId, productId: null,
  conditions: product.conditions, basis: 'purchase_remaining', days: null,
  origin: 'reference', source: 'unknown duration fixture', status: 'draft', revision: 1, policyVersion: null,
} satisfies StorageRule;
export const result = {
  candidates: [], resolution: 'needs_review', selectedProductId: null, selectedFoodId: null,
  catalogVersion: 'synthetic-v1', indexVersion: 'not-built', modelRevision: 'not-selected',
} satisfies SearchResult;
export const item = {
  itemId: 'synthetic-item', foodId: food.foodId, productId: product.productId,
  purchaseDate: '2026-11-01', openedDate: null, conditions: product.conditions,
  suggestedExpiryDate: null, overrideExpiryDate: '2026-11-05', overrideSource: 'user_estimate',
  ruleSnapshot: null, revision: 2,
} satisfies PersonalItem;
export const submission = {
  itemId: item.itemId, itemRevision: item.revision, consentVersion: 'synthetic-consent', basis: 'purchase_remaining',
} satisfies FeedbackSubmission;
export const disabledPolicy = {
  version: 'unapproved', enabled: false, minimumDistinctContributors: null,
  method: null, outlierRule: null, outlierWeight: null,
} satisfies AggregationPolicy;
