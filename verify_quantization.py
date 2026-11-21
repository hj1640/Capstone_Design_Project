import os
import shutil
import numpy as np
import torch
from transformers import AutoTokenizer
from optimum.onnxruntime import ORTModelForFeatureExtraction
from sentence_transformers import SentenceTransformer

# =========================================================
# 이 스크립트가 하는 일 (한 줄 요약):
# "압축하기 전 원본 모델"과 "INT8로 압축한 모델"이
# 똑같은 문장을 넣었을 때 얼마나 비슷한 결과를 내는지 비교합니다.
# 점수가 1.0에 가까울수록(예: 0.99 이상) 압축해도 품질 손실이
# 거의 없다는 뜻이고, 그래야 앱에 안심하고 넣을 수 있어요.
# =========================================================

print("=== 1. optimum이 요구하는 폴더 구조 맞추기 ===")
# optimum은 "config.json + model.onnx + 토크나이저 파일들"이
# 한 폴더 안에 다 같이 있어야 모델을 읽을 수 있어요.
# 지금 Int8_Quantization 파일은 onnx_model 폴더 밖에 따로 있으니까,
# 확인용 폴더를 하나 새로 만들어서 그 안에 모아줍니다.
# (원본 onnx_model 폴더는 전혀 건드리지 않아요, 복사만 합니다)
quant_dir = "onnx_model_int8_check"
if os.path.exists(quant_dir):
    shutil.rmtree(quant_dir)
shutil.copytree("onnx_model", quant_dir)
shutil.copy("Int8_Quantization", os.path.join(quant_dir, "model.onnx"))
print(f"  -> {quant_dir}/ 폴더에 양자화 모델 + 토크나이저 파일 준비 완료")

print("\n=== 2. 두 모델 불러오기 (원본 / INT8 양자화) ===")
tokenizer = AutoTokenizer.from_pretrained(quant_dir)
ort_model = ORTModelForFeatureExtraction.from_pretrained(quant_dir)
orig_model = SentenceTransformer('jhgan/ko-sroberta-multitask')
print("  -> 로드 완료")


def mean_pool_normalize(last_hidden_state, attention_mask):
    # 모델이 각 단어(토큰)마다 벡터를 하나씩 뱉어내는데,
    # 문장 전체를 벡터 하나로 요약하려면 "평균"을 내야 해요.
    # 이때 패딩(빈 자리 채우기용 토큰)은 평균에서 빼야 하니까
    # attention_mask로 실제 단어 위치만 골라서 평균을 냅니다 (mean pooling).
    mask = attention_mask.unsqueeze(-1).expand(last_hidden_state.size()).float()
    summed = torch.sum(last_hidden_state * mask, dim=1)
    counts = torch.clamp(mask.sum(dim=1), min=1e-9)
    mean_pooled = summed / counts
    # L2 정규화: 벡터의 길이를 1로 맞춰서, 코사인 유사도 계산이 더 안정적이게 함
    return torch.nn.functional.normalize(mean_pooled, p=2, dim=1)


def embed_with_onnx(text: str) -> np.ndarray:
    inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True)
    outputs = ort_model(**inputs)
    return mean_pool_normalize(outputs.last_hidden_state, inputs["attention_mask"])[0].numpy()


print("\n=== 3. 문장별 임베딩 비교 (원본 vs INT8, 코사인 유사도) ===")
test_sentences = [
    "두부 순두부 연두부 모두부 부침두부 찌개두부 콩두부",
    "삼겹살 돼지고기 목살 앞다리살",
    "양파 적양파 미니양파",
    "우유 흰우유 저지방우유 유기농우유",
    "라면 신라면 컵라면 봉지라면",
    "당근",
    "촌두부 찌개용 1개 300g",
]

min_sim = 1.0
for sent in test_sentences:
    orig_emb = orig_model.encode(sent, normalize_embeddings=True)
    onnx_emb = embed_with_onnx(sent)
    cos_sim = float(np.dot(orig_emb, onnx_emb))
    min_sim = min(min_sim, cos_sim)
    print(f"  '{sent}'")
    print(f"    원본 vs INT8 코사인 유사도 = {cos_sim:.6f}")

print("\n=== 4. 실제 매칭 시나리오 재현 (fridge_embed.py와 동일한 테스트) ===")
db_keywords = test_sentences[:6]
receipt_item = test_sentences[6]

orig_db = np.array([orig_model.encode(k, normalize_embeddings=True) for k in db_keywords])
onnx_db = np.array([embed_with_onnx(k) for k in db_keywords])

orig_receipt = orig_model.encode(receipt_item, normalize_embeddings=True)
onnx_receipt = embed_with_onnx(receipt_item)

orig_scores = orig_db @ orig_receipt
onnx_scores = onnx_db @ onnx_receipt

print("키워드별 유사도 (원본 | INT8):")
for k, o, q in zip(db_keywords, orig_scores, onnx_scores):
    print(f"  {k}: {o:.4f} | {q:.4f}")

orig_best = db_keywords[int(orig_scores.argmax())]
onnx_best = db_keywords[int(onnx_scores.argmax())]
print(f"\n최종 매칭 - 원본 모델: '{orig_best}'")
print(f"최종 매칭 - INT8 모델: '{onnx_best}'")

print("\n=== 결론 ===")
print(f"가장 낮았던 문장 유사도: {min_sim:.6f}")
if orig_best == onnx_best and min_sim > 0.98:
    print("=> 매칭 결과 동일 + 유사도 손실 거의 없음. INT8 양자화 모델 그대로 앱에 써도 안전해요!")
else:
    print("=> 매칭 결과가 다르거나 유사도 손실이 있어요. 이 결과를 저한테 공유해주시면 같이 원인을 봐요.")

# 확인 끝난 임시 폴더는 정리 (원본 onnx_model, Int8_Quantization 파일은 그대로 남아있어요)
shutil.rmtree(quant_dir)
