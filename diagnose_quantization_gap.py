import numpy as np
import torch
from transformers import AutoTokenizer
from optimum.onnxruntime import ORTModelForFeatureExtraction
from sentence_transformers import SentenceTransformer

# =========================================================
# 목적: 지난번 0.95~0.97 유사도가
#  (A) 양자화(INT8) 때문에 생긴 진짜 손실인지
#  (B) 제가 손으로 짠 풀링 코드가 공식 코드랑 달라서 생긴 오차인지
# 를 구분합니다.
# 방법: 양자화 "안 한" float32 ONNX 모델도 똑같은 풀링 코드로 돌려서
#       원본과 비교해봅니다.
# =========================================================

print("=== 1. sentence-transformers가 실제로 어떤 파이프라인을 쓰는지 확인 ===")
orig_model = SentenceTransformer('jhgan/ko-sroberta-multitask')
print(orig_model)
print("(0_Transformer 다음에 1_Pooling만 있고 mode가 mean이면, 저희가 짠 mean pooling 방식이 맞는 거예요)")

print("\n=== 2. 토크나이저 + float32 ONNX(양자화 전) + INT8 ONNX 둘 다 로드 ===")
tokenizer = AutoTokenizer.from_pretrained("onnx_model")
ort_fp32 = ORTModelForFeatureExtraction.from_pretrained("onnx_model")  # 양자화 안 한 원본 ONNX

import os, shutil
quant_dir = "onnx_model_int8_check"
if os.path.exists(quant_dir):
    shutil.rmtree(quant_dir)
shutil.copytree("onnx_model", quant_dir)
shutil.copy("Int8_Quantization", os.path.join(quant_dir, "model.onnx"))
ort_int8 = ORTModelForFeatureExtraction.from_pretrained(quant_dir)


def mean_pool_normalize(last_hidden_state, attention_mask):
    mask = attention_mask.unsqueeze(-1).expand(last_hidden_state.size()).float()
    summed = torch.sum(last_hidden_state * mask, dim=1)
    counts = torch.clamp(mask.sum(dim=1), min=1e-9)
    mean_pooled = summed / counts
    return torch.nn.functional.normalize(mean_pooled, p=2, dim=1)


def embed_with(model, text: str) -> np.ndarray:
    inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True)
    outputs = model(**inputs)
    return mean_pool_normalize(outputs.last_hidden_state, inputs["attention_mask"])[0].numpy()


test_sentences = [
    "두부 순두부 연두부 모두부 부침두부 찌개두부 콩두부",
    "삼겹살 돼지고기 목살 앞다리살",
    "양파 적양파 미니양파",
    "우유 흰우유 저지방우유 유기농우유",
    "라면 신라면 컵라면 봉지라면",
    "당근",
    "촌두부 찌개용 1개 300g",
]

print("\n=== 3. 문장별: 원본 vs float32-ONNX(제 풀링코드) vs INT8-ONNX(제 풀링코드) ===")
for sent in test_sentences:
    orig_emb = orig_model.encode(sent, normalize_embeddings=True)
    fp32_emb = embed_with(ort_fp32, sent)
    int8_emb = embed_with(ort_int8, sent)

    sim_orig_fp32 = float(np.dot(orig_emb, fp32_emb))   # 제 풀링코드가 정확한지 (양자화 영향 없음)
    sim_fp32_int8 = float(np.dot(fp32_emb, int8_emb))   # 순수 양자화 손실만
    sim_orig_int8 = float(np.dot(orig_emb, int8_emb))   # 지난번에 본 것과 같은 숫자

    print(f"  '{sent}'")
    print(f"    원본 vs float32-ONNX (풀링코드 정확도) = {sim_orig_fp32:.6f}")
    print(f"    float32 vs INT8      (순수 양자화 손실) = {sim_fp32_int8:.6f}")
    print(f"    원본 vs INT8          (합쳐진 결과, 지난번 수치) = {sim_orig_int8:.6f}")
    print()

shutil.rmtree(quant_dir)
print("=== 해석 가이드 ===")
print("원본 vs float32-ONNX 가 0.999 이상이면: 제 풀링코드는 정확함. 범인은 양자화.")
print("원본 vs float32-ONNX 도 0.95~0.97대면: 범인은 풀링코드(혹은 모델 구조 차이), 양자화는 죄 없음.")
