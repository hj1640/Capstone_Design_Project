import Storage from 'expo-sqlite/kv-store';
import { createUserFoodStore } from './userFoodStore';

// 기기(SQLite)에 저장되는 내 식품 DB
export const userFoods = createUserFoodStore({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
});
