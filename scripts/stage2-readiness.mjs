// D-043: reproducible stage-2 readiness audit; no benchmark claims.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const checks = {
  inferenceRuntimeDeclared: Boolean(pkg.dependencies?.['onnxruntime-react-native']),
  developmentBuildConfigPresent: fs.existsSync(path.join(root, 'eas.json')),
  modelManifestPresent: fs.existsSync(path.join(root, 'models/manifest.json')),
  deviceMeasurementsPresent: fs.existsSync(path.join(root, 'benchmarks/device-results.json')),
};
console.log(JSON.stringify({stage: 2, node: process.version, platform: process.platform,
  architecture: process.arch, expo: pkg.dependencies.expo, checks,
  status: Object.values(checks).every(Boolean) ? 'artifacts_present_requires_review' : 'incomplete',
  note: 'File presence does not validate runtime compatibility or model accuracy.'}, null, 2));
if (process.argv.includes('--require-ready') && !Object.values(checks).every(Boolean)) process.exitCode = 1;
