import fs from 'node:fs';
import crypto from 'node:crypto';
import {deployment} from '../config/deployment.cjs';
try {
  const values=deployment(process.env,true);
  const response=await fetch(`${values.apiUrl.replace(/\/$/,'')}/healthz`,{signal:AbortSignal.timeout(10000)});
  const body=await response.json();
  if(!response.ok || body.api!=='personal-v1' || body.mode!=='service' || body.status!=='ok')
    throw new Error('실제 개인 평균 서버의 상태 응답이 아닙니다');
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
  console.log('PASS: 기존 앱 식별자 형식, HTTPS 서버 상태, 필요한 모델 파일 확인');
  console.log('별도로 eas project:info에서 hj1640/fridge-app의 실제 projectId와 일치하는지 확인해야 합니다.');
} catch(error) {console.error(String(error));process.exitCode=1;}
