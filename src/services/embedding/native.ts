import { Asset } from 'expo-asset';
import { Tokenizer } from '@huggingface/tokenizers';
import { encode, pool } from './core';

async function load() {
  const ort = await import('onnxruntime-react-native');
  const tokenizer = new Tokenizer(require('../../../assets/models/tokenizer.json'), require('../../../assets/models/tokenizer_config.json'));
  // Metro needs a static asset require to include the ONNX file in the native bundle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const asset = Asset.fromModule(require('../../../assets/models/model_local_int8.onnx'));
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('Local INT8 asset missing; run stage5 preparation');
  const session = await ort.InferenceSession.create(asset.localUri,{intraOpNumThreads:2, interOpNumThreads:1});
  return { embed: async (query: string): Promise<number[]> => {
    const tokens = encode(tokenizer,query);
    const feeds: Record<string, InstanceType<typeof ort.Tensor>> = {};
    for (const name of session.inputNames) {
      if (!(name in tokens)) throw new Error('Unexpected model input');
      const values = tokens[name as keyof typeof tokens];
      feeds[name] = new ort.Tensor('int64',BigInt64Array.from(values.map(BigInt)),[1,values.length]);
    }
    const outputs = await session.run(feeds);
    const output = outputs[session.outputNames[0]];
    if (output.type !== 'float32') throw new Error('Unexpected output dtype');
    return pool(output.data as Float32Array,output.dims,tokens.attention_mask);
  }, release: ()=>session.release() };
}

let runtime: ReturnType<typeof load> | undefined;
let queue: Promise<unknown> = Promise.resolve();
export function embedNative(query: string): Promise<number[]> {
  const run = queue.then(async () => {
    if (!runtime) runtime = load().catch(error=>{ runtime=undefined; throw error; });
    return (await runtime).embed(query);
  });
  queue = run.catch(()=>undefined);
  return run;
}

export function closeNative(): Promise<void> {
  const close=queue.then(async()=>{
    const current=runtime;
    runtime=undefined;
    if (current) await (await current).release();
  });
  queue=close.catch(()=>undefined);
  return close;
}
