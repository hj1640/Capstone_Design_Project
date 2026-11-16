/** Stage 1 proposal (D-039/D-040). Contracts only; not wired into the app. */
export type DateOnly = string; // YYYY-MM-DD; validate calendar dates at the boundary.
export type Storage = 'room' | 'refrigerated' | 'frozen';
export interface Conditions {
  storage: Storage;
  opened: boolean;
  productForm: string; // Controlled code, e.g. fresh/cooked/canned; vocabulary pending.
}
export interface Food {
  foodId: string;
  name: string;
  aliases: string[];
  revision: number;
}
export interface Product {
  productId: string;
  marketplace: string;
  externalProductId: string | null;
  originalTitle: string;
  searchText: string;
  foodId: string | null;
  mappingStatus: 'unreviewed' | 'reviewed';
  conditions: Conditions | null;
  provenance: string;
  revision: number;
}
export type DurationBasis = 'purchase_remaining' | 'after_opening';
export interface StorageRule {
  ruleId: string;
  foodId: string;
  productId: string | null;
  conditions: Conditions;
  basis: DurationBasis;
  days: number | null; // null = unknown; no arbitrary fallback.
  origin: 'reference' | 'community';
  source: string;
  status: 'draft' | 'published' | 'withdrawn';
  revision: number;
  policyVersion: string | null;
}
export interface SearchCandidate {
  productId: string;
  foodId: string | null;
  title: string;
  score: number; // Ranking score, NOT a probability. Cosine can be negative.
}
export interface SearchResult {
  candidates: SearchCandidate[];
  resolution: 'product' | 'food_only' | 'needs_review' | 'no_match';
  selectedProductId: string | null;
  selectedFoodId: string | null;
  catalogVersion: string;
  indexVersion: string;
  modelRevision: string;
}
export interface PersonalItem {
  itemId: string;
  foodId: string | null;
  productId: string | null;
  purchaseDate: DateOnly | null;
  openedDate: DateOnly | null;
  conditions: Conditions | null;
  suggestedExpiryDate: DateOnly | null;
  overrideExpiryDate: DateOnly | null;
  overrideSource: 'package_label' | 'user_estimate' | null;
  ruleSnapshot: Pick<StorageRule, 'ruleId' | 'revision' | 'days' | 'basis'> | null;
  revision: number;
}
export interface ExpiryEditRequest {
  expectedRevision: number;
  expiryDate: DateOnly | null; // null explicitly clears personal override.
  source: 'package_label' | 'user_estimate' | null;
}
export interface FeedbackSubmission {
  itemId: string;
  itemRevision: number;
  consentVersion: string;
  basis: DurationBasis;
  // Server loads the owned item and derives dates, conditions, food/product IDs.
  // Client does not supply actorId, aggregate weight, approval or contributor count.
}
export type FeedbackState = 'pending' | 'held' | 'accepted' | 'rejected' | 'superseded' | 'withdrawn';
export interface FeedbackReceipt {
  feedbackId: string;
  state: FeedbackState;
  reasonCode: string | null;
  policyVersion: string | null;
  createdAt: string; // UTC timestamp.
}
export interface AggregationPolicy {
  version: string;
  enabled: boolean;
  minimumDistinctContributors: number | null;
  method: 'arithmetic_mean' | 'weighted_mean' | null;
  outlierRule: string | null;
  outlierWeight: number | null;
}
