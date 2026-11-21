import type { FoodCategory, FoodDbEntry, StorageType } from '../types/food';

// 사용자가 직접 입력한 식품을 기기에 쌓아 두는 "내 식품 DB".
// - 영수증 등록 때 DB에 없던 식품명을 확인하면 이름이 추가되어 다음 인식부터 매칭 후보가 된다.
// - 품목 상세에서 포장지 날짜를 입력하면 (포장지 날짜 − 구매일)을 보관 방법별로 평균 내어 기억하고,
//   다음에 같은 식품을 등록하면 그 일수로 소비기한을 자동으로 채운다.

type KnownStorage = Exclude<StorageType, '미정'>;

export interface LearnedFood {
  name: string;
  category: FoodCategory;
  storage: StorageType; // 마지막으로 고른 보관 방법
  shelfLife: Partial<Record<KnownStorage, { days: number; samples: number }>>;
  updatedAt: string;
}

export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'user-foods-v1';
const normalize = (name: string) => name.normalize('NFKC').trim();

export function createUserFoodStore(kv: KeyValue, now: () => string = () => new Date().toISOString()) {
  const read = (): Record<string, LearnedFood> => {
    const raw = kv.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  };
  const write = (foods: Record<string, LearnedFood>) => kv.setItem(KEY, JSON.stringify(foods));
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((listener) => listener());

  return {
    list(): LearnedFood[] {
      return Object.values(read());
    },
    get(name: string): LearnedFood | undefined {
      return read()[normalize(name)];
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    // 이름만 기억 (영수증 등록 때 DB에 없던 식품)
    rememberName(name: string, category: FoodCategory) {
      const key = normalize(name);
      if (!key) return;
      const foods = read();
      if (foods[key]) return;
      foods[key] = { name: key, category, storage: '미정', shelfLife: {}, updatedAt: now() };
      write(foods);
      changed();
    },
    // 보관 방법만 기억
    rememberStorage(name: string, category: FoodCategory, storage: StorageType) {
      const key = normalize(name);
      if (!key) return;
      const foods = read();
      const food = foods[key] ?? { name: key, category, storage, shelfLife: {}, updatedAt: now() };
      foods[key] = { ...food, storage, updatedAt: now() };
      write(foods);
      changed();
    },
    // 포장지 날짜까지의 일수를 보관 방법별 평균으로 기억
    learnShelfLife(name: string, category: FoodCategory, storage: StorageType, days: number) {
      const key = normalize(name);
      if (!key || !Number.isFinite(days) || days < 0) return;
      const foods = read();
      const food = foods[key] ?? { name: key, category, storage, shelfLife: {}, updatedAt: now() };
      const shelfLife = { ...food.shelfLife };
      if (storage !== '미정') {
        const previous = shelfLife[storage];
        const samples = (previous?.samples ?? 0) + 1;
        const mean = previous ? previous.days + (days - previous.days) / samples : days;
        shelfLife[storage] = { days: Math.round(mean), samples };
      }
      foods[key] = { ...food, storage, shelfLife, updatedAt: now() };
      write(foods);
      changed();
    },
    // 새로 등록할 때 쓸 기본값 (마지막 보관 방법 + 그 보관 방법의 평균 일수)
    defaultsFor(name: string): { storage?: StorageType; days?: number } {
      const food = read()[normalize(name)];
      if (!food) return {};
      const days = food.storage !== '미정' ? food.shelfLife[food.storage]?.days : undefined;
      return { storage: food.storage === '미정' ? undefined : food.storage, days };
    },
  };
}

// 매칭기에서 기본 식품 DB와 같은 형태로 쓰기 위한 변환
export function toFoodDbEntry(food: LearnedFood): FoodDbEntry {
  const storage = food.storage === '미정' ? undefined : food.storage;
  return {
    standardName: food.name,
    synonyms: [],
    category: food.category,
    defaultStorage: food.storage,
    shelfLifeUnopenedDays: (storage && food.shelfLife[storage]?.days) ?? 0,
    shelfLifeOpenedDays: 0,
    unit: '개',
    icon: '🛒',
    nutrition: { calories: 0, protein: 0, fat: 0, carbs: 0 },
    consumptionPattern: '비주기형',
  };
}
