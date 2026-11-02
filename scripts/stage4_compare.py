"""D-045: reproducible synthetic retrieval comparison, no production calibration."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import platform
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def metrics(rows, method):
    known = [r for r in rows if r['kind'] == 'known']
    count = len(known)
    def ratio(hits):
        return hits / count if count else None
    return dict(known_count=count,
        product_top1=ratio(sum(r[method][0]['productId'] in r['expectedProductIds'] for r in known)),
        product_top3=ratio(sum(any(c['productId'] in r['expectedProductIds'] for c in r[method][:3]) for r in known)),
        food_top1=ratio(sum(r[method][0]['foodId'] in r['expectedFoodIds'] for r in known)))


def structural_policy(rows):
    selected = [r for r in rows if r['stage3']['selectedFoodId'] is not None]
    wrong = [r for r in selected if r['stage3']['selectedFoodId'] not in r['expectedFoodIds']]
    return dict(cases=len(rows), food_suggestions=len(selected),
        wrong_food_suggestions=len(wrong),
        wrong_food_suggestion_rate=len(wrong)/len(selected) if selected else None,
        review_requests=sum(r['stage3']['resolution']=='needs_review' for r in rows),
        review_request_rate=sum(r['stage3']['resolution']=='needs_review' for r in rows)/len(rows) if rows else None,
        no_match=sum(r['stage3']['resolution']=='no_match' for r in rows))


def main():
    import numpy as np
    import onnxruntime as ort
    import tokenizers
    from tokenizers import Tokenizer
    parser = argparse.ArgumentParser()
    parser.add_argument('--query', help='Optional ad-hoc query; not added to evaluation')
    args = parser.parse_args()
    input_bytes = (ROOT/'benchmarks/stage4-input.json').read_bytes()
    source = json.loads(input_bytes)
    manifest = json.loads((ROOT/'models/manifest.json').read_text())
    folder = ROOT/'assets/models'
    for entry in manifest['files']:
        target = folder/Path(entry['path']).name
        if sha(target.read_bytes()) != entry['sha256']:
            raise ValueError(f'Hash mismatch: {target.name}')
    ort.disable_telemetry_events()
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    options.inter_op_num_threads = 1
    start = time.perf_counter()
    session = ort.InferenceSession(str(folder/'model_int8.onnx'), options, providers=['CPUExecutionProvider'])
    model_load_ms = (time.perf_counter()-start)*1000
    tokenizer = Tokenizer.from_file(str(folder/'tokenizer.json'))
    tokenizer.enable_truncation(max_length=128)

    def encode(text):
        e = tokenizer.encode(text)
        inputs = {'input_ids':e.ids, 'attention_mask':e.attention_mask, 'token_type_ids':e.type_ids}
        feeds = {x.name:np.array([inputs[x.name]],dtype=np.int64) for x in session.get_inputs()}
        hidden = session.run(None, feeds)[0]
        if hidden.shape != (1,len(e.ids),384):
            raise ValueError(f'Unexpected output: {hidden.shape}')
        mask = np.array(e.attention_mask)[None,:,None]
        vector = (hidden*mask).sum(1)/mask.sum(1)
        norm = np.linalg.norm(vector)
        if not np.isfinite(vector).all() or norm == 0:
            raise ValueError('Invalid vector')
        return (vector/norm)[0].astype(np.float32)

    products = source['catalog']['products']
    identity = dict(model=manifest, catalog=source['catalog'], max_length=128,
        pooling='attention masked mean + L2', onnxruntime=ort.__version__, tokenizers=tokenizers.__version__)
    key = sha(json.dumps(identity,sort_keys=True).encode())
    cache = ROOT/'.stage0-stage4-cache'
    cache.mkdir(exist_ok=True)
    vector_file, meta_file = cache/f'{key}.npy', cache/f'{key}.json'
    cache_hit = False
    start = time.perf_counter()
    if vector_file.exists() and meta_file.exists():
        meta = json.loads(meta_file.read_text())
        if meta.get('sha256') == sha(vector_file.read_bytes()):
            index = np.load(vector_file,allow_pickle=False)
            cache_hit = True
    if not cache_hit:
        index = np.stack([encode(p['searchText'] or p['originalTitle']) for p in products])
        np.save(vector_file,index,allow_pickle=False)
        meta_file.write_text(json.dumps({'key':key,'sha256':sha(vector_file.read_bytes())}),encoding='utf-8')
    if index.shape != (len(products),384) or not np.isfinite(index).all():
        raise ValueError('Invalid cached index')
    index_ms = (time.perf_counter()-start)*1000

    def rank(text):
        scores = index @ encode(text)
        order = sorted(range(len(products)), key=lambda i:(-float(scores[i]),products[i]['productId']))
        return [dict(productId=products[i]['productId'],
            foodId=products[i]['foodId'] if products[i]['mappingStatus']=='reviewed' else None,
            score=float(scores[i]),title=products[i]['originalTitle']) for i in order]

    if args.query is not None:
        if not args.query.strip():
            print(json.dumps(dict(query=args.query, candidates=[], resolution='no_match')))
            return
        print(json.dumps(dict(query=args.query, candidates=rank(args.query)[:3],
            resolution='needs_review', cache_hit=cache_hit, index_key=key,
            note='No calibrated acceptance threshold'),ensure_ascii=False,indent=2))
        return
    for row in source['cases']:
        rank(row['query']) # warmup, separately for each length
        times = []
        for _ in range(3):
            start = time.perf_counter()
            result = rank(row['query'])
            times.append((time.perf_counter()-start)*1000)
        row['minilm'] = result
        row['minilmWarmMs'] = times
    summaries = {}
    for split in ('dev','test'):
        rows = [r for r in source['cases'] if r['split']==split]
        summaries[split] = {method:metrics(rows,method) for method in ('jaccard','minilm')}
        summaries[split]['stage3_structural_policy'] = structural_policy(rows)
        summaries[split]['minilm_policy'] = dict(status='review_all_uncalibrated',
            review_request_rate=1.0 if rows else None, automatic_accepts=0,
            wrong_automatic_accept_rate=None)
        for method in ('jaccard','minilm'):
            times = [t for row in rows for t in row[f'{method}WarmMs']]
            summaries[split][method]['warm_p50_ms'] = float(np.median(times)) if times else None
            summaries[split][method]['warm_p95_ms'] = float(np.percentile(times,95)) if times else None
    try:
        commit = subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    except (OSError, subprocess.CalledProcessError):
        commit = None
    report = dict(timestamp=datetime.now(timezone.utc).isoformat(), dataset_sha256=sha(input_bytes),
        dataset=source['description'],
        source_sha256={name:sha((ROOT/name).read_bytes()) for name in
            ('scripts/stage4_compare.py','scripts/stage4-export.mjs','src/services/catalog/search.ts')},
        git_base_commit=commit, platform=platform.platform(), processor=platform.processor(),
        python=platform.python_version(), onnxruntime=ort.__version__, numpy=np.__version__, tokenizers=tokenizers.__version__,
        model=manifest, providers=session.get_providers(), warmup=1, repeats=3, threads=2,
        model_load_ms=model_load_ms,index_ms=index_ms,cache_hit=cache_hit,index_key=key,
        notes=['All products indexed; query variants separated by product across dev/test.',
            'Jaccard timings measured in Node; MiniLM timings in Python incl. tokenization/pooling/search.',
            'Unknown/ambiguous cases excluded from known-item top-k denominator.',
            'No production thresholds chosen. Structural and review-all policies are not equivalent.'],
        summaries=summaries, rows=source['cases'])
    (ROOT/'benchmarks/stage4-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    summary = ['# 4단계 실측 결과', '', f"측정 시각 UTC: {report['timestamp']}",
        f"환경: {report['platform']} / Python {report['python']} / ORT {ort.__version__}", '',
        f"입력 {len(source['cases'])}개, synthetic={source['catalog']['synthetic']}. 평가용 등록 상품 {summaries['test']['jaccard']['known_count']}개.",
        '후보 DB에는 모든 상품이 들어 있으며 질의 변형만 상품별로 dev/test 분리했다.', '',
        '| 평가용 등록 상품 | Jaccard | MiniLM INT8 |', '|---|---:|---:|']
    for label, key in [('상품 Top-1','product_top1'),('상품 Top-3','product_top3'),('식품 Top-1','food_top1')]:
        def fmt(v):
            return 'N/A' if v is None else f'{v:.1%}'
        summary.append(f"| {label} | {fmt(summaries['test']['jaccard'][key])} | {fmt(summaries['test']['minilm'][key])} |")
    summary += ['', '숫자는 이 합성 예제에서의 결과이며 실제 주문 정확도로 일반화할 수 없다.',
        'MiniLM의 자동 확정 임계값은 미정이므로 모두 사용자 확인 대상으로 둔다. 오류율 0으로 해석하지 않는다.',
        '3단계 구조 규칙의 제안/확인 요청/오제안 집계 및 원시 순위·시간은 stage4-report.json 참조.',
        'Jaccard는 Node, MiniLM은 Python 측정이다. PC의 소규모 측정이며 모바일 속도 비교가 아니다.',
        'INT8 결과만 있으므로 이번 오분류의 원인을 양자화로 단정할 수 없다. FP32 비교는 5단계다.', '']
    (ROOT/'benchmarks/STAGE4_RESULTS.md').write_text('\n'.join(summary),encoding='utf-8')
    print(json.dumps(summaries,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()
