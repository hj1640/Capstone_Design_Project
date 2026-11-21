import type { FoodItem, OcrCandidate, PurchaseHistoryEntry, StorageType } from '../types/food';
import { validDate } from './feedback/store.ts';

export type RegistrationDefaults = (name: string)=>{storage?: StorageType; days?: number};

function addDaysIso(date: string,days: number): string {
  const d=new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10);
}

// 구매일은 반드시 확인받는다. 보관 방법·소비기한은 사용자가 예전에 같은 식품에 입력한 값(내 식품 DB)이
// 있을 때만 자동으로 채운다 (예시 DB의 보관일수로 추측하지 않음).
export function buildRegistration(candidates: OcrCandidate[],source: FoodItem['source'],purchaseDate: string,
  id: ()=>string,defaults?: RegistrationDefaults): {items:FoodItem[]; history:PurchaseHistoryEntry[]} {
  if (!validDate(purchaseDate)) throw new Error('실제 구매일을 YYYY-MM-DD 형식으로 확인해 주세요');
  const selected=candidates.filter(c=>c.status!=='rejected');
  if (!selected.length || selected.some(c=>c.status!=='confirmed' || !c.guessedName.trim() || c.guessedName.normalize('NFKC').trim().length>200 ||
      !Number.isFinite(c.quantity) || c.quantity<=0)) throw new Error('품목명과 수량을 확인해 주세요');
  return {items:selected.map(c=>{
    const learned=defaults?.(c.guessedName.trim()) ?? {};
    return {id:id(),standardName:c.guessedName.trim(),category:c.category,
    storageType:learned.storage ?? '미정',icon:'🛒',purchaseDate,
    expectedExpiryDate:learned.days!==undefined ? addDaysIso(purchaseDate,learned.days) : null,isOpened:false,
    totalQuantity:c.quantity,remainingQuantity:c.quantity,unit:c.unit,consumptionPattern:'비주기형',
    nutrition:{calories:0,protein:0,fat:0,carbs:0},nutritionVerified:false,source} satisfies FoodItem;}),
    history:selected.map(c=>({id:id(),standardName:c.guessedName.trim(),category:c.category,date:purchaseDate,
      quantity:c.quantity,unit:c.unit,source}))};
}
