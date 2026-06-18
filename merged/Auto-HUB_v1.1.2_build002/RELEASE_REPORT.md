# Auto-HUB v1.1.2 / build 002 릴리즈 보고서

릴리즈 날짜: 2026-06-15

## 패치 범위

루트 source of truth 기준 변경을 설치 패키지 `merged/Auto-HUB_v1.1.2_build002`에 동기화한다. 이번 설치본은 OPEN/SAVE 폴더 UI, 1/2 슬롯 아이콘, 폴더 아이콘 버튼, 초기 패널 크기, SAVE Folder 2 조건부 표시 정책, Debug Mode 모듈 및 build fingerprint를 포함한다.

## 확인 가능한 작업 범위

- Git commit: `08f9859` 이후 미커밋 작업 범위
- Git tag: 미생성
- 변경 범위: `manifest.json`, `index.html`, `index.js`, `styles/`, `assets/`, `src/`, `docs/`, `merged/Auto-HUB_v1.1.2_build002/`
- 패키지 폴더: `merged/Auto-HUB_v1.1.2_build002`
- zip 파일: `merged/Auto-HUB_v1.1.2_build002.zip`

## 추가 기능

- Debug Mode 공통 모듈과 build fingerprint 이벤트 기반을 설치 패키지에 포함했다.
- OPEN/SAVE 폴더 선택 버튼에 정적 PNG 기반 폴더 아이콘과 reset 상태 표시를 포함했다.
- OPEN/SAVE Folder 1/2 식별용 슬롯 아이콘을 포함했다.

## 수정사항

- 2026-06-15: 앱 버전을 `v1.1.2`, 내부 빌드를 `build 002`로 올렸다.
- 2026-06-15: 과거 `build111/112`처럼 버전 숫자에서 파생된 빌드 표기를 실제 빌드 횟수 기준으로 정정했다.
- 2026-06-15: 초기 floating/docked 패널 기본 크기를 키워 첫 로딩 시 주요 UI가 더 충분히 보이도록 했다.
- 2026-06-15: OPEN 옵션 줄과 Folder 1/2 행 레이아웃을 조정하고, `1>2` 버튼 표시 조건과 정렬을 정리했다.
- 2026-06-15: SAVE Folder 2는 OPEN `2Folder each1file`이 펼쳐진 상태에서만 열고 닫을 수 있도록 조건을 분리했다.
- 2026-06-15: SAVE Folder 1/2 행 간격과 OPEN 내부 세로 간격을 압축했다.

## 버그 수정

- 2026-06-15: native `button` 내부 이미지 렌더 충돌 가능성을 피하기 위해 폴더 아이콘 버튼을 정적 `div[role="button"]` 구조로 유지했다.
- 2026-06-15: `1>2` 래퍼에 남아 있던 `visibility:hidden` 상태로 버튼이 표시되지 않던 문제를 수정했다.
- 2026-06-15: SAVE Folder 2를 접은 상태에서도 `saveFolder2`가 실행 payload에 남을 수 있는 혼선을 방지했다.

## 설치/업데이트 참고사항

- UXP Developer Tool에서 추가할 폴더: `merged/Auto-HUB_v1.1.2_build002`
- 기존 패널을 닫고 다시 열어야 하는지: 예, 기존 로드 패널을 reload 또는 remove 후 다시 add
- 기존 Action preset 유지 여부: 유지. 사용자 preset/settings 삭제 작업 없음
- 수동 제거가 필요한 이전 패키지: 없음. 다만 테스트 시 UXP Developer Tool이 루트와 이전 `merged/*` 중 어느 폴더를 로드 중인지 확인 필요

## 검증 결과

- 루트 정적 검증: 패키지 생성 전 `node --check`와 manifest JSON parse로 확인
- 패키지 정적 검증: 패키지 생성 후 `node --check`와 manifest JSON parse로 확인
- 패키지 내부 구조 확인: `manifest.json`, `index.html`, `index.js`, `styles/`, `assets/`, `src/constants/`, `src/core/`, `src/core/debug/`, `src/ui/` 포함 여부 확인
- 앱 버전/빌드 번호 확인: `manifest.json` `1.1.2`, panel title `Auto-HUB v1.1.2`, `BUILD_TOKEN` `v1.1.2-build002`, `packageBuildId` `build002`
- Photoshop UXP 설치 테스트: 미실행. Photoshop에서 수동 확인 필요
- ACTION 기본 slot / picker 테스트: 미실행. Photoshop에서 수동 확인 필요
- OPEN/SAVE 폴더 선택 테스트: 미실행. Photoshop에서 수동 확인 필요
- 1 test: 미실행. Photoshop에서 수동 확인 필요
- Run: 미실행. Photoshop에서 수동 확인 필요
- Debug UI 기본 비노출: 미실행. Photoshop에서 수동 확인 필요
- 체크섬: 최종 zip 외부 배포 메모에 기록한다. 패키지 내부 보고서에는 zip 체크섬을 넣지 않는다.
