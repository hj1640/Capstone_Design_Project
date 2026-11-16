import * as ort from 'onnxruntime-react-native';
import { Asset } from 'expo-asset';
import { tokenize } from './wordpieceTokenizer';

// ko-sroberta-multitask (jhgan) INT8 ONNX 모델로 문장 임베딩(768차원)을 만든다.
// 모델/토크나이저는 assets/models/ko-sroberta/ 아래에 둔다.
// (다른 모델과 파일 이름이 겹치지 않도록 모델 이름으로 폴더를 나눔)

let sessionPromise: Promise<ort.InferenceSession> | null = null;

// 모델 로드는 한 번만. require()는 에셋 번호(number)를 돌려주기 때문에
// 그대로 InferenceSession.create에 넘기면 안 되고, expo-asset으로 실제 파일 경로(localUri)를 얻어야 한다.
function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const asset = Asset.fromModule(require('../../../assets/models/ko-sroberta/model_int8.onnx'));
      await asset.downloadAsync();
      if (!asset.localUri) throw new Error('ko-sroberta 모델 파일을 찾을 수 없습니다');
      return ort.InferenceSession.create(asset.localUri);
    })().catch((error) => {
      sessionPromise = null; // 실패하면 다음 호출 때 다시 시도
      throw error;
    });
  }
  return sessionPromise;
}

export async function initEmbedder(): Promise<void> {
  await getSession();
}

// 추론은 한 번에 하나씩만 실행되도록 줄을 세운다 (영수증 여러 줄이 동시에 들어와도 안전).
let queue: Promise<unknown> = Promise.resolve();

export function embed(text: string): Promise<number[]> {
  const run = queue.then(() => embedNow(text));
  queue = run.catch(() => undefined);
  return run;
}

async function embedNow(text: string): Promise<number[]> {
  const session = await getSession();
  const inputIds = tokenize(text);
  const seqLen = inputIds.length;
  // 패딩 없이 한 문장만 넣으므로 attention_mask는 전부 1, token_type_ids는 전부 0
  const toTensor = (values: number[]) =>
    new ort.Tensor('int64', BigInt64Array.from(values.map(BigInt)), [1, seqLen]);
  const allFeeds: Record<string, ort.Tensor> = {
    input_ids: toTensor(inputIds),
    attention_mask: toTensor(new Array(seqLen).fill(1)),
    token_type_ids: toTensor(new Array(seqLen).fill(0)),
  };
  const feeds: Record<string, ort.Tensor> = {};
  for (const name of session.inputNames) feeds[name] = allFeeds[name];

  const results = await session.run(feeds);
  const output = results[session.outputNames[0]];
  const data = output.data as Float32Array; // [1, seqLen, 768]
  const hiddenSize = output.dims[2];
  return l2Normalize(meanPool(data, seqLen, hiddenSize));
}

// 토큰별 벡터 평균 → 문장 벡터 1개 (패딩이 없으므로 seqLen으로 나누면 됨)
function meanPool(data: Float32Array, seqLen: number, hiddenSize: number): number[] {
  const result = new Array(hiddenSize).fill(0);
  for (let t = 0; t < seqLen; t++) {
    for (let h = 0; h < hiddenSize; h++) result[h] += data[t * hiddenSize + h];
  }
  return result.map((v) => v / seqLen);
}

// 길이를 1로 맞춘다 → 이후 내적(dot)이 곧 코사인 유사도
function l2Normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return norm === 0 ? vector : vector.map((v) => v / norm);
}
