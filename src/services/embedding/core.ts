import { Tokenizer } from '@huggingface/tokenizers';

// D-043 experiment: single sequence, 128 tokens including <s> and </s>.
export function encode(tokenizer: Tokenizer, text: string) {
  const raw = tokenizer.encode(text, { add_special_tokens: false }).ids;
  const bos = tokenizer.token_to_id('<s>');
  const eos = tokenizer.token_to_id('</s>');
  if (bos === undefined || eos === undefined) throw new Error('Unsupported tokenizer');
  const input_ids = [bos, ...raw.slice(0, 126), eos];
  return { input_ids, attention_mask: input_ids.map(() => 1), token_type_ids: input_ids.map(() => 0) };
}

export function pool(data: ArrayLike<number>, dims: readonly number[], mask: number[]) {
  if (dims.length !== 3 || dims[0] !== 1 || dims[1] !== mask.length || dims[2] !== 384)
    throw new Error(`Unexpected output shape: ${dims}`);
  if (data.length !== mask.length * 384) throw new Error('Invalid tensor length');
  const vector = new Array<number>(384).fill(0);
  const count = mask.reduce((a, b) => a + b, 0);
  if (!count) throw new Error('Empty attention mask');
  for (let t = 0; t < mask.length; t++)
    for (let d = 0; d < 384; d++) vector[d] += data[t * 384 + d] * mask[t] / count;
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (!Number.isFinite(norm) || norm === 0) throw new Error('Invalid embedding');
  return vector.map(v => v / norm);
}
