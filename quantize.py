from onnxruntime.quantization import quantize_dynamic, QuantType
import os

input_path = "onnx_model/model.onnx"
output_path = "onnx_model/model_int8.onnx"

quantize_dynamic(
    model_input=input_path,
    model_output=output_path,
    weight_type=QuantType.QInt8
)

before = os.path.getsize(input_path) / (1024 * 1024)
after = os.path.getsize(output_path) / (1024 * 1024)

print(f"완료!")
print(f"전: {before:.0f}MB → 후: {after:.0f}MB")