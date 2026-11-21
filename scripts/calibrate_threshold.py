"""ko-sroberta 매칭 임계값 보정 스크립트.
사용: python scripts/calibrate_threshold.py <model_int8.onnx> <tokenizer.json> [labeled.csv]
labeled.csv 형식: text,answer  (answer가 비어 있으면 'DB에 없는 품목/잡음' = 거부돼야 정답)
"""
import sys, csv, numpy as np, onnxruntime as ort
from tokenizers import Tokenizer

DB = ['흰우유','계란','대파','애호박','바나나','방울토마토','돼지고기 삼겹살','닭가슴살',
      '두부','즉석밥','김치','생수','두유','식빵','된장','고등어']

DEFAULT = [  # (영수증 상품명 후보, 정답 표준명 or '')
 ('서울우유 1L','흰우유'),('매일우유 900ml','흰우유'),('흰우유1000','흰우유'),
 ('특란 30구','계란'),('무항생제 계란 15입','계란'),('대란10구','계란'),
 ('대파 1단','대파'),('손질대파','대파'),('애호박','애호박'),('애호박 1개','애호박'),
 ('바나나 1송이(수입)','바나나'),('스위티오 바나나','바나나'),('델몬트바나나','바나나'),
 ('대추방울토마토 500g','방울토마토'),('방울토마토','방울토마토'),
 ('한돈 삼겹살 구이용','돼지고기 삼겹살'),('냉장삼겹살','돼지고기 삼겹살'),
 ('닭가슴살 1kg','닭가슴살'),('하림 닭가슴살','닭가슴살'),
 ('풀무원 부침두부','두부'),('찌개두부','두부'),('CJ햇반 210g*3','즉석밥'),('오뚜기밥','즉석밥'),
 ('종가집 포기김치','김치'),('맛김치 1kg','김치'),('삼다수 2L','생수'),('아이시스 500ml','생수'),
 ('베지밀 190ml','두유'),('검은콩두유','두유'),('삼립 식빵','식빵'),('통밀식빵','식빵'),
 ('해찬들 재래된장','된장'),('손질고등어','고등어'),('노르웨이 고등어 2마리','고등어'),
 # DB에 없는 식품 / 영수증 잡음 → 거부(또는 사용자 확인)돼야 함
 ('양배추','') ,('코카콜라 1.5L',''),('신라면 5입',''),('참치캔',''),('사과 1봉',''),
 ('종량제봉투 20L',''),('이마트 수원점',''),('행사할인',''),('면세물품',''),('포인트적립',''),
]

def load(model, tok):
    s = ort.InferenceSession(model); t = Tokenizer.from_file(tok)
    names = [i.name for i in s.get_inputs()]
    def embed(text):
        ids = t.encode(text).ids
        feed = {'input_ids': np.array([ids],dtype=np.int64),
                'attention_mask': np.ones((1,len(ids)),dtype=np.int64),
                'token_type_ids': np.zeros((1,len(ids)),dtype=np.int64)}
        out = s.run(None, {k:v for k,v in feed.items() if k in names})[0][0]
        v = out.mean(0); return v/np.linalg.norm(v)
    return embed

def main():
    model, tok = sys.argv[1], sys.argv[2]
    data = DEFAULT
    if len(sys.argv) > 3:
        data = [(r['text'], r['answer'].strip()) for r in csv.DictReader(open(sys.argv[3], encoding='utf-8-sig'))]
    embed = load(model, tok)
    dbv = np.stack([embed(n) for n in DB])
    rows = []
    for text, ans in data:
        sims = dbv @ embed(text); order = np.argsort(-sims)
        top, second = sims[order[0]], sims[order[1]]
        rows.append((text, ans, DB[order[0]], float(top), float(top-second)))
    print(f"{'입력':<22}{'정답':<10}{'1위':<10}{'점수':>6}{'차이':>6}")
    for r in rows: print(f"{r[0]:<22}{r[1] or '-':<10}{r[2]:<10}{r[3]:6.3f}{r[4]:6.3f}{'' if (r[1]=='' or r[1]==r[2]) else '  ✗오답'}")
    pos = [r for r in rows if r[1]]; neg = [r for r in rows if not r[1]]
    acc = sum(r[1]==r[2] for r in pos)/len(pos)
    print(f"\n정답 있는 {len(pos)}개 중 1위 정답률: {acc:.0%}")
    print(f"정답 1위 점수: min {min(r[3] for r in pos if r[1]==r[2]):.3f} / 중앙값 {np.median([r[3] for r in pos if r[1]==r[2]]):.3f}")
    print(f"거부 대상 1위 점수: max {max(r[3] for r in neg):.3f} / 중앙값 {np.median([r[3] for r in neg]):.3f}")
    print("\n임계값 후보별 결과 (자동 확정 = 점수>=T 이고 정답과 일치해야 맞음)")
    for T in np.arange(0.30, 0.86, 0.05):
        auto = [r for r in rows if r[3] >= T]
        right = sum(1 for r in auto if r[1] and r[1]==r[2])
        wrong = len(auto)-right
        rejected_ok = sum(1 for r in neg if r[3] < T)
        print(f"  T={T:.2f}: 자동확정 {len(auto):2d}개(맞음 {right}, 틀림 {wrong}) | 거부대상 {rejected_ok}/{len(neg)} 걸러냄")
    grid(rows)


def grid(rows):
    print("\n(점수 T, 1-2위 차이 G) 조합: 둘 다 넘으면 자동 확정")
    for T in (0.45,0.50,0.55,0.60):
        for G in (0.05,0.10,0.15):
            auto=[r for r in rows if r[3]>=T and r[4]>=G]
            right=sum(1 for r in auto if r[1] and r[1]==r[2])
            print(f"  T={T:.2f} G={G:.2f}: 자동확정 {len(auto):2d} (맞음 {right}, 틀림 {len(auto)-right})")

if __name__ == '__main__': main()
