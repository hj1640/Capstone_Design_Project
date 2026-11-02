"""D-043: synthetic tokenizer/vector parity reference, not accuracy evaluation."""
import argparse, hashlib, json, platform, time
from pathlib import Path
import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

root = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser()
p.add_argument('--model-dir', type=Path, default=root/'assets/models')
args = p.parse_args()
manifest = json.loads((root/'models/manifest.json').read_text())
for entry in manifest['files']:
    if entry['path'] == 'config.json': continue
    f = args.model_dir/Path(entry['path']).name
    if hashlib.sha256(f.read_bytes()).hexdigest() != entry['sha256']:
        raise ValueError(f'Hash mismatch: {f.name}')
ort.disable_telemetry_events()
options = ort.SessionOptions()
options.intra_op_num_threads = 2
start = time.perf_counter()
session = ort.InferenceSession(str(args.model_dir/'model_int8.onnx'), options, providers=['CPUExecutionProvider'])
load_ms = (time.perf_counter()-start)*1000
tokenizer = Tokenizer.from_file(str(args.model_dir/'tokenizer.json'))
tokenizer.enable_truncation(max_length=128)
texts = ['우유', '서울우유 1L', '간편한 국내산 제주', '찌개용 두부 300g', '냉동 딸기 1kg', '  당근\n2개 ', '치즈🧀', '가나다 '*150]
rows = []
for text in texts:
    encoded = tokenizer.encode(text)
    inputs = {'input_ids': encoded.ids, 'attention_mask': encoded.attention_mask, 'token_type_ids': encoded.type_ids}
    feeds = {x.name: np.array([inputs[x.name]], dtype=np.int64) for x in session.get_inputs()}
    times = []
    for i in range(4):
        start = time.perf_counter()
        hidden = session.run(None, feeds)[0]
        mask = np.array(encoded.attention_mask)[None,:,None]
        vector = (hidden*mask).sum(1)/mask.sum(1)
        vector /= np.linalg.norm(vector, axis=1, keepdims=True)
        if i: times.append((time.perf_counter()-start)*1000)
    assert vector.shape == (1,384) and np.isfinite(vector).all()
    rows.append(dict(text=text, **inputs, vector=vector[0].tolist(), warm_ms=times))
report = dict(dataset='8 synthetic cases; no classification accuracy claim', model=manifest,
              platform=platform.platform(), processor=platform.processor(), python=platform.python_version(),
              onnxruntime=ort.__version__, threads=2, warmup=1, repeats=3, load_ms=load_ms, rows=rows)
(root/'benchmarks/reference.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(cases=len(rows),dimension=384,load_ms=load_ms,all_finite=True)))
