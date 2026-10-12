import { foodDatabase } from '@/data/foodDatabase';
import { FoodDbEntry } from '@/types/food';

// ⚠️ 임시 매칭기 (MiniLM 임베딩 이전 단계)
// 과제계획서 "다" 항목의 최종 목표는 paraphrase-multilingual-MiniLM-L12-v2로
// OCR 상품명과 DB 표준명/동의어를 384차원 벡터로 임베딩해 코사인 유사도를 비교하는 것이다.
// 그 모델을 기기에서 돌리려면 ONNX 변환 + INT8 양자화 + 추론 런타임(onnxruntime-react-native 등)
// 작업이 추가로 필요해서, 지금은 "문자 2-gram Jaccard 유사도" 기반 매칭으로 같은 인터페이스를
// 구현해뒀다. 나중에 이 파일의 matchFoodName 내부 구현만 임베딩 비교로 바꾸면
// receiptParser → foodMatcher → OcrCandidate로 이어지는 나머지 파이프라인은 그대로 재사용된다.
// 한국어는 띄어쓰기가 자유로워 띄어쓰기를 제거한 뒤 문자 n-gram으로 비교하는 쪽이
// 띄어쓰기 기준 토큰 비교보다 안정적이다.

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\d+\s*(ml|l|g|kg|개|봉|팩|마리|단|병|캔|모|포기|송이)?/g, '') // 용량/수량 표기 제거
    .replace(/[^\p{L}\p{N}]/gu, '') // 공백/기호 제거
    .trim();
}

function bigrams(text: string): Set<string> {
  const set = new Set<string>();
  if (text.length <= 1) {
    if (text) set.add(text);
    return set;
  }
  for (let i = 0; i < text.length - 1; i++) set.add(text.slice(i, i + 2));
  return set;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const gram of a) if (b.has(gram)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface FoodMatch {
  entry: FoodDbEntry;
  score: number; // 0~1, 실제 구현에서는 코사인 유사도로 대체될 값
}

export function matchFoodName(rawText: string, topK = 3): FoodMatch[] {
  const inputGrams = bigrams(normalize(rawText));

  const scored: FoodMatch[] = foodDatabase.map((entry) => {
    const candidateNames = [entry.standardName, ...entry.synonyms];
    const bestScore = Math.max(
      ...candidateNames.map((name) => jaccard(inputGrams, bigrams(normalize(name)))),
    );
    return { entry, score: bestScore };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}
