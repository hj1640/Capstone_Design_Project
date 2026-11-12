// Dependency-free, read-only inventory. This is not an OCR/model/device test.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const exists = (name) => fs.existsSync(path.join(root, name));
const hash = (name) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
const pkg = JSON.parse(read('package.json'));
const app = JSON.parse(read('app.json')).expo;
const contract = JSON.parse(read('docs/project-contract.json'));
assert.deepEqual(contract.scope.inputKinds.value, ['paper', 'coupang'], 'D-050');
assert.equal(contract.scope.hardwareRequired.value, false, 'D-001');
assert.equal(contract.scope.showEstimatedRemainingAmount.value, false, 'D-007');
for (const [key, value] of Object.entries(contract.unresolved)) {
  if (key === 'feedbackDurationMeaning') {
    assert.equal(value, 'package_label_expiry_minus_purchase_date', 'D-050');
    continue;
  }
  assert.equal(value, null, `Unapproved policy value: ${key}`);
}
let head = null;
let tracked = [];
try {
  head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
} catch {
  // A source ZIP can still be inspected; absence of Git metadata stays explicit.
}
const foodCount = (read('src/data/foodDatabase.ts').match(/^\s*standardName:/gm) ?? []).length;
const report = {
  schemaVersion: 1,
  contractCheck: 'passed; checks the documented policy, not current UI compliance',
  inspectedAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  sourceCommit: head,
  sourceInventoryAvailable: tracked.length > 0,
  pnpmLockSha256: hash('pnpm-lock.yaml'),
  dependencies: pkg.dependencies,
  foodEntryCount: foodCount,
  eas: {
    configPresent: exists('eas.json'),
    projectIdPresent: Boolean(app.extra?.eas?.projectId),
    ownerPresent: Boolean(app.owner),
    androidPackagePresent: Boolean(app.android?.package),
  },
  trackedResearchFiles: tracked.filter((f) => /\.(py|onnx|npy|xlsx)$/i.test(f)),
  trackedTestFiles: tracked.filter((f) => /(^|\/)(__tests__|tests?)\/|\.(test|spec)\.[cm]?[jt]sx?$/.test(f)),
  limits: ['Inventory only; absence applies to tracked files, not teammates computers.',
    'Does not verify Expo build provenance, OCR, mobile execution, food durations or model accuracy.'],
};
console.log(JSON.stringify(report, null, 2));
