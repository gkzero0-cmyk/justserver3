# justserver3 Wiki

공개 Notion 페이지를 독립적인 위키 UI로 렌더링하는 Next.js 사이트입니다.

## 원본 Notion

기본 페이지 ID:

`3dad57d6a55c80469f3de9730cb88975`

환경변수 `NOTION_PAGE_ID`를 설정하면 다른 공개 Notion 페이지를 같은 위키 엔진으로 렌더링할 수 있습니다.

## 특징

- 공개 Notion 내용을 서버에서 자동 로드
- 약 5분 캐시 후 최신 내용 반영
- Notion 하위 페이지 내부 라우팅
- 데스크톱 고정 사이드바 / 모바일 드로어
- 문서 제목 자동 목차
- 목차 검색
- 다크 위키 테마
- 원본 Notion 바로가기
- 별도의 Notion API 키 불필요

## 실행

```bash
npm install
npm run dev
```

## Vercel

저장소를 Vercel에 연결하면 기본 설정으로 배포할 수 있습니다.

선택 환경변수:

```
NOTION_PAGE_ID=3dad57d6a55c80469f3de9730cb88975
```

> 공개 설정이 해제된 Notion 페이지는 불러올 수 없습니다.
