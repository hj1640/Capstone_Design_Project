// 토크나이저가 제대로 동작하는지 폰 없이 바로 확인하는 스크립트.
// 실행: npx tsx test-tokenizer.ts
import { tokenize } from './src/services/ocr/wordpieceTokenizer';

const tests = [
  '두부',
  '삼겹살 돼지고기 목살 앞다리살',
  '촌두부 찌개용 1개 300g',
  '눈꽃 양배추채',
];

for (const t of tests) {
  console.log(`${t} -> [${tokenize(t).join(', ')}]`);
}
