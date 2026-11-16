import { foodDatabase } from '@/data/foodDatabase';
import { FoodDbEntry } from '@/types/food';
import { embed } from './embedder';

// ko-sroberta 임베딩 + 코사인 유사도로 OCR 상품명을 식품 DB 표준명과 매칭한다.
// DB는 식품마다 이름 1개(standardName)만 쓴다.

export interface FoodMatch {
  entry: FoodDbEntry;
  score: number; // 코사인 유사도 (-1~1, 실제로는 대략 0.3~1.0)
}

interface DbVector {
  entry: FoodDbEntry;
  vector: number[];
}

// DB 임베딩 캐시: 앱이 켜져 있는 동안 한 번만 계산해서 메모리에 들고 있는다.
// (영수증 한 줄마다 DB 전체를 다시 임베딩하지 않음)
// DB가 16개 단어뿐이라 앱 시작 시 계산해도 1초 안팎이고, DB를 고치면 자동으로 새 값이 반영된다.
let dbVectorsPromise: Promise<DbVector[]> | null = null;

function getDbVectors(): Promise<DbVector[]> {
  if (!dbVectorsPromise) {
    dbVectorsPromise = (async () => {
      const out: DbVector[] = [];
      for (const entry of foodDatabase) {
        out.push({ entry, vector: await embed(entry.standardName) });
      }
      return out;
    })().catch((error) => {
      dbVectorsPromise = null; // 실패하면 다음 호출 때 다시 계산
      throw error;
    });
  }
  return dbVectorsPromise;
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
  return dbVectors
    .map(({ entry, vector }) => ({ entry, score: dot(inputVec, vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
