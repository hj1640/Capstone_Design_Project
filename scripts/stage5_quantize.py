"""D-046 experimental dynamic INT8 recipe, no evaluation-based parameter tuning."""
import hashlib
import argparse
import json
from pathlib import Path
import time
import onnx
import onnxruntime
from onnxruntime.quantization import QuantType, quantize_dynamic

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream,'sha256').hexdigest()


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--matmul-only',action='store_true',help='Size ablation: leave Gather embeddings FP32')
    args=parser.parse_args()
    manifest = json.loads((ROOT/'models/stage5-manifest.json').read_text())
    source = ROOT/'assets/models/model.onnx'
    if digest(source) != manifest['files'][0]['sha256']:
        raise ValueError('FP32 model hash mismatch')
    target = ROOT/'assets/models'/('model_matmul_int8.onnx' if args.matmul_only else 'model_local_int8.onnx')
    op_types=['MatMul'] if args.matmul_only else ['MatMul','Gather']
    start = time.perf_counter()
    # Fixed experimental recipe: dynamic activations, signed per-channel weights.
    # Constant-weight MatMul plus optional Gather; no calibration/eval labels used.
    quantize_dynamic(str(source),str(target),weight_type=QuantType.QInt8,
        per_channel=True,reduce_range=True,op_types_to_quantize=op_types,
        extra_options={'MatMulConstBOnly':True})
    report = dict(source=manifest, recipe=dict(weight_type='QInt8',per_channel=True,
        reduce_range=True,op_types=op_types,MatMulConstBOnly=True),
        onnxruntime=onnxruntime.__version__,onnx=onnx.__version__,
        elapsed_seconds=time.perf_counter()-start, output=dict(path=target.name,
        sha256=digest(target),bytes=target.stat().st_size))
    name='stage5-matmul-quantization.json' if args.matmul_only else 'stage5-quantization.json'
    (ROOT/'models'/name).write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report['output']))


if __name__=='__main__':
    main()
