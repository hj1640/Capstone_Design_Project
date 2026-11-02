import type { Food, Product, SearchCandidate, SearchResult } from '../../contracts/catalog-v1';

export interface Catalog { foods: Food[]; products: Product[]; version: string; synthetic: boolean }
export const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
function grams(text: string): Set<string> {
  if (text.length < 2) return new Set(text ? [text] : []);
  return new Set(Array.from({ length: text.length - 1 }, (_, i) => text.slice(i, i + 2)));
}
function similarity(a: string, b: string): number {
  const x = grams(a), y = grams(b);
  if (!x.size || !y.size) return 0;
  let shared = 0;
  for (const gram of x) if (y.has(gram)) shared++;
  return shared / (x.size + y.size - shared);
}

// Pure Jaccard ranking for stage-4 comparison; no exact/containment promotion.
export function rankJaccard(query: string, products: Product[]): SearchCandidate[] {
  const text = normalize(query);
  return products.map(product => ({ productId: product.productId,
    foodId: product.mappingStatus === 'reviewed' ? product.foodId : null,
    title: product.originalTitle, score: similarity(text, normalize(product.searchText || product.originalTitle)) }))
    .sort((a, b) => b.score - a.score || a.productId.localeCompare(b.productId));
}

export function validateCatalog(catalog: Catalog): void {
  if (!catalog || !Array.isArray(catalog.foods) || !Array.isArray(catalog.products) ||
      typeof catalog.version !== 'string' || !catalog.version || typeof catalog.synthetic !== 'boolean')
    throw new Error('Invalid catalog metadata');
  const foodIds = new Set<string>();
  for (const food of catalog.foods) {
    if (!food || typeof food.foodId !== 'string' || typeof food.name !== 'string' ||
        !Array.isArray(food.aliases) || food.aliases.some(alias => typeof alias !== 'string') ||
        !Number.isInteger(food.revision) || food.revision < 1) throw new Error('Invalid food schema');
    if (!food.foodId || !normalize(food.name) || foodIds.has(food.foodId)) throw new Error('Invalid/duplicate food');
    foodIds.add(food.foodId);
  }
  const productIds = new Set<string>();
  const externalIds = new Set<string>();
  for (const product of catalog.products) {
    if (!product || typeof product.productId !== 'string' || typeof product.originalTitle !== 'string' ||
        typeof product.searchText !== 'string' || typeof product.marketplace !== 'string' || !product.marketplace ||
        typeof product.provenance !== 'string' || !product.provenance ||
        !['reviewed', 'unreviewed'].includes(product.mappingStatus) ||
        !(product.externalProductId === null || typeof product.externalProductId === 'string') ||
        !Number.isInteger(product.revision) || product.revision < 1) throw new Error('Invalid product schema');
    if (!product.productId || !normalize(product.originalTitle) || productIds.has(product.productId)) throw new Error('Invalid/duplicate product');
    if (product.foodId !== null && !foodIds.has(product.foodId)) throw new Error('Broken food reference');
    if (product.mappingStatus === 'reviewed' && product.foodId === null) throw new Error('Reviewed product without food');
    if (product.externalProductId !== null) {
      const key = `${product.marketplace}\0${product.externalProductId}`;
      if (externalIds.has(key)) throw new Error('Duplicate marketplace product ID');
      externalIds.add(key);
    }
    productIds.add(product.productId);
  }
}

// Lexical stage-3 baseline. Stage 4 will compare MiniLM cosine using the same catalog.
export function searchCatalog(query: string, catalog: Catalog, limit = 3): SearchResult {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Candidate limit must be a positive integer');
  const text = normalize(query);
  const empty = (resolution: SearchResult['resolution']): SearchResult => ({ candidates: [], resolution,
    selectedProductId: null, selectedFoodId: null, catalogVersion: catalog.version,
    indexVersion: 'lexical-stage3-v1', modelRevision: 'none' });
  if (!text) return empty('no_match');
  const ranked = catalog.products.map(product => {
    const title = normalize(product.searchText || product.originalTitle);
    const exact = text === title;
    const contained = text.length >= 2 && title.includes(text);
    return { product, exact, contained, score: similarity(text, title) };
  }).sort((a, b) => Number(b.exact) - Number(a.exact) || Number(b.contained) - Number(a.contained)
    || b.score - a.score || a.product.productId.localeCompare(b.product.productId));
  const direct = ranked.filter(row => row.exact || row.contained);
  const toCandidate = (row: typeof ranked[number]): SearchCandidate => ({ productId: row.product.productId,
    foodId: row.product.mappingStatus === 'reviewed' ? row.product.foodId : null,
    title: row.product.originalTitle, score: row.score });
  if (direct.length) {
    const candidates = direct.slice(0, limit).map(toCandidate);
    const foodIds = new Set(direct.map(row => row.product.mappingStatus === 'reviewed' ? row.product.foodId : null));
    const oneFood = foodIds.size === 1 ? [...foodIds][0] : null;
    const uniqueExact = direct.length === 1 && direct[0].exact && oneFood !== null;
    return { ...empty(uniqueExact ? 'product' : oneFood ? 'food_only' : 'needs_review'), candidates,
      selectedProductId: uniqueExact ? direct[0].product.productId : null, selectedFoodId: oneFood };
  }
  const directFood = catalog.foods.filter(food => [food.name, ...food.aliases].some(name => normalize(name) === text));
  if (directFood.length === 1) return { ...empty('food_only'), selectedFoodId: directFood[0].foodId };
  return { ...empty(ranked.some(row => row.score > 0) ? 'needs_review' : 'no_match'),
    candidates: ranked.filter(row => row.score > 0).slice(0, limit).map(toCandidate) };
}

export function createCatalogService(catalog: Catalog) {
  validateCatalog(catalog);
  // Snapshot prevents callers changing the catalog after validation.
  const snapshot: Catalog = JSON.parse(JSON.stringify(catalog));
  return {
    async searchProducts(query: string, marketplace?: string, limit = 3): Promise<SearchResult> {
      return searchCatalog(query, marketplace ? { ...snapshot,
        products: snapshot.products.filter(p => p.marketplace === marketplace) } : snapshot, limit);
    },
    food(foodId: string): Food | undefined {
      const food = snapshot.foods.find(f => f.foodId === foodId);
      return food ? { ...food, aliases: [...food.aliases] } : undefined;
    },
  };
}
