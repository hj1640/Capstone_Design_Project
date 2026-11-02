import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { FoodItem, MockReceipt, OcrCandidate, PurchaseHistoryEntry, FoodCategory } from '@/types/food';
import { fridgeItems as initialFridgeItems } from '@/data/fridgeItems';
import { purchaseHistory as initialPurchaseHistory } from '@/data/purchaseHistory';
import { discardLog as initialDiscardLog, DiscardEntry } from '@/data/discardLog';
import { buildRegistration } from '@/services/registration';
import { randomUUID } from 'expo-crypto';
import { todayIso } from '@/utils/date';
import { feedbackStore } from '@/services/feedback/local';
import type { EditSource } from '@/services/feedback/store';

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
    purchaseDate: string,
  ) => void;
  adjustRemaining: (itemId: string, deltaRatio: number) => void;
  removeItem: (itemId: string, outcome: 'consumed' | 'discarded') => void;
  savePersonalExpiry: (item: FoodItem, expiry: string | null, source: EditSource | null) => void;
  refreshPersonalExpiry: () => void;
  // 영수증 등록 화면에서 생성되고, 인식결과 확인 화면에서 소비되는 임시 세션 데이터.
  // 복잡한 배열 데이터를 라우트 파라미터로 직렬화하는 대신 Context로 전달한다.
  pendingReceipt: MockReceipt | null;
  setPendingReceipt: (receipt: MockReceipt | null) => void;
}

const FridgeContext = createContext<FridgeContextValue | undefined>(undefined);

export function FridgeProvider({ children }: { children: React.ReactNode }) {
  const [fridgeItems, setFridgeItems] = useState<FoodItem[]>(()=>feedbackStore.overlay(__DEV__ ? initialFridgeItems : []));
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryEntry[]>(
    ()=>[...(__DEV__ ? initialPurchaseHistory : []),...feedbackStore.purchaseHistory()],
  );
  const [discardLog, setDiscardLog] = useState<DiscardEntry[]>(__DEV__ ? initialDiscardLog : []);
  const [pendingReceipt, setPendingReceipt] = useState<MockReceipt | null>(null);
  const refreshPersonalExpiry=useCallback(()=>setFridgeItems(previous=>feedbackStore.overlay(previous)),[]);
  const savePersonalExpiry=useCallback((item: FoodItem,expiry: string | null,source: EditSource | null)=>{
    feedbackStore.edit(item,expiry,source); // Durable save precedes visible success.
    setFridgeItems(previous=>feedbackStore.overlay(previous));
  },[]);

  const addConfirmedReceiptItems = useCallback(
    (candidates: OcrCandidate[], source: FoodItem['source'], purchaseDate: string) => {
      const registered=buildRegistration(candidates,source,purchaseDate,randomUUID);
      feedbackStore.remember(registered.items,registered.history);
      setFridgeItems(previous=>[...registered.items,...previous]);
      setPurchaseHistory(previous=>[...registered.history,...previous]);
    },[]);

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
      const stored=feedbackStore.state().records[itemId];
      if (stored) feedbackStore.hide(stored.item);
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
      savePersonalExpiry,
      refreshPersonalExpiry,
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
      savePersonalExpiry,
      refreshPersonalExpiry,
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
