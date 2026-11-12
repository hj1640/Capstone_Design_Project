// D-052: inspect Expo's real generated registration, not merely installed packages.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const cli=path.join(path.dirname(require.resolve('expo-modules-autolinking/package.json')),'bin/expo-modules-autolinking.js');
const config=JSON.parse(execFileSync(process.execPath,[cli,'react-native-config','--platform','android','--json'],
  {encoding:'utf8',maxBuffer:8*1024*1024}));
for(const [name,instance] of [
  ['onnxruntime-react-native','new OnnxruntimePackage()'],
  ['@react-native-ml-kit/text-recognition','new TextRecognitionPackage()'],
]) {
  const android=config.dependencies[name]?.platforms?.android;
  assert.ok(android,`${name}: Android native module registration missing`);
  assert.equal(android.packageInstance,instance,`${name}: unexpected native package registration`);
}
console.log('PASS: Expo Android autolinking registers ONNX and ML Kit; physical runtime still needs device testing');
