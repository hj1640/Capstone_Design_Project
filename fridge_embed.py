import numpy as np
from sentence_transformers import SentenceTransformer, util

# MiniLM 모델 불러오기
model = SentenceTransformer('jhgan/ko-sroberta-multitask')

# DB에 있는 식품 키워드
db_keywords = [ "두부", "삼겹살", "양파", "우유", "라면", "당근", "사과",
               "바나나", "오렌지", "브로콜리", " 월남쌈 소스" ]

# 처음 한 번만 계산하고 저장
db_embeddings = model.encode(db_keywords)
np.save('db_embeddings.npy', db_embeddings)

# 다음부터는 불러오기만 하면 됨
db_embeddings = np.load('db_embeddings.npy')

# 영수증에서 OCR로 뽑혔다고 가정한 텍스트
receipt_item = "간편한 구개산 제주 밀양 강원도 햇 당..."
# 임베딩
db_embeddings = model.encode(db_keywords)
receipt_embedding = model.encode(receipt_item)

# 유사도 계산
scores = util.cos_sim(receipt_embedding, db_embeddings)[0]

# 결과 출력
print(f"입력: '{receipt_item}'")
print()
for keyword, score in zip(db_keywords, scores):
    print(f"  {keyword}: {score:.4f}")

# 가장 유사한 식품 찾기
best_idx = scores.argmax()
print(f"\n최종 매칭: '{db_keywords[best_idx]}' (유사도: {scores[best_idx]:.4f})")