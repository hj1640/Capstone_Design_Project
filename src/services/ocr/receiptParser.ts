// 영수증 텍스트 전처리
// 과제계획서 "나" 항목: "정규표현식, 키워드 사전으로 날짜, 수량, 금액, 합계, 결제 문구를
// 분리하며, 고정 좌표 대신 텍스트 내용과 줄의 상대 배치로 상품명 후보를 선별한다."

const NOISE_PATTERNS: RegExp[] = [
  /합\s*계/,
  /부가세/,
  /과세물품/,
  /면세물품/,
  /카드\s*(승인|매출|번호)?/,
  /현금/,
  /포인트/,
  /적립/,
  /할인/,
  /거스름/,
  /받은\s*금액/,
  /환불/,
  /사업자\s*번호/,
  /대표자/,
  /전화/,
  /tel/i,
  /주소/,
  /영수증/,
  /승인\s*번호/,
  /거래\s*일시/,
  /매장명?/,
  /점포/,
  /biz/i,
  /홈페이지/,
  /www\./i,
  /이용해\s*주셔서/,
  /감사합니다/,
  /^\*+$/,
  /^-+$/,
  /^=+$/,
  // 날짜만 있는 줄 (2026-10-12, 2026.10.12, 10/12 등)
  /^\d{2,4}[-.\/]\d{1,2}[-.\/]\d{1,2}/,
  // 시간만 있는 줄 (13:05:21)
  /^\d{1,2}:\d{2}(:\d{2})?$/,
];

function isNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 2) return true;
  return NOISE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

// 줄 끝의 금액 표기 (쉼표 포함 3자리 이상 숫자, 끝에 '원' 선택적으로)
const TRAILING_PRICE = /[\d,]{3,}\s*원?\s*$/;

// "오뚜기밥 210g*3" 처럼 뒤에 붙는 수량 배수
const QTY_MULTIPLIER = /[*xX×]\s*(\d+)\s*$/;

// "대파 1단", "고등어 2마리" 처럼 뒤에 붙는 수량+단위
const QTY_WITH_UNIT = /(\d+)\s*(개|마리|단|봉|팩|병|캔|모|포기|송이)\s*$/;

export interface ParsedReceiptLine {
  rawText: string; // 원본 줄 (사용자에게 보여줄 OCR 원문)
  nameCandidate: string; // 가격/수량 표기를 제거한 상품명 후보
  quantity: number;
  unitHint?: string;
}

export function parseReceiptLines(lines: string[]): ParsedReceiptLine[] {
  const results: ParsedReceiptLine[] = [];

  for (const rawLine of lines) {
    if (isNoiseLine(rawLine)) continue;

    let text = rawLine.trim();
    text = text.replace(TRAILING_PRICE, '').trim();
    if (!text) continue;

    let quantity = 1;
    let unitHint: string | undefined;

    const multiplierMatch = text.match(QTY_MULTIPLIER);
    if (multiplierMatch) {
      quantity = Number(multiplierMatch[1]) || 1;
      text = text.slice(0, multiplierMatch.index).trim();
    } else {
      const unitMatch = text.match(QTY_WITH_UNIT);
      if (unitMatch) {
        quantity = Number(unitMatch[1]) || 1;
        unitHint = unitMatch[2];
      }
    }

    if (text.replace(/\s/g, '').length < 2) continue;

    results.push({ rawText: rawLine.trim(), nameCandidate: text, quantity, unitHint });
  }

  return results;
}

// 영수증 상단부에서 매장명으로 보이는 첫 줄을 추정한다 (고정 좌표 대신 상대 위치 활용).
// 실제 영수증은 거의 항상 첫 줄이 매장명이므로, 품목 후보를 걸러낼 때 쓰는
// isNoiseLine보다 훨씬 느슨한 기준(빈 줄이 아니고 너무 길지 않음)만 적용한다.
export function guessStoreName(lines: string[]): string {
  for (const line of lines.slice(0, 3)) {
    const trimmed = line.trim();
    if (trimmed.length >= 2 && trimmed.length <= 24) {
      return trimmed;
    }
  }
  return '인식된 영수증';
}
