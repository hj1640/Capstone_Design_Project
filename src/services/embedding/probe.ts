import { Asset } from 'expo-asset';
import { Tokenizer } from '@huggingface/tokenizers';
import { encode, pool } from './core';
import reference from '../../../benchmarks/reference.json';

export async function runProbe() {
  // Lazy native import: errors are reported on the developer screen.
  const ort = await import('onnxruntime-react-native');
  const tokenizerStart = performance.now();
  const tokenizer = new Tokenizer(require('../../../assets/models/tokenizer.json'), require('../../../assets/models/tokenizer_config.json'));
  const tokenizerLoadMs = performance.now() - tokenizerStart;
  const asset = Asset.fromModule(require('../../../assets/models/model_int8.onnx'));
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('Model asset unavailable');
  const start = performance.now();
  const session = await ort.InferenceSession.create(asset.localUri, { intraOpNumThreads: 2 });
  const modelLoadMs = performance.now() - start;
  try {
    const rows = [];
    for (const expected of reference.rows) {
      const tokenStart = performance.now();
      const tokens = encode(tokenizer, expected.text);
      const tokenizationMs = performance.now() - tokenStart;
      for (const key of ['input_ids', 'attention_mask', 'token_type_ids'] as const)
        if (JSON.stringify(tokens[key]) !== JSON.stringify(expected[key])) throw new Error(`Tokenizer mismatch: ${key}`);
      const feeds: Record<string, InstanceType<typeof ort.Tensor>> = {};
      for (const name of session.inputNames) {
        if (!(name in tokens)) throw new Error(`Unsupported input: ${name}`);
        const values = tokens[name as keyof typeof tokens];
        feeds[name] = new ort.Tensor('int64', BigInt64Array.from(values.map(BigInt)), [1, values.length]);
      }
      const warmMs = [];
      let vector: number[] = [];
      for (let i = 0; i < 4; i++) {
        const begin = performance.now();
        const outputs = await session.run(feeds);
        const output = outputs[session.outputNames[0]];
        if (output.type !== 'float32') throw new Error(`Unsupported output: ${output.type}`);
        vector = pool(output.data as Float32Array, output.dims, tokens.attention_mask);
        if (i) warmMs.push(performance.now() - begin);
      }
      rows.push({ tokenCount: tokens.input_ids.length, tokenizationMs, warmMs,
        dimension: vector.length, cosineToPython: vector.reduce((s,v,i)=>s+v*expected.vector[i],0),
        maxAbsoluteError: Math.max(...vector.map((v,i)=>Math.abs(v-expected.vector[i]))) });
    }
    return { modelRevision: reference.model.revision, tokenizerLoadMs, modelLoadMs,
      warmup: 1, repeats: 3, threads: 2, peakMemoryBytes: null,
      memoryNote: 'Measure process peak/PSS externally; device total RAM is not app memory.', rows };
  } finally { await session.release(); }
}
