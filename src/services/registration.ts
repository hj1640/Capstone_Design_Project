import type { FoodItem, OcrCandidate, PurchaseHistoryEntry } from '../types/food';
import { validDate } from './feedback/store.ts';

// D-049: no implicit purchase date, duration fallback, or package-unit conversion.
export function buildRegistration(candidates: OcrCandidate[],source: FoodItem['source'],purchaseDate: string,
  id: ()=>string): {items:FoodItem[]; history:PurchaseHistoryEntry[]} {
  if (!validDate(purchaseDate)) throw new Error('실제 구매일을 YYYY-MM-DD 형식으로 확인해 주세요');
  const selected=candidates.filter(c=>c.status!=='rejected');
  if (!selected.length || selected.some(c=>c.status!=='confirmed' || !c.guessedName.trim() || c.guessedName.normalize('NFKC').trim().length>200 ||
      !Number.isFinite(c.quantity) || c.quantity<=0)) throw new Error('품목명과 수량을 확인해 주세요');
  return {items:selected.map(c=>({id:id(),standardName:c.guessedName.trim(),category:c.category,
    storageType:'미정',icon:'🛒',purchaseDate,expectedExpiryDate:null,isOpened:false,
    totalQuantity:c.quantity,remainingQuantity:c.quantity,unit:c.unit,consumptionPattern:'비주기형',
    nutrition:{calories:0,protein:0,fat:0,carbs:0},nutritionVerified:false,source})),
    history:selected.map(c=>({id:id(),standardName:c.guessedName.trim(),category:c.category,date:purchaseDate,
      quantity:c.quantity,unit:c.unit,source}))};
}
