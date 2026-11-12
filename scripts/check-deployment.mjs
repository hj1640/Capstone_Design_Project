import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {deployment} from '../config/deployment.cjs';
try {
  const values=deployment(process.env,true);
  if(values.apiUrl){
    const response=await fetch(`${values.apiUrl.replace(/\/$/,'')}/healthz`,{signal:AbortSignal.timeout(10000)});
    const body=await response.json();
    if(!response.ok || body.api!=='personal-v1' || body.mode!=='service' || body.status!=='ok')
      throw new Error('실제 개인 평균 서버의 상태 응답이 아닙니다');
  } else {
    console.log('LOCAL PREVIEW: 서버 미설정. 구매·날짜는 기기에 보관하며 서버 평균 갱신은 연결 후 가능합니다.');
  }
  const missing=['model_int8.onnx','model_local_int8.onnx','tokenizer.json','tokenizer_config.json']
    .filter(name=>!fs.existsSync(new URL('../assets/models/'+name,import.meta.url)));
  if(missing.length) throw new Error('빌드에 필요한 모델 준비 누락: '+missing.join(', '));
  const manifest=JSON.parse(fs.readFileSync(new URL('../models/manifest.json',import.meta.url),'utf8'));
  const local=JSON.parse(fs.readFileSync(new URL('../models/stage5-quantization.json',import.meta.url),'utf8')).output;
  const files=[...manifest.files.map(entry=>({name:entry.path.split('/').at(-1),sha:entry.sha256})),{name:local.path,sha:local.sha256}];
  for(const file of files){
    const bytes=fs.readFileSync(new URL('../assets/models/'+file.name,import.meta.url));
    if(crypto.createHash('sha256').update(bytes).digest('hex')!==file.sha) throw new Error('모델 SHA-256 불일치: '+file.name);
  }
  console.log('PASS: 앱 식별자 형식, 빌드 모드에 필요한 설정, 모델 SHA-256 확인');
  execFileSync(process.execPath,[fileURLToPath(new URL('./check-native-linking.mjs',import.meta.url))],{stdio:'inherit'});
  console.log('eas project:info에서 실제 새 프로젝트 소유 계정과 projectId를 확인해야 합니다.');
} catch(error) {console.error(String(error));process.exitCode=1;}
