import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { FoodItem, MockReceipt, OcrCandidate, PurchaseHistoryEntry, FoodCategory } from '@/types/food';
import { fridgeItems as initialFridgeItems } from '@/data/fridgeItems';
import { purchaseHistory as initialPurchaseHistory } from '@/data/purchaseHistory';
import { discardLog as initialDiscardLog, DiscardEntry } from '@/data/discardLog';
import { findFoodDbEntry } from '@/data/foodDatabase';
import { addDays, todayIso } from '@/utils/date';

// 앱 전역 상태 (실제 구현에서는 "단말 내 경량 DB"로 영속화될 영역)
// 과제계획서: "식품 표준정보, 보유 식품, 구매 이력, 수량 변경 이력을 단말 내 경량 DB에 저장"
// 이 Context는 그 역할을 메모리 상에서 대신하는 자리표시자이며,
// 실제 구현에서는 SQLite(expo-sqlite) 등으로 교체한다.

const CATEGORY_DEFAULT_VALUE_WON: Record<FoodCategory, number> = {
  채소: 1800,
  과일: 3000,
  유제품: 2500,
  육류: 9000,
  수산물: 7000,
  가공식품: 2000,
  음료: 1500,
  '곡물/베이커리': 2800,
  '조미료/소스': 4000,
};

interface FridgeContextValue {
  fridgeItems: FoodItem[];
  purchaseHistory: PurchaseHistoryEntry[];
  discardLog: DiscardEntry[];
  addConfirmedReceiptItems: (
    candidates: OcrCandidate[],
    source: FoodItem['source'],
  ) => void;
  adjustRemaining: (itemId: string, deltaRatio: number) => void;
  removeItem: (itemId: string, outcome: 'consumed' | 'discarded') => void;
  // 영수증 등록 화면에서 생성되고, 인식결과 확인 화면에서 소비되는 임시 세션 데이터.
  // 복잡한 배열 데이터를 라우트 파라미터로 직렬화하는 대신 Context로 전달한다.
  pendingReceipt: MockReceipt | null;
  setPendingReceipt: (receipt: MockReceipt | null) => void;
}

const FridgeContext = createContext<FridgeContextValue | undefined>(undefined);

export function FridgeProvider({ children }: { children: React.ReactNode }) {
  const [fridgeItems, setFridgeItems] = useState<FoodItem[]>(initialFridgeItems);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryEntry[]>(
    initialPurchaseHistory,
  );
  const [discardLog, setDiscardLog] = useState<DiscardEntry[]>(initialDiscardLog);
  const [pendingReceipt, setPendingReceipt] = useState<MockReceipt | null>(null);

  const addConfirmedReceiptItems = useCallback(
    (candidates: OcrCandidate[], source: FoodItem['source']) => {
      const today = todayIso();
      const newItems: FoodItem[] = [];
      const newHistory: PurchaseHistoryEntry[] = [];

      candidates
        .filter((c) => c.status !== 'rejected')
        .forEach((c, idx) => {
          const db = findFoodDbEntry(c.guessedName);
          // 예상 소비기한 산정: 구매일 + 미개봉 기준 보관일수 (과제계획서 "라" 항목)
          const shelfLifeDays = db?.shelfLifeUnopenedDays ?? 7;
          const expiryDate = addDays(today, shelfLifeDays);

          newItems.push({
            id: `new-${Date.now()}-${idx}`,
            standardName: c.guessedName,
            category: c.category,
            storageType: db?.defaultStorage ?? '냉장',
            icon: db?.icon ?? '🛒',
            purchaseDate: today,
            expectedExpiryDate: expiryDate,
            isOpened: false,
            totalQuantity: c.quantity,
            remainingQuantity: c.quantity,
            unit: c.unit,
            consumptionPattern: db?.consumptionPattern ?? '비주기형',
            nutrition: db?.nutrition ?? { calories: 0, protein: 0, fat: 0, carbs: 0 },
            source,
          });

          newHistory.push({
            id: `hist-${Date.now()}-${idx}`,
            standardName: c.guessedName,
            category: c.category,
            date: today,
            quantity: c.quantity,
            unit: c.unit,
            source,
          });
        });

      setFridgeItems((prev) => [...newItems, ...prev]);
      setPurchaseHistory((prev) => [...newHistory, ...prev]);
    },
    [],
  );

  const adjustRemaining = useCallback((itemId: string, deltaRatio: number) => {
    setFridgeItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const delta = item.totalQuantity * deltaRatio;
        const next = Math.max(0, Math.min(item.totalQuantity, item.remainingQuantity + delta));
        return { ...item, remainingQuantity: next };
      }),
    );
  }, []);

  const removeItem = useCallback(
    (itemId: string, outcome: 'consumed' | 'discarded') => {
      setFridgeItems((prev) => {
        const target = prev.find((i) => i.id === itemId);
        if (target && outcome === 'discarded') {
          setDiscardLog((log) => [
            {
              id: `discard-${Date.now()}`,
              standardName: target.standardName,
              category: target.category,
              date: todayIso(),
              estimatedValueWon:
                CATEGORY_DEFAULT_VALUE_WON[target.category] ?? 2000,
              hadWarning: true,
            },
            ...log,
          ]);
        }
        return prev.filter((i) => i.id !== itemId);
      });
    },
    [],
  );

  const value = useMemo(
    () => ({
      fridgeItems,
      purchaseHistory,
      discardLog,
      addConfirmedReceiptItems,
      adjustRemaining,
      removeItem,
      pendingReceipt,
      setPendingReceipt,
    }),
    [
      fridgeItems,
      purchaseHistory,
      discardLog,
      addConfirmedReceiptItems,
      adjustRemaining,
      removeItem,
      pendingReceipt,
    ],
  );

  return <FridgeContext.Provider value={value}>{children}</FridgeContext.Provider>;
}

export function useFridge(): FridgeContextValue {
  const ctx = useContext(FridgeContext);
  if (!ctx) throw new Error('useFridge는 FridgeProvider 내부에서만 사용할 수 있습니다');
  return ctx;
}
