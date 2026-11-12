import assert from 'node:assert/strict';
import fs from 'node:fs';
import {deployment} from '../config/deployment.cjs';
import configure from '../app.config.js';
const identity={FRIDGE_EXPO_OWNER:'synthetic-owner',FRIDGE_EAS_PROJECT_ID:'12345678-1234-1234-1234-123456789abc',
  FRIDGE_ANDROID_PACKAGE:'com.synthetic.fridge.personal'};
assert.throws(()=>deployment({...identity,EAS_BUILD_PROFILE:'preview'},true),/HTTPS/);
assert.throws(()=>deployment({...identity,EAS_BUILD_PROFILE:'production'},true),/HTTPS/);
assert.equal(deployment({...identity,EAS_BUILD_PROFILE:'preview-local'},true).localPreview,true);
for(const apiUrl of ['http://127.0.0.1','https://example.com','https://user:secret@synthetic.test','https://synthetic.test/path'])
  assert.throws(()=>deployment({...identity,EAS_BUILD_PROFILE:'preview-local',EXPO_PUBLIC_API_URL:apiUrl},true),/HTTPS/);
assert.equal(deployment({...identity,EXPO_PUBLIC_API_URL:'https://synthetic.test'},true).problems.length,0);
const original={...process.env};
try {
  Object.assign(process.env,identity,{EAS_BUILD_PROFILE:'preview-local'});
  delete process.env.EXPO_PUBLIC_API_URL;
  const config=configure({config:JSON.parse(fs.readFileSync(new URL('../app.json',import.meta.url),'utf8')).expo});
  assert.equal(config.slug,'fridge-app-personal');
  assert.equal(config.scheme,'fridgepersonal');
  assert.equal(config.owner,'synthetic-owner');
  assert.equal(config.extra.eas.projectId,identity.FRIDGE_EAS_PROJECT_ID);
  assert.equal(config.android.package,identity.FRIDGE_ANDROID_PACKAGE);
  assert.notEqual(config.owner,'hj1640');
} finally {
  for(const key of Object.keys(process.env)) if(!(key in original)) delete process.env[key];
  Object.assign(process.env,original);
}
const profiles=JSON.parse(fs.readFileSync(new URL('../eas.json',import.meta.url),'utf8')).build;
assert.equal(profiles['preview-local'].extends,'preview');
assert.equal(profiles.preview.developmentClient,false);
assert.equal(profiles.preview.android.buildType,'apk');
console.log('PASS: separate project identity; local APK without server; connected builds require HTTPS; supplied bad URLs rejected');
