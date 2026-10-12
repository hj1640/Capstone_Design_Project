import { MockReceipt } from '@/types/food';
import { todayIso } from '@/utils/date';

// 영수증 OCR 결과 모의 데이터
// 실제 구현에서는 Google ML Kit Text Recognition v2 (한국어 모델)로
// 이미지에서 텍스트 블록/줄을 추출(rawLines)한 뒤, 정규표현식/키워드 사전으로
// 날짜·수량·금액을 분리하고, paraphrase-multilingual-MiniLM-L12-v2 임베딩으로
// 표준 DB와의 코사인 유사도를 계산해 candidates를 만든다.
// 이 파일은 그 결과물을 미리 만들어 둔 것으로, UI/플로우 검증 및
// 실제 모델을 붙여 넣을 자리를 명확히 보여주기 위한 자리표시자(placeholder)다.

export const mockReceipts: MockReceipt[] = [
  {
    id: 'receipt-mart',
    storeName: '이마트 수원점',
    date: todayIso(),
    rawLines: [
      '이마트 수원점 (현영수증)',
      '서울우유 1L         2,980',
      '바나나 1송이(수입)    3,500',
      '애호박 1개          1,500',
      '풀무원 부침두부      2,200',
      '오뚜기밥 210g*3     4,980',
      '합계              15,160',
    ],
    candidates: [
      {
        id: 'c1',
        rawText: '서울우유 1L',
        guessedName: '흰우유',
        alternativeNames: [],
        confidence: 0.94,
        category: '유제품',
        quantity: 1000,
        unit: 'ml',
        status: 'confirmed',
      },
      {
        id: 'c2',
        rawText: '바나나 1송이(수입)',
        guessedName: '바나나',
        alternativeNames: [],
        confidence: 0.97,
        category: '과일',
        quantity: 6,
        unit: '개',
        status: 'confirmed',
      },
      {
        id: 'c3',
        rawText: '애호박 1개',
        guessedName: '애호박',
        alternativeNames: ['주키니호박'],
        confidence: 0.68,
        category: '채소',
        quantity: 1,
        unit: '개',
        status: 'uncertain',
      },
      {
        id: 'c4',
        rawText: '풀무원 부침두부',
        guessedName: '두부',
        alternativeNames: [],
        confidence: 0.91,
        category: '가공식품',
        quantity: 1,
        unit: '개',
        status: 'confirmed',
      },
      {
        id: 'c5',
        rawText: '오뚜기밥 210g*3',
        guessedName: '즉석밥',
        alternativeNames: [],
        confidence: 0.89,
        category: '가공식품',
        quantity: 3,
        unit: '개',
        status: 'confirmed',
      },
    ],
  },
  {
    id: 'receipt-market',
    storeName: '수원 전통시장 정육점',
    date: todayIso(),
    rawLines: [
      '싱싱정육점',
      '국내산 삼겹살 600g   13,800',
      '대파 1단            2,000',
      '손질고등어 2마리     8,000',
      '방울토마토500g       4,500',
      '합계               28,300',
    ],
    candidates: [
      {
        id: 'c6',
        rawText: '국내산 삼겹살 600g',
        guessedName: '돼지고기 삼겹살',
        alternativeNames: [],
        confidence: 0.93,
        category: '육류',
        quantity: 600,
        unit: 'g',
        status: 'confirmed',
      },
      {
        id: 'c7',
        rawText: '대파 1단',
        guessedName: '대파',
        alternativeNames: ['쪽파'],
        confidence: 0.72,
        category: '채소',
        quantity: 300,
        unit: 'g',
        status: 'uncertain',
      },
      {
        id: 'c8',
        rawText: '손질고등어 2마리',
        guessedName: '고등어',
        alternativeNames: [],
        confidence: 0.88,
        category: '수산물',
        quantity: 2,
        unit: '마리',
        status: 'confirmed',
      },
      {
        id: 'c9',
        rawText: '방울토마토500g',
        guessedName: '방울토마토',
        alternativeNames: ['대추토마토'],
        confidence: 0.65,
        category: '과일',
        quantity: 500,
        unit: 'g',
        status: 'uncertain',
      },
    ],
  },
];

export function getMockReceipt(id: string): MockReceipt | undefined {
  return mockReceipts.find((r) => r.id === id);
}
