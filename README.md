# Font Builder — SVG → OTF

브라우저 안에서 SVG 글리프를 올리고 메트릭/커닝을 다듬어 OTF 폰트로 빌드하는 웹앱.

## 현재 상태: 단일 사용자 코어 (MVP)

이번 단계에서 구현된 범위 — **로컬에서 완결되는 단일 사용자 폰트 빌더**:

- ASCII 95자 + 시스템 글리프(.notdef / .null / CR / space) 슬롯
- 개별 SVG 업로드 → 자동 정규화 (transform 베이크, Y축 폰트 좌표 변환, UPM 스케일, 열린 패스 자동 연결)
- 글리프 그리드 (카테고리/상태 필터, 검색, 다중 선택)
- 글리프 에디터 캔버스 (가이드라인, 줌/팬, 드래그 이동, 그리드 스냅)
- Inspector: 메트릭 / 변형 / 커닝 / 폰트 설정, 다중 선택 일괄 편집
- 메트릭 프리셋 3종 (자감형/일반형/장식형, UPM 1000)
- 타이핑 탭 (라이브 빌드 프리뷰 `@font-face` 주입 / 글리프 SVG 미리보기, 슬라이더 3종)
- 오버뷰 탭, 검증 체크리스트, 진행률
- OTF 빌드 & 다운로드 (CFF, opentype.js) + **old-style `kern` 테이블 임베드**
- Undo/Redo (50단계), 수동 스냅샷 (최대 20개)
- JSON 임포트/익스포트
- 다크모드 + 액센트 컬러 (개인 설정, localStorage)
- 키보드 단축키

저장은 브라우저 `localStorage`에 됩니다. 협업 계층(Supabase realtime/presence/soft-lock)은
`supabase/migrations/001_initial_schema.sql` 와 `src/lib/supabase/` 에 **스캐폴드만** 되어 있고
아직 연결되지 않았습니다 (Phase 5).

> 커닝: opentype.js 1.x는 `kern` 테이블을 출력하지 않아, 생성된 sfnt에 Microsoft v0 / format-0
> `kern` 테이블을 직접 삽입합니다. (`src/lib/font/kerning.ts`, 헤드라운드트립 검증 완료)

## 개발

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 정적 번들 (tsc + vite)
npm run typecheck
```

데스크톱 브라우저(1024px 이상) 전용입니다.

## 한계 (의도적, MVP)

- 패스 자체 편집 불가 — 수정하려면 SVG 재업로드
- self-intersection boolean 단순화는 미구현 (열린 패스 자동 연결만)
- OpenType 고급 feature(GSUB/GPOS), hinting 미지원
- 협업/실시간 동기화 미연결 (스키마/클라이언트 스캐폴드만 존재)

## 검증

- OTF CFF 출력 + kern 삽입은 opentype.js 재파싱으로 라운드트립 검증됨.
- SVG 정규화/캔버스 등 UI 동작은 실제 브라우저에서 수동 확인이 필요합니다
  (이 환경에서는 브라우저 구동 검증을 하지 못했습니다).
