# Auto-HUB v1.1.6 / build 007 릴리즈 보고서

릴리즈 날짜: 2026-06-21

## 패치 범위

앱 버전을 `v1.1.6`, 내부 빌드를 `build 007`로 올린 설치본이다. 패널 비주얼 톤 재정비(색 계층 대비 완화, 섹션 토글/실행 버튼/푸터 톤 정리), OPEN/SAVE 폴더 행의 아이콘화와 경로 버튼 확장, 액션 picker 팝업 폭 확장, ACTION "more Actions" 노출 조건 수정을 포함한다. 아이콘(접힘 패널 탭) 표시 이슈는 이번 빌드 범위에서 제외하고 추후 처리한다.

## 확인 가능한 작업 범위

- Git commit: 미커밋 작업 범위
- Git tag: 미생성
- 변경 범위: `manifest.json`, `index.html`, `index.js`, `styles/panel.css`, `src/ui/actionPresetPart.js`, `assets/`, `icons/`, `docs/`, `CLAUDE.md`, `dist/Auto-HUB_v1.1.6_build007/`
- 패키지 폴더: `dist/Auto-HUB_v1.1.6_build007`
- zip 파일: `dist/Auto-HUB_v1.1.6_build007.zip`

## 추가 기능

- OPEN/SAVE 폴더 행을 텍스트 라벨 없이 경로 버튼 전체 폭으로 표시하고, Browse/Reset을 정사각 아이콘 버튼으로 정리했다.
- 빈 경로 버튼에 블링킹 커서 표시를 추가했다.

## 수정사항

- 2026-06-21: 패널 디자인 토큰(surface/text/accent) 전반을 재조정해 톤 기반의 깔끔한 전문 패널 방향으로 정리했다. 실행 버튼 영역·앱버전 푸터·섹션 토글 배경을 옆 탭 바탕톤에 맞췄다.
- 2026-06-21: 액션 행 체크박스 `:checked` 색을 Run 버튼 파란색으로 통일했다.
- 2026-06-21: OPEN 옵션 줄의 `order` 라벨을 제거하고 `1>2` 토글만 남겼다. 버튼 표시/숨김 시 행 높이가 흔들리지 않도록 자리를 항상 예약하도록 했다.
- 2026-06-21: 폴더 아이콘 렌더를 `icon-mask`(mask-image) 방식으로 전환해 UXP에서 정상 표시되도록 했다.
- 2026-06-21: 액션 picker 팝업을 세트 picker 왼쪽 끝~X 버튼 직전까지 펼쳐 긴 액션 이름이 잘리지 않도록 했다.
- 2026-06-20: ACTION "more Actions" 노출 분류 기준을 `enabled` → `isFavoriteSlot`(활성+선택)로 바꾸고, 즐겨찾기 0개면 모든 슬롯을 인라인 표시하도록 수정했다.
- 2026-06-20: 빌드 산출물 폴더를 `merged/`에서 `dist/`로 통일했다.

## 버그 수정

- 2026-06-20: 최초 로딩 등 즐겨찾기가 없는 상태에서 빈 슬롯이 "more Actions (1)"로 잘못 묶여 표시되던 문제를 수정했다.
- 2026-06-21: `1>2` 버튼 등장/숨김 시 disclosure 행 높이가 흔들리던 레이아웃 문제를 `visibility` 기반으로 수정했다.

## 설치/업데이트 참고사항

- UXP Developer Tool에서 추가할 폴더: `dist/Auto-HUB_v1.1.6_build007`
- `.ccx` 더블클릭 설치본은 manifest `id`(`com.psautohub.panel`) 기준으로 기존 설치를 업데이트한다.
- 기존 패널을 닫고 다시 열어야 하는지: 예, 기존 로드 패널을 reload 또는 remove 후 다시 add
- 기존 Action preset 유지 여부: 유지. 사용자 preset/settings 삭제 작업 없음
- 알려진 제한: Photoshop 접힘 패널 탭의 커스텀 아이콘이 환경에 따라 기본 placeholder로 보일 수 있다. 추후 처리 예정이며 기능에는 영향 없다.

## 검증 결과

- 루트 정적 검증: `node --check`(index.js, src/core/*, src/ui/*)와 manifest JSON parse로 확인
- 패키지 내부 구조 확인: `manifest.json`, `index.html`, `index.js`, `styles/`, `assets/`, `src/constants/`, `src/core/`, `src/core/debug/`, `src/ui/`, `icons/` 포함 여부 확인
- 앱 버전/빌드 번호 확인: `manifest.json` `1.1.6`, panel title `Auto-HUB v1.1.6`, `BUILD_TOKEN` `v1.1.6-build007`, `packageBuildId` `build007`
- `.DS_Store`/테스트 아이콘(panel-test) 미포함 확인
- Photoshop UXP 실기 테스트: 미실행. 패널 렌더(톤/폴더 아이콘/picker 폭), ACTION more Actions 노출, 1 test, Run을 Photoshop에서 수동 확인 필요
- 체크섬: 최종 zip 외부 배포 메모와 작업 로그에 기록한다.
