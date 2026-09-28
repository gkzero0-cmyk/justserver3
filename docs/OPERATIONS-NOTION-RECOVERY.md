# 그냥서버 위키 운영 안정화 가이드

이 문서는 Notion 동기화, Vercel 배포 제한, 복구본, 공개 경로 점검 절차를 정리합니다.

## 1. Notion 동기화 구조

- 일반 페이지 수정: 변경된 페이지 1개만 partial sync
- 페이지 생성/이동/부모·자식 구조 변경: subtree 최대 16페이지
- 페이지 삭제/아카이브: delete 모드로 index/search에서 즉시 제거
- webhook 누락 대비: 6시간마다 전체 crawl

삭제 이벤트에서는 Notion을 다시 전체 탐색하지 않습니다. 삭제된 페이지의 오래된 이미지 파일은 다음 전체 fallback crawl에서 정리합니다.

## 2. last-known-good

정상 동기화 후 다음 파일을 public/last-known-good에 보존합니다.

- index.json
- search-index.json
- display-manifest.json
- manifest.json

index/search가 비어 있거나 manifest가 비어 있으면 새 복구본을 만들지 않습니다.

## 3. Vercel 배포 제한

Production Verify는 다음 규칙으로 동작합니다.

- Vercel deployment가 이미 pending이면 중복 deploy hook을 보내지 않음
- build-rate-limit을 감지하면 불필요한 polling을 즉시 중단
- Production 확인은 bounded backoff로 수행
- 내부/데이터-only 변경은 불필요한 배포와 검증을 최대한 생략

GitHub Build가 성공하고 Production Verify만 실패했다면 코드 오류인지 build-rate-limit인지 로그를 먼저 구분합니다.

## 4. Public load smoke

GitHub Actions의 Public load smoke는 수동 실행 전용입니다.

기본 점검 경로:

- /
- /api/version
- /api/notion-webhook?resource=search-meta

기본 설정:

- 동시 요청 3개
- 2라운드
- 최대 동시 요청 5개
- p95 5초 초과 또는 HTTP 오류 시 실패

자동 스케줄은 없으므로 평소 GitHub Actions 사용량을 소비하지 않습니다.

## 5. 장애 확인 순서

1. 메인 페이지가 HTTP 200인지 확인
2. /api/version에서 현재 Production commit 확인
3. search-meta가 정상인지 확인
4. GitHub Build 결과 확인
5. Production Verify 실패가 build-rate-limit인지 확인
6. Notion webhook sync 실패 시 6시간 fallback 결과 확인
7. index/search가 깨졌다면 last-known-good 세트를 기준으로 복구 여부 판단

## 6. 운영 원칙

- Notion 변경마다 전체 crawl하지 않기
- build-rate-limit 중 deploy hook 반복 호출하지 않기
- optimized asset이 정상인데 원본 이미지를 다시 대량 저장하지 않기
- 삭제 이벤트 하나 때문에 전체 이미지 최적화를 다시 돌리지 않기
- 사용자 화면에 필요한 정적 자산은 optimized WebP를 우선 사용하기
