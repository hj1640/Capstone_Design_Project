import type { SearchResult } from '../../contracts/catalog-v1';
import { validateCatalog } from './search.ts';
import type { Catalog } from './search';

export interface EmbeddingIndex {
  catalogVersion: string;
  modelRevision: string;
  modelSha256: string;
  dimension: number;
  productIds: string[];
  vectors: number[][];
}

function unit(vector: number[], dimension: number): number[] {
  if (vector.length !== dimension || !vector.every(Number.isFinite)) throw new Error('Invalid embedding');
  const norm = Math.sqrt(vector.reduce((s,v)=>s+v*v,0));
  if (!Number.isFinite(norm) || norm === 0) throw new Error('Zero/invalid embedding');
  return vector.map(v=>v/norm);
}

export function createSemanticSearch(catalog: Catalog, index: EmbeddingIndex,
  embed: (query: string) => Promise<number[]>, expectedModelHash: string) {
  validateCatalog(catalog);
  if (index.catalogVersion !== catalog.version || index.modelSha256 !== expectedModelHash || index.dimension !== 384)
    throw new Error('Model/catalog index mismatch');
  if (index.productIds.length !== catalog.products.length || index.vectors.length !== index.productIds.length ||
      new Set(index.productIds).size !== index.productIds.length) throw new Error('Invalid index size');
  const products = index.productIds.map(id => {
    const p = catalog.products.find(row=>row.productId === id);
    if (!p) throw new Error('Unknown indexed product');
    return { ...p };
  });
  const vectors = index.vectors.map(v=>unit(v,384));
  return async (query: string, limit = 3): Promise<SearchResult> => {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('Invalid candidate limit');
    const result: SearchResult = { candidates: [], resolution: 'no_match', selectedProductId: null,
      selectedFoodId: null, catalogVersion: catalog.version,
      indexVersion: `semantic-stage5-${index.modelSha256}`, modelRevision: index.modelRevision };
    if (!query.trim()) return result;
    const vector = unit(await embed(query),384);
    result.candidates = products.map((p,i)=>({ productId:p.productId,
      foodId:p.mappingStatus === 'reviewed' ? p.foodId : null, title:p.originalTitle,
      score:vectors[i].reduce((s,v,d)=>s+v*vector[d],0) }))
      .sort((a,b)=>b.score-a.score || a.productId.localeCompare(b.productId)).slice(0,limit);
    // No threshold has been approved. Even a high cosine needs explicit confirmation.
    result.resolution = result.candidates.length ? 'needs_review' : 'no_match';
    return result;
  };
}
