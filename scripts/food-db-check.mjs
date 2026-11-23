import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { foodDatabase } from '../src/data/foodDatabase.ts';

const contract = JSON.parse(readFileSync(new URL('../docs/project-contract.json', import.meta.url), 'utf8'));
assert.equal(foodDatabase.length, 120, '식품 수가 바뀌면 매칭 목록 변경을 별도로 검토해야 합니다.');
assert.equal(new Set(foodDatabase.map(food => food.standardName)).size, foodDatabase.length, '표준명 중복');
for (const food of foodDatabase) {
  assert.ok(['냉장', '냉동', '실온'].includes(food.defaultStorage), `${food.standardName}: 보관방법 미정`);
  assert.ok(Number.isInteger(food.shelfLifeUnopenedDays) && food.shelfLifeUnopenedDays > 0,
    `${food.standardName}: 미개봉 일수 누락/오류`);
  assert.ok(Number.isInteger(food.shelfLifeOpenedDays) && food.shelfLifeOpenedDays > 0,
    `${food.standardName}: 개봉 후 일수 누락/오류`);
  assert.ok(food.shelfLifeOpenedDays <= food.shelfLifeUnopenedDays, `${food.standardName}: 개봉 후 일수 역전`);
}
assert.equal(contract.foodDatabaseDemo.decision, 'D-053');
assert.equal(contract.foodDatabaseDemo.approximateItemsFilled, 104);
assert.equal(contract.foodDatabaseDemo.feedsPersonalStatistics, false);
assert.equal(contract.foodDatabaseDemo.automaticallyAppliedAtRegistration, false);
console.log('PASS: 120 unique foods; positive integer shelf lives; storage and D-053 contract checked.');
