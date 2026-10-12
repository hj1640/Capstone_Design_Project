import { mockReceipts } from '@/data/mockReceipts';
import { OcrEngine, RawOcrResult } from './types';

// 실기기/ML Kit 빌드가 없을 때 쓰는 모의 엔진.
// 미리 만들어 둔 영수증 중 하나를 골라, 약간의 지연 후 OCR 결과인 것처럼 반환한다.
export const mockOcrEngine: OcrEngine = {
  name: 'mock',

  isAvailable() {
    return true; // 항상 사용 가능 (최종 폴백)
  },

  async recognize(_imageUri: string, delayMs = 1400): Promise<RawOcrResult> {
    const picked = mockReceipts[Math.floor(Math.random() * mockReceipts.length)];
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return { rawText: picked.rawLines.join('\n'), lines: [...picked.rawLines] };
  },
};
