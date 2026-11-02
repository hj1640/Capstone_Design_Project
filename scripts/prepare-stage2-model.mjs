import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await fs.readFile(new URL('models/manifest.json', root), 'utf8'));
await fs.mkdir(new URL('assets/models/', root), {recursive:true});
for (const entry of manifest.files) {
  const target = new URL(`assets/models/${entry.path.split('/').at(-1)}`, root);
  let data;
  try { data = await fs.readFile(target); } catch {}
  if (!data || crypto.createHash('sha256').update(data).digest('hex') !== entry.sha256) {
    const response = await fetch(`https://huggingface.co/${manifest.repository}/resolve/${manifest.revision}/${entry.path}`);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    data = Buffer.from(await response.arrayBuffer());
    if (crypto.createHash('sha256').update(data).digest('hex') !== entry.sha256) throw new Error(`Hash mismatch: ${entry.path}`);
    await fs.writeFile(target, data);
  }
  console.log(`Verified ${entry.path}: ${data.length} bytes`);
}
