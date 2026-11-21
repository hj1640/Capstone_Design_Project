import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { FoodItem, MockReceipt, OcrCandidate, PurchaseHistoryEntry, FoodCategory } from '@/types/food';
import type { DiscardEntry } from '@/data/discardLog';
import { buildRegistration } from '@/services/registration';
import { userFoods } from '@/services/userFoods';
import { foodDatabase } from '@/data/foodDatabase';
import { randomUUID } from 'expo-crypto';
import { todayIso } from '@/utils/date';
import { feedbackStore, schedulePersonalSync, setPersonalAppActive } from '@/services/feedback/local';
import type { EditSource } from '@/services/feedback/store';

// Registered purchases and label edits are persisted by the SQLite-backed feedback store.
// Discard-value estimates remain a legacy, in-memory prototype feature.

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
  setRemaining: (itemId: string, remaining: number) => void;
  removeItem: (itemId: string, outcome: 'consumed' | 'discarded') => void;
  savePersonalExpiry: (item: FoodItem, expiry: string | null, source: EditSource | null, personalAverage?: boolean) => void;
  refreshPersonalExpiry: () => void;
  // 영수증 등록 화면에서 생성되고, 인식결과 확인 화면에서 소비되는 임시 세션 데이터.
  // 복잡한 배열 데이터를 라우트 파라미터로 직렬화하는 대신 Context로 전달한다.
  pendingReceipt: MockReceipt | null;
  setPendingReceipt: (receipt: MockReceipt | null) => void;
}

const FridgeContext = createContext<FridgeContextValue | undefined>(undefined);

export function FridgeProvider({ children }: { children: React.ReactNode }) {
  const [fridgeItems, setFridgeItems] = useState<FoodItem[]>(()=>feedbackStore.overlay([]));
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryEntry[]>(
    ()=>feedbackStore.purchaseHistory(),
  );
  const [discardLog, setDiscardLog] = useState<DiscardEntry[]>([]);
  const [pendingReceipt, setPendingReceipt] = useState<MockReceipt | null>(null);
  const refreshPersonalExpiry=useCallback(()=>setFridgeItems(previous=>feedbackStore.overlay(previous)),[]);
  useEffect(()=>{
    setPersonalAppActive(true);
    const listener=AppState.addEventListener('change',state=>setPersonalAppActive(state==='active'));
    return ()=>{listener.remove();setPersonalAppActive(false);};
  },[]);
  const savePersonalExpiry=useCallback((item: FoodItem,expiry: string | null,source: EditSource | null,personalAverage?: boolean)=>{
    feedbackStore.edit(item,expiry,source,personalAverage); // Durable save precedes visible success.
    setFridgeItems(previous=>feedbackStore.overlay(previous));
    setPurchaseHistory(feedbackStore.purchaseHistory());
    schedulePersonalSync();
  },[]);

  const addConfirmedReceiptItems = useCallback(
    (candidates: OcrCandidate[], source: FoodItem['source'], purchaseDate: string) => {
      const registered=buildRegistration(candidates,source,purchaseDate,randomUUID,name=>userFoods.defaultsFor(name));
      // 기본 DB에 없던 식품명은 내 식품 DB에 추가 → 다음 영수증부터 매칭 후보가 된다
      const builtIn=new Set(foodDatabase.map(f=>f.standardName));
      for (const item of registered.items) if (!builtIn.has(item.standardName)) userFoods.rememberName(item.standardName,item.category);
      feedbackStore.remember(registered.items,registered.history);
      setFridgeItems(previous=>[...registered.items,...previous]);
      setPurchaseHistory(previous=>[...registered.history,...previous]);
    },[]);

  // 남은 양 조절: 화면에 바로 반영하고 기기(SQLite)에 저장한다
  const setRemaining = useCallback((itemId: string, remaining: number) => {
    feedbackStore.setRemaining(itemId, remaining);
    setFridgeItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, remainingQuantity: Math.max(0, Math.min(item.totalQuantity, remaining)) }
          : item,
      ),
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
      setRemaining,
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
      setRemaining,
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
