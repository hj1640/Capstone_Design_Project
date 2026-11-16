from optimum.onnxruntime import ORTModelForFeatureExtraction
from transformers import AutoTokenizer

model_name = 'jhgan/ko-sroberta-multitask'

# 1. ONNX 형식으로 모델 불러오기 (export=True 가 변환한다는 의미)
ort_model = ORTModelForFeatureExtraction.from_pretrained(model_name,      # 모델 이름 넣어봐
    export=True  # 변환할 거니까 True
)

# 2. 토크나이저도 불러오기 (토크나이저 = 문장을 숫자로 쪼개는 도구)
tokenizer = AutoTokenizer.from_pretrained(model_name)

# 3. 변환된 모델 저장
ort_model.save_pretrained("onnx_model")    # 저장할 폴더 이름
tokenizer.save_pretrained("onnx_model")    # 같은 폴더에 저장