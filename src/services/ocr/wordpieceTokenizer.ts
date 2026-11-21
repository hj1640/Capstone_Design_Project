// ko-sroberta-multitask가 쓰는 WordPiece 토크나이저를
// 허깅페이스 파이썬 라이브러리 없이, TypeScript로 직접 구현한 버전입니다.
//
// assets/models/ko-sroberta/tokenizer.json 안에 모델이 아는 "단어조각 사전"(vocab, 32000개)과
// 토크나이저 설정이 그대로 들어있어서, 그 파일만 읽으면 돼요.
// (onnx_model/tokenizer_config.json 기준: do_lower_case=false, strip_accents=null
//  이라서 소문자 변환이나 억양기호 제거는 이 모델에서는 안 함)

import tokenizerConfig from '../../../assets/models/ko-sroberta/tokenizer.json';

type TokenizerJson = {
  model: {
    vocab: Record<string, number>;
    continuing_subword_prefix: string; // "##"
    unk_token: string; // "[UNK]"
    max_input_chars_per_word: number; // 100
  };
};

const config = tokenizerConfig as unknown as TokenizerJson;

// 토큰 문자열 -> 번호(id) 사전. 예: VOCAB['두부'] === 10813
const VOCAB: Record<string, number> = config.model.vocab;
const UNK_TOKEN = config.model.unk_token; // "[UNK]"
const CONTINUING_PREFIX = config.model.continuing_subword_prefix; // "##"
const MAX_CHARS_PER_WORD = config.model.max_input_chars_per_word; // 100

// 특수 토큰 번호도 숫자를 외워서 적는 게 아니라, 사전에서 바로 찾아서 씁니다.
// (이전 embedder.ts의 "CLS=2, SEP=3, UNK=1"이 틀렸던 이유가, 숫자를 손으로 적어뒀기 때문이에요)
export const CLS_ID = VOCAB['[CLS]'];
export const SEP_ID = VOCAB['[SEP]'];
export const PAD_ID = VOCAB['[PAD]'];
const UNK_ID = VOCAB[UNK_TOKEN];

// --- 1단계: BertPreTokenizer 역할 ---
// 문장을 공백 기준으로 자르고, 문장부호(. , ! ? 등)는 단어에서 따로 떼어냅니다.
// 예: "촌두부!찌개용" -> ["촌두부", "!", "찌개용"]
function isAsciiPunctuation(ch: string): boolean {
  const code = ch.codePointAt(0)!;
  return (
    (code >= 33 && code <= 47) || // ! " # $ % & ' ( ) * + , - . /
    (code >= 58 && code <= 64) || // : ; < = > ? @
    (code >= 91 && code <= 96) || // [ \ ] ^ _ `
    (code >= 123 && code <= 126) // { | } ~
  );
}

function basicSplit(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();

  const withPuncSpaced = Array.from(cleaned)
    .map((ch) => (isAsciiPunctuation(ch) ? ` ${ch} ` : ch))
    .join('');

  return withPuncSpaced.split(/\s+/).filter((w) => w.length > 0);
}

// --- 2단계: WordPiece 그리디 최장일치 ---
// 단어 하나를 받아서, 사전에 있는 "가장 긴 조각"부터 떼어내는 걸 반복합니다.
// 예: "찌개용"이 사전에 없으면 -> "찌개" + "##용" 식으로 쪼개질 수 있음
// ("##"이 붙은 조각은 "앞 조각에 이어붙는다"는 표시)
function wordPieceOneWord(word: string): string[] {
  const chars = Array.from(word); // 이모지 등 포함해서 글자 단위로 안전하게 분리
  if (chars.length > MAX_CHARS_PER_WORD) return [UNK_TOKEN];

  const subTokens: string[] = [];
  let start = 0;

  while (start < chars.length) {
    let end = chars.length;
    let matched: string | null = null;

    // 뒤에서부터 한 글자씩 줄여가며 사전에 있는 가장 긴 조각을 찾는다
    while (start < end) {
      let substr = chars.slice(start, end).join('');
      if (start > 0) substr = CONTINUING_PREFIX + substr;
      if (Object.prototype.hasOwnProperty.call(VOCAB, substr)) {
        matched = substr;
        break;
      }
      end -= 1;
    }

    if (matched === null) {
      // 이 단어는 사전 조각으로 전혀 못 쪼갠다 -> 단어 전체를 [UNK] 처리
      return [UNK_TOKEN];
    }

    subTokens.push(matched);
    start = end;
  }

  return subTokens;
}

// --- 3단계: 전체 파이프라인 ---
// 문장 -> [CLS, 토큰id..., SEP] 형태의 숫자 배열
export function tokenize(text: string, maxLen = 128): number[] {
  const words = basicSplit(text);
  const ids: number[] = [CLS_ID];

  for (const word of words) {
    const pieces = wordPieceOneWord(word);
    for (const piece of pieces) {
      ids.push(VOCAB[piece] ?? UNK_ID);
    }
  }

  ids.push(SEP_ID);

  // 너무 길면 뒤를 잘라내되, 마지막은 항상 [SEP]로 끝나게 한다
  if (ids.length > maxLen) {
    return [...ids.slice(0, maxLen - 1), SEP_ID];
  }
  return ids;
}
