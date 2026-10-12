import { NativeModules, Platform } from 'react-native';
import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { OcrEngine, RawOcrResult } from './types';

// 과제계획서 "나. 영수증 인식 및 전처리" 항목의 실제 구현체.
// Google ML Kit Text Recognition v2의 한국어 모델로 카메라/갤러리 이미지에서
// 텍스트 블록과 줄을 추출한다.
//
// ⚠️ 네이티브 모듈이라 Expo Go에서는 동작하지 않는다.
//    `npx expo prebuild` 후 `npx expo run:android` / `npx expo run:ios`,
//    또는 EAS 개발 빌드(`eas build --profile development`)에서만 테스트할 수 있다.
//    자세한 빌드 방법은 README.md의 "실기기 OCR 테스트 방법" 참고.
export const mlkitOcrEngine: OcrEngine = {
  name: 'google-ml-kit',

  isAvailable() {
    // 웹이거나(react-native-web) 네이티브 모듈이 링크되지 않은 환경(Expo Go 등)에서는
    // NativeModules.TextRecognition이 없으므로 false를 반환해 모의 엔진으로 자연스럽게 전환한다.
    return Platform.OS !== 'web' && !!NativeModules.TextRecognition;
  },

  async recognize(imageUri: string): Promise<RawOcrResult> {
    const result = await TextRecognition.recognize(imageUri, TextRecognitionScript.KOREAN);
    // 블록 순서를 유지한 채 줄 단위로 평탄화 → 영수증 한 줄 = 품목 후보 하나로 다루기 위함
    const lines = result.blocks.flatMap((block) => block.lines.map((line) => line.text));
    return { rawText: result.text, lines };
  },
};
