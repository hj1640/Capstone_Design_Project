# 진짜 허깅페이스 토크나이저가 내놓는 "정답" 토큰 id를 출력합니다.
# 이 숫자들과 npx tsx test-tokenizer.ts 결과가 똑같이 나와야,
# TypeScript로 짠 토크나이저가 제대로 동작한다는 뜻이에요.
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("onnx_model")

tests = [
    "두부",
    "삼겹살 돼지고기 목살 앞다리살",
    "촌두부 찌개용 1개 300g",
    "눈꽃 양배추채",
]

for t in tests:
    ids = tok(t)["input_ids"]
    print(f"{t} -> {ids}")
