// OCR 엔진 공통 인터페이스
// 실제 Google ML Kit 엔진과, 기기가 없을 때 쓰는 모의 엔진이 같은 형태로 동작하도록 한다.

export interface RawOcrResult {
  rawText: string; // 전체 인식 텍스트
  lines: string[]; // 줄 단위로 평탄화한 텍스트 (영수증 한 줄 = 품목 하나를 기대)
}

export interface OcrEngine {
  name: 'google-ml-kit' | 'mock';
  /** 이 엔진을 지금 바로 호출할 수 있는지 (네이티브 모듈 연결 여부 등) */
  isAvailable(): boolean;
  recognize(imageUri: string): Promise<RawOcrResult>;
}
