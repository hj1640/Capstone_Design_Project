"""D-052 artifact inspection. Does not install, execute, or verify APK signatures."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def digest(stream):
    result = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1024 * 1024), b''):
        result.update(chunk)
    return result.hexdigest()


def inspect(apk):
    identity = json.loads((ROOT / 'config/expo-project.json').read_text(encoding='utf-8'))
    models = json.loads((ROOT / 'models/manifest.json').read_text(encoding='utf-8'))['files']
    models = [m for m in models if m['path'].endswith('.onnx')]
    models += [json.loads((ROOT / 'models/stage5-quantization.json').read_text(encoding='utf-8'))['output']]
    with apk.open('rb') as stream:
        sha = digest(stream)
    with zipfile.ZipFile(apk) as archive:
        bad_entry = archive.testzip()
        names = set(archive.namelist())
        manifest = archive.read('AndroidManifest.xml')
        package = identity['androidPackage']
        package_present = any(package.encode(encoding) in manifest for encoding in ['utf-8', 'utf-16le'])
        abis = sorted({n.split('/')[1] for n in names if n.startswith('lib/') and n.endswith('/libonnxruntimejsi.so')})
        native = {abi: all(f'lib/{abi}/{name}' in names for name in ['libonnxruntimejsi.so', 'libonnxruntime.so']) for abi in abis}
        matched = []
        for model in models:
            entries = []
            for entry in archive.infolist():
                if entry.file_size == model['bytes']:
                    with archive.open(entry) as stream:
                        if digest(stream) == model['sha256']:
                            entries.append(entry.filename)
            matched.append({'model': model['path'], 'sha256': model['sha256'], 'entries': entries})
        dex = [n for n in names if n.startswith('classes') and n.endswith('.dex')]
        markers = {'onnxPackageClass': b'Lai/onnxruntime/reactnative/OnnxruntimePackage;',
                   'mlkitPackageClass': b'Lcom/rnmlkit/textrecognition/TextRecognitionPackage;'}
        classes = {key: False for key in markers}
        for name in dex:
            data = archive.read(name)
            for key, marker in markers.items():
                classes[key] |= marker in data
        bundle_present = 'assets/index.android.bundle' in names
    passed = (bad_entry is None and package_present and bundle_present and bool(abis)
              and all(native.values()) and all(classes.values()) and all(m['entries'] for m in matched))
    return {'decision': 'D-052', 'observedAtUtc': datetime.now(timezone.utc).isoformat(),
            'filename': apk.name, 'bytes': apk.stat().st_size, 'sha256': sha, 'zipCrcValid': bad_entry is None,
            'androidPackage': package, 'manifestPackagePresent': package_present, 'jsBundlePresent': bundle_present,
            'onnxLibrariesByAbi': native, 'dexPackageClasses': classes, 'models': matched, 'passed': bool(passed),
            'signatureIndependentlyVerified': False, 'physicalDeviceExecuted': False,
            'limitations': ['ZIP integrity and included bytes only; not signature trust or Android execution',
                           'No OCR/model accuracy, performance, or public-server verification']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('apk', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    result = inspect(args.apk)
    body = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.write_text(body, encoding='utf-8')
    print(body)
    raise SystemExit(0 if result['passed'] else 1)
