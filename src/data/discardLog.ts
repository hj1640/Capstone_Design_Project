import { FoodCategory } from '@/types/food';
import { addDays, todayIso } from '@/utils/date';

// 폐기(소비기한 경과로 버려짐) 이력 (모의 데이터)
// 교수님 피드백 보완: 단순 파이프라인(OCR→분류→표시)을 넘어
// "쌓인 데이터를 분석해 사용자에게 인사이트로 돌려주는" 기능의 기초 데이터.
// 실제 구현 시에는 사용자가 품목을 삭제할 때 "다 먹음 / 버림"을 선택하도록 하여 수집한다.

export interface DiscardEntry {
  id: string;
  standardName: string;
  category: FoodCategory;
  date: string; // 폐기 인지일
  estimatedValueWon: number; // 추정 손실 금액
  hadWarning: boolean; // 임박 알림을 받은 이후에도 폐기되었는지
}

const today = todayIso();

export const discardLog: DiscardEntry[] = [
  { id: 'd1', standardName: '애호박', category: '채소', date: addDays(today, -3), estimatedValueWon: 1500, hadWarning: true },
  { id: 'd2', standardName: '대파', category: '채소', date: addDays(today, -6), estimatedValueWon: 2000, hadWarning: true },
  { id: 'd3', standardName: '방울토마토', category: '과일', date: addDays(today, -9), estimatedValueWon: 4000, hadWarning: false },
  { id: 'd4', standardName: '돼지고기 삼겹살', category: '육류', date: addDays(today, -12), estimatedValueWon: 9000, hadWarning: true },
  { id: 'd5', standardName: '두부', category: '가공식품', date: addDays(today, -15), estimatedValueWon: 1800, hadWarning: false },
  { id: 'd6', standardName: '흰우유', category: '유제품', date: addDays(today, -18), estimatedValueWon: 2500, hadWarning: true },
  { id: 'd7', standardName: '고등어', category: '수산물', date: addDays(today, -22), estimatedValueWon: 7000, hadWarning: false },
  { id: 'd8', standardName: '바나나', category: '과일', date: addDays(today, -25), estimatedValueWon: 1200, hadWarning: true },
  { id: 'd9', standardName: '애호박', category: '채소', date: addDays(today, -33), estimatedValueWon: 1500, hadWarning: false },
  { id: 'd10', standardName: '방울토마토', category: '과일', date: addDays(today, -40), estimatedValueWon: 4000, hadWarning: true },
  { id: 'd11', standardName: '돼지고기 삼겹살', category: '육류', date: addDays(today, -48), estimatedValueWon: 9000, hadWarning: false },
  { id: 'd12', standardName: '두부', category: '가공식품', date: addDays(today, -55), estimatedValueWon: 1800, hadWarning: true },
];
