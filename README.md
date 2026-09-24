# 그냥서버 : 적자생존 공식 위키

공개 Notion을 원본으로 사용하는 독립 위키 사이트입니다.

## 운영 사이트

- https://justserver3.vercel.app/
- 원본 Notion: https://daisy-grouse-ac0.notion.site/3dad57d6a55c80469f3de9730cb88975

## 현재 구조

- Next.js 16 + React 19
- 공개 Notion 문서 자동 렌더링
- 문서/본문 약 5분 단위 재검증
- Notion 하위 문서 자동 인덱싱
- 새 하위 페이지도 동적 경로로 열 수 있도록 구성
- Notion 이미지 로컬 아카이브 후 GitHub 원본 자산으로 제공
- 현재 인덱스 기준 문서 22개 / 이미지 자산 75개
- 데스크톱 고정 사이드바
- 모바일 드로어 메뉴
- 전체 문서 검색 + 현재 페이지 목차
- 가이드 카테고리 홈
- sitemap.xml / robots.txt
- GitHub Actions 빌드 검증
- 6시간 단위 Notion 이미지·페이지 인덱스 동기화

## 자동 동기화 흐름

```
공개 Notion
  ↓
GitHub Actions 수집기
  ↓
public/notion-assets/
  ├─ 이미지 자산
  ├─ manifest.json
  └─ index.json
  ↓
Vercel 위키
```

위키는 GitHub의 최신 `manifest.json`과 `index.json`을 약 5분 캐시로 읽습니다. 기존 문서 본문뿐 아니라 새 페이지와 새 이미지 매핑도 재배포 의존도를 최소화하도록 구성되어 있습니다.

## 로컬 실행

```bash
npm install
npm run dev
```

## 이미지/인덱스 수동 동기화

```bash
npm run sync:notion-assets
```

기본 Notion 페이지 ID는 `3dad57d6a55c80469f3de9730cb88975`이며, 필요하면 `NOTION_PAGE_ID` 환경변수로 교체할 수 있습니다.
