# Auto-HUB v1.1.1 / build 111 릴리즈 보고서

릴리즈 날짜: 2026-06-14

## 패치 범위

루트 source of truth 기준 변경을 설치 패키지 `merged/Auto-HUB_v1.1.1_build111`에 동기화했다. Debug Mode 모듈, Action slot 초기 렌더 보강, OPEN 폴더 안내 fallback, UI 스타일/아이콘 변경이 설치본에 포함된다.

## 확인 가능한 작업 범위

- Git commit: `08f9859` 이후 미커밋 작업 범위
- Git tag: 미생성
- 변경 범위: `index.js`, `index.html`, `manifest.json`, `src/`, `styles/`, `assets/icons/`, `docs/`, `merged/Auto-HUB_v1.1.1_build111/`
- 패키지 폴더: `merged/Auto-HUB_v1.1.1_build111`
- zip 파일: `merged/Auto-HUB_v1.1.1_build111.zip`

## 추가 기능

- Debug Mode 공통 모듈과 build fingerprint 이벤트 기반을 설치 패키지에 포함했다.
- Action 기본 빈 slot과 폴더 선택 안내 fallback 관련 루트 변경을 설치 패키지에 반영했다.
- 새 orange chevron 아이콘을 설치 패키지에 포함했다.

## 수정사항

- 2026-06-14: 루트 소스와 `merged/Auto-HUB_v1.1.1_build111` 패키지를 동기화했다.
- 2026-06-14: `src/core/debug/` 누락으로 UXP 초기화가 멈출 수 있는 패키지 구성 위험을 제거했다.

## 버그 수정

- 2026-06-14: 설치 패키지에 Debug Mode 모듈과 최신 UI 자산이 누락되어 루트 검증 결과와 설치본 동작이 달라질 수 있던 상태를 수정했다.

## 설치/업데이트 참고사항

- UXP Developer Tool에서 추가할 폴더: `merged/Auto-HUB_v1.1.1_build111`
- 기존 패널을 닫고 다시 열어야 하는지: 예, 기존 로드 패널을 reload 또는 remove 후 다시 add
- 기존 Action preset 유지 여부: 유지. 사용자 preset/settings 삭제 작업 없음
- 수동 제거가 필요한 이전 패키지: 없음. 다만 테스트 시 UXP Developer Tool이 루트와 이전 `merged/*` 중 어느 폴더를 로드 중인지 확인 필요

## 검증 결과

- 루트 정적 검증: 통과. `node --check`로 `index.js`, core/ui/debug JS 파일 확인
- 패키지 정적 검증: 통과. 패키지 내부 동일 JS 파일 `node --check` 확인
- manifest JSON 확인: 통과. 루트와 패키지 모두 JSON parse 성공
- 패키지 내부 구조 확인: 통과. `manifest.json`, `index.html`, `index.js`, `styles/`, `assets/`, `src/constants/`, `src/core/`, `src/core/debug/`, `src/ui/` 포함
- 앱 버전/빌드 번호 확인: 통과. `manifest.json` `1.1.1`, panel title `Auto-HUB v1.1.1 / build 111`, `BUILD_TOKEN` `v1.1.1-build111`, `packageBuildId` `build111`
- Photoshop UXP 설치 테스트: 미실행. Photoshop에서 수동 확인 필요
- ACTION 기본 slot / picker 테스트: 미실행. Photoshop에서 수동 확인 필요
- OPEN/SAVE 폴더 선택 테스트: 미실행. Photoshop에서 수동 확인 필요
- 1 test: 미실행. Photoshop에서 수동 확인 필요
- Run: 미실행. Photoshop에서 수동 확인 필요
- Debug UI 기본 비노출: 미실행. Photoshop에서 수동 확인 필요
- 체크섬: 최종 zip 외부 배포 메모에 기록한다. 패키지 내부 보고서에는 zip 체크섬을 넣지 않는다.
