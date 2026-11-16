> **D-051 현재 적용 안내:** 이 파일은 이전 검토/개발 실행 기록입니다. 최신 앱 연결·코드 등록·재시도·배포는 [APP_DEPLOYMENT.md](APP_DEPLOYMENT.md), 상세 결과는 [APP_INTEGRATION_REPORT.md](APP_INTEGRATION_REPORT.md)를 따릅니다. 과거 토큰 직접 입력 및 재시작 시 재입력 안내는 현재 화면과 다릅니다.

> **현재 기준: D-050 (2026-11-12).** 지류+쿠팡, 포장지 날짜, 개인별 평균. 이 문서의 이전 공용/온라인 전용 설명은 당시 기록이며 [최신 검토](REVIEW_FINAL.md)와 [실행 안내](TEAM_SETUP.md)를 우선합니다.

# 조원용 작업 시작점

**2026-11-02: [1단계 데이터 설계](STAGE_1_DESIGN.md)와 [API 계약](STAGE_1_API.md) 추가.** 앱/서버 동작 구현은 후속 단계이며 운영값은 미정입니다.

이 저장소의 React Native + Expo 앱에서 이어서 개발합니다. 기준 점검일: **2026-10-30**.

1. [0단계 현재 상태와 증거](STAGE_0_BASELINE.md)를 먼저 확인합니다.
2. [실행·개발 빌드 연결 안내](TEAM_SETUP.md)를 따라 환경을 준비합니다.
3. [빠진 실험 자료와 단계별 작업](NEXT_STEPS.md)에서 맡을 작업과 제출물을 확인합니다.
4. [결정·미정 값](DECISIONS.md)을 확인한 뒤 코드를 변경합니다.

공유 출처:

- [팀 GitHub](https://github.com/hj1640/Capstone_Design_Project)
- [Notion 연구노트](https://app.notion.com/p/3fcddc2e13b380868de9ca2b14385b29)
- [사용자가 제공한 Expo 개발 빌드](https://expo.dev/accounts/hj1640/projects/fridge-app/builds/ae1cdfc7-f4ef-4862-9024-4b00b5b70ac2)

이 문서는 저장소와 연구노트·빌드의 **연결을 추적**합니다. 제공된 APK가 현재 Git 커밋에서 만들어졌다는 검증은 아직 없습니다. 새 기능의 구현 완료 보고도 아닙니다.

2단계: [모델 실행 검사·재현 방법](STAGE_2_VALIDATION.md). PC 검증 완료, 실기기 결과 대기.

3단계: [상품 DB 검색과 표준 식품 연결](STAGE_3_CATALOG.md). 합성 자료 검증 및 앱 개발용 검색 화면.

4단계: [Jaccard / MiniLM 실측 비교](STAGE_4_COMPARISON.md), [결과표](../benchmarks/STAGE4_RESULTS.md).

5단계: [모델 비교·앱 개발용 연결](STAGE_5_MODEL_AND_APP.md), [실측 결과표](../benchmarks/STAGE5_RESULTS.md). 새 clone에서는 5단계 모델 준비 명령을 먼저 실행한다.

6단계: [개인 소비기한 저장·서버 제출](STAGE_6_FEEDBACK.md). 새 SQLite/Crypto native dependency로 개발 APK 재빌드 필요.

7단계: [신뢰도·통계·공유 규칙 엔진](STAGE_7_TRUST_POLICY.md), [합성 비교 결과](../benchmarks/STAGE7_RESULTS.md). 운영 정책은 비활성/미정 상태.

8단계: [전체 검증과 인수](STAGE_8_ACCEPTANCE.md), [운영 적용 전 남은 조건](RELEASE_GATES.md), [팀 시연 설명 노트](TEAM_DEMO_SCRIPT.md), [검증 결과](../benchmarks/STAGE8_RESULTS.md).
