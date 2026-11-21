// 영수증 텍스트 전처리
// 과제계획서 "나" 항목: "정규표현식, 키워드 사전으로 날짜, 수량, 금액, 합계, 결제 문구를
// 분리하며, 고정 좌표 대신 텍스트 내용과 줄의 상대 배치로 상품명 후보를 선별한다."
//
// 입력은 지류(종이) 영수증만 지원한다.

// 날짜/시간만 있는 줄 (guessStoreName에서도 재사용)
const DATE_ONLY_LINE = /^\d{2,4}\s*[-.\/]\s*\d{1,2}\s*[-.\/]\s*\d{1,2}/;
const TIME_ONLY_LINE = /^\d{1,2}\s*:\s*\d{2}(\s*:\s*\d{2})?$/;

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
  DATE_ONLY_LINE,
  TIME_ONLY_LINE,
  // 가격+수량만 있는 줄 ("1,990원1개"처럼 상품명 줄과 분리되어 따로 찍히는 경우)
  /^[\d,]+\s*원\s*\d+\s*(개|봉|팩|병|캔|모|마리|단|포기|송이)?\s*$/,
  // "라벨: 값" 형식 (대표: / 회원 : / 할부 : / 카드사: / 판매총액: …) — 상품명에는 콜론이 거의 없다
  /[:：]/,
  // 표 머리글·바코드·주소·인사말
  /단\s*가/,
  /상품\s*\(?\s*코드/,
  /바\s*코\s*드/,
  /총\s*액/,
  /액.*원$/,
  /대\s*표/,
  /회\s*원/,
  /[할활]\s*부/,
  /^승\s*[인이]$/,
  /\.(com|net|kr|co)\b/i,
  /최선을|방문해|또\s*오세요/,
  // 안내 문구 ("반품시 영수증 지참 바랍니다", "5월은 지방소득세 납부의 달 입니다", "납세의무가 있는 자")
  /바랍|입니|합니|십시|하세요|드립니|드려요|주세요/,
  /납부|납세|소득세|세금|의무|과세|면세/,
  /반품|교환|환불|지참/,
  /봉투|계산원|캐셔|담당자/,
  /상\s*품\s*명|수\s*량/,
  // "[결제 금액] 1,600원", "[단말기 ID] 5832974", "[카드 번호] …" 같은 대괄호 항목 줄
  /\[[^\]]*\]/,
  /결\s*제|금\s*액|단\s*말\s*기|가\s*맹\s*점|취\s*소/,
];

// 상품명이 되려면 한글이 최소 2글자는 있어야 한다 (가격·바코드·코드 줄은 숫자/영문뿐)
const MIN_HANGUL = 2;

// 농협·마트 영수증의 품목 순번 ("001 P굿모닝우유", "O0b P브로커리" — OCR이 0을 O/b로 읽기도 함)
const ITEM_INDEX_PREFIX = /^[0-9OoDbB]{2,3}\s*[Pp]\s*/;

// 영수증/화면 맨 앞에 붙는 네비게이션 기호(뒤로가기 화살표 등)로 시작하는 줄.
// 이런 줄은 "<주문내역"처럼 상품명이나 매장명이 아니라 화면 UI 요소일 확률이 매우 높다.
const UI_SYMBOL_PREFIX = /^[<Δ△▶›»]/;

function isNoiseLine(line: string): boolean {
  // 눈에 안 보이는 문자(폭 없는 공백 등)를 지우고 판단한다
  const trimmed = line.replace(/[\u200b-\u200d\ufeff\u00a0]/g, ' ').trim();
  if (trimmed.length < 2) return true;
  if ((trimmed.match(/[가-힣]/g) ?? []).length < MIN_HANGUL) return true;
  return NOISE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

// 줄 끝의 금액 표기 (쉼표 포함 3자리 이상 숫자, 끝에 '원' 선택적으로)
const TRAILING_PRICE = /[\d,]{3,}\s*원?\s*$/;

// "두부 1,000 2 2,000" 처럼 상품명·단가·수량·금액이 한 줄에 있는 형식
const COLUMN_LINE = /^(.+?)\s+[\d,]+\s+(\d{1,3})\s+[\d,]+\s*원?$/;

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

    let text = rawLine.trim().replace(ITEM_INDEX_PREFIX, '');
    if ((text.match(/[가-힣]/g) ?? []).length < MIN_HANGUL) continue;
    // 끝에 붙은 문장부호/OCR 잡티 제거 ("양 파," "브로커리 .")
    text = text.replace(/[\s.,·]+$/, '');

    // "상품명 단가 수량 금액"이 한 줄에 찍힌 경우 (예: "두부 1,000 2 2,000")
    const columns = text.match(COLUMN_LINE);
    if (columns && /[가-힣a-z]/i.test(columns[1])) {
      results.push({ rawText: text, nameCandidate: columns[1].trim(), quantity: Number(columns[2]) || 1 });
      continue;
    }

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
// 다만 "<주문내역"처럼 명백히 UI 기호로 시작하는 줄은 매장/플랫폼명이 될 수 없으므로 제외한다.
export function guessStoreName(lines: string[]): string {
  // 매장명에 흔한 단어가 있는 줄을 먼저 찾는다 (계산원 이름 같은 짧은 줄을 매장명으로 잡지 않도록)
  const STORE_HINT = /마트|하나로|슈퍼|상회|편의점|점$|마켓|농협|이마트|홈플러스|롯데|코스트코|GS25|CU|세븐일레븐/i;
  const hinted = lines.slice(0, 6).map((l) => l.trim()).find((l) => l.length >= 2 && l.length <= 24 && STORE_HINT.test(l));
  if (hinted) return hinted;
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    if (UI_SYMBOL_PREFIX.test(trimmed)) continue;
    if (DATE_ONLY_LINE.test(trimmed) || TIME_ONLY_LINE.test(trimmed)) continue;
    // 주소·전화·대표자·사업자번호 줄은 매장명이 아니다
    if (/주\s*소|전\s*화|대\s*표|사업자|tel/i.test(trimmed)) continue;
    if (trimmed.length >= 2 && trimmed.length <= 24) {
      return trimmed;
    }
  }
  return '인식된 영수증';
}

