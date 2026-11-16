import type { MockReceipt, OcrCandidate } from '@/types/food';
import { mockReceipts } from '@/data/mockReceipts';
import { mlkitOcrEngine } from './mlkitEngine';
import { parseReceiptLines, guessStoreName } from './receiptParser';
import { parseReceiptDate } from './paperReceipt';
import { matchFoodName } from './foodMatcher';

export { parseReceiptLines, guessStoreName } from './receiptParser';
export { matchFoodName, warmUpFoodMatcher } from './foodMatcher';
export { mlkitOcrEngine } from './mlkitEngine';

// 입력은 지류(종이) 영수증만 지원한다.
// 1) ML Kit으로 OCR → 2) receiptParser로 잡음 제거·수량 추출 → 3) 영수증 날짜 추출
// → 4) ko-sroberta 코사인 유사도로 식품 DB 표준명과 매칭

// 임계값 (ko-sroberta 코사인 유사도 기준, scripts/calibrate_threshold.py로 보정)
// 2026-11-16 예시 44개 실험: 점수>=0.50 && 1-2위 차이>=0.15 → 자동확정 19개 모두 정답.
// 0.40 미만은 DB에 없는 품목/잡음일 가능성이 높아 표준명 추측 없이 원문 그대로 사용자 확인.
// ⚠️ 직접 만든 예시 기준이므로 실제 영수증을 모아 다시 돌려서 조정할 것.
const CONFIDENT_THRESHOLD = 0.5;
const MIN_GAP_FOR_CONFIDENT = 0.15;
const REJECT_THRESHOLD = 0.4;

async function buildCandidatesFromOcr(lines: string[]): Promise<OcrCandidate[]> {
  const parsedLines = parseReceiptLines(lines);

  return Promise.all(parsedLines.map(async (parsed, idx) => {
    const matches = await matchFoodName(parsed.nameCandidate, 3);
    const top = matches[0];
    const second = matches[1];

    if (!top || top.score < REJECT_THRESHOLD) {
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
      // TODO: "1단"→300g 같은 단위 환산은 아직 안 붙어 있음.
      alternativeNames: isConfident ? [] : matches.slice(1, 3).map((m) => m.entry.standardName),
      confidence: top.score,
      category: top.entry.category,
      quantity: parsed.quantity,
      unit: top.entry.unit,
      status: isConfident ? 'confirmed' : 'uncertain',
    } satisfies OcrCandidate;
  }));
}

export async function runReceiptOcrPipeline(imageUri: string): Promise<MockReceipt> {
  if (mlkitOcrEngine.isAvailable()) {
    try {
      const raw = await mlkitOcrEngine.recognize(imageUri);
      const storeName = guessStoreName(raw.lines);
      const { orderDate, dateNeedsReview } = parseReceiptDate(raw.lines);
      // 매장명 줄은 품목 후보에서 제외 ("OO마트"가 식품과 억지로 매칭되는 것 방지)
      const itemLines = raw.lines.filter((line) => line.trim() !== storeName);
      const candidates = await buildCandidatesFromOcr(itemLines);
      if (__DEV__) {
        console.log('[OCR raw]', JSON.stringify({ storeName, orderDate, lines: raw.lines }));
        console.log('[OCR candidates]', JSON.stringify(candidates.map((c) => [c.rawText, c.guessedName, c.confidence, c.status])));
      }
      return {
        id: `live-${Date.now()}`,
        storeName,
        date: orderDate,
        dateNeedsReview,
        rawLines: raw.lines,
        candidates,
        engine: 'mlkit',
      };
    } catch (err) {
      console.warn('[OCR] Google ML Kit 인식에 실패해 모의 데이터로 대체합니다:', err);
    }
  }

  // Expo Go/웹 등 ML Kit이 없는 환경: 미리 만들어 둔 예시 영수증으로 화면 흐름만 보여준다.
  // 구매일은 자동으로 채우지 않고 사용자가 확인하도록 둔다.
  await new Promise((resolve) => setTimeout(resolve, 1400));
  const picked = mockReceipts[Math.floor(Math.random() * mockReceipts.length)];
  const cloned: MockReceipt = JSON.parse(JSON.stringify(picked));
  cloned.id = `mock-${Date.now()}`;
  cloned.date = null;
  cloned.dateNeedsReview = true;
  cloned.engine = 'mock';
  return cloned;
}
