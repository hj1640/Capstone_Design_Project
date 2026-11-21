import { foodDatabase } from '@/data/foodDatabase';
import { FoodDbEntry } from '@/types/food';
import { embed } from './embedder';
import { userFoods } from '../userFoods';
import { toFoodDbEntry } from '../userFoodStore';

// ko-sroberta 임베딩 + 코사인 유사도로 OCR 상품명을 식품 DB 표준명과 매칭한다.
// DB는 식품마다 이름 1개(standardName)만 쓴다.
//
// 최종 점수 = 0.7 × 코사인 유사도 + 0.3 × 글자 겹침 비율
// 임베딩은 뜻은 잘 잡지만 OCR 오타("브로커리", "양 파")에 약해서, DB 이름의 2글자 조각이
// 입력에 얼마나 들어있는지를 보조 점수로 섞는다. (2026-11-21 예시 38개: 1위 정답 28→32개,
// 점수≥0.50·차이≥0.15 자동확정 17→26개, 오답 0개)

export interface FoodMatch {
  entry: FoodDbEntry;
  score: number; // 0.7 × 코사인 유사도 + 0.3 × 글자 겹침 비율
}

const SEMANTIC_WEIGHT = 0.7;
const CHAR_WEIGHT = 0.3;

// 한글/영문만 남기고 2글자 조각으로 나눈다 ("양 파," → {"양파"})
function bigrams(text: string): Set<string> {
  const clean = text.toLowerCase().replace(/[^가-힣a-z]/g, '');
  const set = new Set<string>();
  for (let i = 0; i < clean.length - 1; i++) set.add(clean.slice(i, i + 2));
  if (set.size === 0 && clean) set.add(clean);
  return set;
}

// DB 이름의 2글자 조각 중 입력에 들어있는 비율 (0~1)
function charCoverage(input: Set<string>, name: Set<string>): number {
  if (name.size === 0) return 0;
  let hit = 0;
  for (const gram of name) if (input.has(gram)) hit += 1;
  return hit / name.size;
}

interface DbVector {
  entry: FoodDbEntry;
  vector: number[];
  grams: Set<string>;
}

// 매칭 대상 = 기본 식품 DB + 사용자가 추가한 "내 식품 DB"
function allEntries(): FoodDbEntry[] {
  const builtIn = new Set(foodDatabase.map((f) => f.standardName));
  return [...foodDatabase, ...userFoods.list().filter((f) => !builtIn.has(f.name)).map(toFoodDbEntry)];
}

// 이름별 임베딩 캐시: 한 번 계산한 이름은 앱이 켜져 있는 동안 다시 계산하지 않는다.
// (영수증 한 줄마다 DB 전체를 다시 임베딩하지 않음. 새로 추가된 식품만 그때 한 번 계산)
const vectorCache = new Map<string, number[]>();

async function getDbVectors(): Promise<DbVector[]> {
  const out: DbVector[] = [];
  for (const entry of allEntries()) {
    let vector = vectorCache.get(entry.standardName);
    if (!vector) {
      vector = await embed(entry.standardName);
      vectorCache.set(entry.standardName, vector);
    }
    out.push({ entry, vector, grams: bigrams(entry.standardName) });
  }
  return out;
}

// 영수증 화면에 들어올 때 미리 호출해두면 첫 인식이 빨라진다.
export async function warmUpFoodMatcher(): Promise<void> {
  await getDbVectors();
}

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum; // 두 벡터 모두 길이 1로 정규화되어 있어서 내적 = 코사인 유사도
}

export async function matchFoodName(rawText: string, topK = 3): Promise<FoodMatch[]> {
  const [dbVectors, inputVec] = [await getDbVectors(), await embed(rawText)];
  const inputGrams = bigrams(rawText);
  return dbVectors
    .map(({ entry, vector, grams }) => ({
      entry,
      score: SEMANTIC_WEIGHT * dot(inputVec, vector) + CHAR_WEIGHT * charCoverage(inputGrams, grams),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
