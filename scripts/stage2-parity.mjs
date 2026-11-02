import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Tokenizer } from '@huggingface/tokenizers';
import { encode, pool } from '../src/services/embedding/core.ts';
const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url),'utf8'));
const tokenizer = new Tokenizer(read('../assets/models/tokenizer.json'), read('../assets/models/tokenizer_config.json'));
const reference = read('../benchmarks/reference.json');
for (const row of reference.rows) {
  const actual = encode(tokenizer, row.text);
  for (const key of Object.keys(actual)) assert.deepEqual(actual[key], row[key]);
}
const data = new Float32Array(768); data[0]=3; data[1]=4; data[384]=99;
const vector = pool(data,[1,2,384],[1,0]);
assert.equal(vector[0],0.6); assert.equal(vector[1],0.8);
assert.throws(()=>pool(data,[1,2,384],[0,0]));
assert.throws(()=>pool(data,[1,2,383],[1,1]));
console.log(`PASS: ${reference.rows.length} Python/JS token sequences; masked pooling and invalid-output guards`);
