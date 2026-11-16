// Metro(번들러)에게 ".onnx" 파일도 이미지/폰트처럼 "에셋 파일"로 취급하라고 알려주는 설정.
// 이게 없으면 embedder.ts의 require('.../model_int8.onnx')가 번들링 단계에서 깨져요.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('onnx');

module.exports = config;
