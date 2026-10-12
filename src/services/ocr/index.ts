import { MockReceipt, OcrCandidate } from '@/types/food';
import { mockReceipts } from '@/data/mockReceipts';
import { todayIso } from '@/utils/date';
import { mlkitOcrEngine } from './mlkitEngine';
import { parseReceiptLines, guessStoreName } from './receiptParser';
import { matchFoodName } from './foodMatcher';

export { parseReceiptLines, guessStoreName } from './receiptParser';
export { matchFoodName } from './foodMatcher';
export { mlkitOcrEngine } from './mlkitEngine';
export { mockOcrEngine } from './mockEngine';

// 신뢰도 임계값: 과제계획서 "다" 항목 "유사도가 낮거나 후보 간 점수 차이가 작으면
// 2~3개 후보를 제시한다"를 그대로 구현한 것. 실제 MiniLM 코사인 유사도로 바뀌면
// 이 숫자들도 재조정이 필요할 가능성이 높다 (문자열 유사도와 임베딩 유사도의 분포가 다름).
const CONFIDENT_THRESHOLD = 0.5;
const MIN_GAP_FOR_CONFIDENT = 0.15;
const REJECT_THRESHOLD = 0.12;

function buildCandidatesFromOcr(lines: string[]): OcrCandidate[] {
  const parsedLines = parseReceiptLines(lines);

  return parsedLines.map((parsed, idx) => {
    const matches = matchFoodName(parsed.nameCandidate, 3);
    const top = matches[0];
    const second = matches[1];

    if (!top || top.score < REJECT_THRESHOLD) {
      // 식품 DB와 거의 유사하지 않음 (영수증 잡음일 가능성) → 사용자가 직접 보고 판단하도록
      // 가장 낮은 신뢰도로 남겨둔다 (자동 제외하지 않음: 과잉 필터링보다 사용자 확인이 안전)
      return {
        id: `live-${Date.now()}-${idx}`,
        rawText: parsed.rawText,
        guessedName: parsed.nameCandidate,
        alternativeNames: [],
        confidence: top?.score ?? 0,
        category: '가공식품',
        quantity: parsed.quantity,
        unit: parsed.unitHint ?? '개',
        status: 'uncertain',
      } satisfies OcrCandidate;
    }

    const gap = top.score - (second?.score ?? 0);
    const isConfident = top.score >= CONFIDENT_THRESHOLD && gap >= MIN_GAP_FOR_CONFIDENT;

    return {
      id: `live-${Date.now()}-${idx}`,
      rawText: parsed.rawText,
      guessedName: top.entry.standardName,
      // TODO: "1단"→300g 같은 단위 환산은 아직 안 붙어 있음. 지금은 OCR에서 읽은 숫자를
      // 그대로 수량으로 쓰고, 단위만 DB 기준 단위로 맞춘다.
      alternativeNames: isConfident
        ? []
        : matches.slice(1, 3).map((m) => m.entry.standardName),
      confidence: top.score,
      category: top.entry.category,
      quantity: parsed.quantity,
      unit: top.entry.unit,
      status: isConfident ? 'confirmed' : 'uncertain',
    } satisfies OcrCandidate;
  });
}

// 영수증 등록 화면에서 호출하는 단일 진입점.
// 1) 실기기 + 개발 빌드라면 Google ML Kit으로 실제 OCR을 돌리고, 그 결과를
//    정규식 전처리(receiptParser) + 문자열 유사도 매칭(foodMatcher)으로 후보를 만든다.
// 2) 그렇지 않으면 (Expo Go, 웹, 혹은 ML Kit 인식 자체가 실패하면) 모의 데이터로 대체한다.
export async function runReceiptOcrPipeline(imageUri: string): Promise<MockReceipt> {
  if (mlkitOcrEngine.isAvailable()) {
    try {
      const raw = await mlkitOcrEngine.recognize(imageUri);
      const storeName = guessStoreName(raw.lines);
      // 매장명으로 인식된 줄은 품목 후보에서 제외한다 (그렇지 않으면 "OO마트" 같은
      // 줄이 식품 DB와 억지로 매칭되어 엉뚱한 후보로 뜬다)
      const itemLines = raw.lines.filter((line) => line.trim() !== storeName);
      const candidates = buildCandidatesFromOcr(itemLines);
      return {
        id: `live-${Date.now()}`,
        storeName,
        date: todayIso(),
        rawLines: raw.lines,
        candidates,
        engine: 'mlkit',
      };
    } catch (err) {
      console.warn('[OCR] Google ML Kit 인식에 실패해 모의 데이터로 대체합니다:', err);
    }
  }

  // 모의 데이터 폴백: 미리 손으로 다듬어 둔 영수증 결과(candidates 포함)를 그대로 사용한다.
  // (실제 파서/매칭기 품질은 아래 buildCandidatesFromOcr가 ML Kit 경로에서 담당한다)
  await new Promise((resolve) => setTimeout(resolve, 1400));
  const picked = mockReceipts[Math.floor(Math.random() * mockReceipts.length)];
  const cloned: MockReceipt = JSON.parse(JSON.stringify(picked));
  cloned.id = `mock-${Date.now()}`;
  cloned.date = todayIso();
  cloned.engine = 'mock';
  return cloned;
}
