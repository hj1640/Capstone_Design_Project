"""FP32/upstream INT8/local INT8; isolated CPU worker for each model."""
import argparse
import hashlib
from datetime import datetime, timezone
import json
from pathlib import Path
import platform
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream,'sha256').hexdigest()


def worker(variant):
    import numpy as np
    import onnxruntime as ort
    import psutil
    from tokenizers import Tokenizer
    specs = {
        'fp32': ('model.onnx',json.loads((ROOT/'models/stage5-manifest.json').read_text())['files'][0]['sha256']),
        'upstream_int8': ('model_int8.onnx',json.loads((ROOT/'models/manifest.json').read_text())['files'][-1]['sha256']),
        'local_int8': ('model_local_int8.onnx',json.loads((ROOT/'models/stage5-quantization.json').read_text())['output']['sha256']),
        'matmul_int8': ('model_matmul_int8.onnx',json.loads((ROOT/'models/stage5-matmul-quantization.json').read_text())['output']['sha256']),
    }
    file, expected_hash = specs[variant]
    for entry in json.loads((ROOT/'models/manifest.json').read_text())['files'][:3]:
        if digest(ROOT/'assets/models'/Path(entry['path']).name) != entry['sha256']:
            raise ValueError('Tokenizer/config hash mismatch')
    path = ROOT/'assets/models'/file
    if digest(path) != expected_hash:
        raise ValueError('Model hash mismatch')
    inputs = json.loads((ROOT/'benchmarks/stage4-input.json').read_text(encoding='utf-8'))
    process = psutil.Process()
    baseline_rss = process.memory_info().rss
    ort.disable_telemetry_events()
    opts = ort.SessionOptions()
    opts.intra_op_num_threads=2
    opts.inter_op_num_threads=1
    start = time.perf_counter()
    session = ort.InferenceSession(str(path),opts,providers=['CPUExecutionProvider'])
    load_ms = (time.perf_counter()-start)*1000
    tokenizer = Tokenizer.from_file(str(ROOT/'assets/models/tokenizer.json'))
    tokenizer.enable_truncation(max_length=128)

    def encode(text):
        e=tokenizer.encode(text)
        values={'input_ids':e.ids,'attention_mask':e.attention_mask,'token_type_ids':e.type_ids}
        feeds={v.name:np.array([values[v.name]],dtype=np.int64) for v in session.get_inputs()}
        hidden=session.run(None,feeds)[0]
        if hidden.shape != (1,len(e.ids),384): raise ValueError('Invalid output shape')
        mask=np.array(e.attention_mask)[None,:,None]
        v=(hidden*mask).sum(1)/mask.sum(1)
        norm=np.linalg.norm(v)
        if not np.isfinite(v).all() or norm==0: raise ValueError('Invalid vector')
        return (v/norm)[0].astype(np.float32)

    start=time.perf_counter()
    products=inputs['catalog']['products']
    vectors=np.stack([encode(p['searchText'] or p['originalTitle']) for p in products])
    index_ms=(time.perf_counter()-start)*1000
    rows=[]
    for case in inputs['cases']:
        encode(case['query']) # warmup
        times=[]
        for _ in range(3):
            start=time.perf_counter()
            vector=encode(case['query'])
            scores=vectors@vector
            order=sorted(range(len(products)),key=lambda i:(-float(scores[i]),products[i]['productId']))
            times.append((time.perf_counter()-start)*1000)
        rows.append(dict(id=case['id'],vector=vector.tolist(),warm_ms=times,
            ranked=[dict(productId=products[i]['productId'],foodId=products[i]['foodId'],score=float(scores[i])) for i in order]))
    memory=process.memory_info()
    return dict(variant=variant,model_sha256=expected_hash,bytes=path.stat().st_size,
        load_ms=load_ms,index_ms=index_ms,baseline_rss=baseline_rss,rss_after=memory.rss,
        process_lifetime_peak_rss=getattr(memory,'peak_wset',None),
        ort=ort.__version__,numpy=np.__version__,rows=rows,product_vectors=vectors.tolist())


def main():
    import numpy as np
    from stage4_compare import metrics
    parser=argparse.ArgumentParser()
    parser.add_argument('--worker',choices=['fp32','upstream_int8','local_int8','matmul_int8'])
    args=parser.parse_args()
    if args.worker:
        print(json.dumps(worker(args.worker)))
        return
    source=json.loads((ROOT/'benchmarks/stage4-input.json').read_text(encoding='utf-8'))
    results=[]
    for variant in ('fp32','upstream_int8','local_int8','matmul_int8'):
        completed=subprocess.run([sys.executable,__file__,'--worker',variant],capture_output=True,text=True,encoding='utf-8',check=True)
        results.append(json.loads(completed.stdout))
    base=results[0]
    for result in results:
        known=[]
        cosines=[]
        all_times=[]
        flips=0
        for case,row,original in zip(source['cases'],result['rows'],base['rows'],strict=True):
            assert case['id']==row['id']==original['id']
            cosines.append(float(np.dot(row['vector'],original['vector'])))
            flips+=row['ranked'][0]['productId']!=original['ranked'][0]['productId']
            all_times.extend(row['warm_ms'])
            if case['split']=='test': known.append(dict(**case,variant=row['ranked']))
        result['test_metrics']=metrics(known,'variant')
        result['cosine_to_fp32_mean']=float(np.mean(cosines))
        result['cosine_to_fp32_min']=float(np.min(cosines))
        result['top1_changes_vs_fp32_all_cases']=flips
        result['warm_p50_ms']=float(np.median(all_times))
        result['warm_p95_ms']=float(np.percentile(all_times,95))
    local=results[2]
    # Only the derived synthetic index is shipped; no personal purchase data.
    mobile=dict(catalogVersion=source['catalog']['version'],modelRevision='2c4055b12046f11709e9df2c122e59ffbdc2f900',
        modelSha256=local['model_sha256'],dimension=384,variant='local_int8',
        productIds=[p['productId'] for p in source['catalog']['products']],vectors=local['product_vectors'])
    (ROOT/'src/data/catalog-embeddings-stage5.json').write_text(json.dumps(mobile),encoding='utf-8')
    golden=dict(modelSha256=local['model_sha256'],cases=[dict(id=c['id'],query=c['query'],vector=row['vector'])
        for c,row in zip(source['cases'],local['rows'],strict=True)])
    (ROOT/'benchmarks/stage5-query-vectors.json').write_text(json.dumps(golden,ensure_ascii=False),encoding='utf-8')
    for result in results:
        for row in result['rows']: row.pop('vector')
        result.pop('product_vectors')
    report=dict(timestamp=datetime.now(timezone.utc).isoformat(),platform=platform.platform(),processor=platform.processor(),
        python=platform.python_version(),input_sha256=digest(ROOT/'benchmarks/stage4-input.json'),
        warmup=1,repeats=3,threads=2,results=results,
        caveats=['Synthetic data only; same test set as stage4, not new independent evidence.',
            'Separate fresh CPU process per model; OS file cache is not controlled.',
            'Peak RSS is process lifetime including Python/ORT/tokenizer, not model-only RAM.',
            'Upstream ONNX export reused; native PyTorch to ONNX export parity not measured.',
            'No actual mobile measurements.'])
    (ROOT/'benchmarks/stage5-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    lines=['# 5단계 PC 실측 결과','','합성 평가용 등록 입력 12개. 전체 25개로 벡터 변화·시간 측정. 모바일 측정 아님.','',
        '| 모델 | 파일 MB | 상품 Top-1 | Top-3 | p50 ms | FP32 대비 평균 cosine |',
        '|---|---:|---:|---:|---:|---:|']
    for r in results:
        m=r['test_metrics']
        lines.append(f"| {r['variant']} | {r['bytes']/1e6:.2f} | {m['product_top1']:.1%} | {m['product_top3']:.1%} | {r['warm_p50_ms']:.2f} | {r['cosine_to_fp32_mean']:.5f} |")
    lines+=['','Upstream FP32 ONNX 재사용 및 로컬 dynamic INT8 생성. PyTorch export 검증은 미실행.',
        '환경·모델 해시·peak RSS·개별 순위는 stage5-report.json, recipe는 models/stage5-quantization.json 참조.','']
    (ROOT/'benchmarks/STAGE5_RESULTS.md').write_text('\n'.join(lines),encoding='utf-8')
    print('\n'.join(lines))


if __name__=='__main__':
    main()
