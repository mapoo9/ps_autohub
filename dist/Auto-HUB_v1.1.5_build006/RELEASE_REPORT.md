# Auto-HUB v1.1.5 / build 006 릴리즈 보고서

릴리즈 날짜: 2026-06-20

## 패치 범위

앱 버전을 `v1.1.5`, 내부 빌드를 `build 006`으로 올린 설치본이다. ACTION의 "more Actions" 노출 조건을 수정해, 즐겨찾기(활성+선택)가 없을 때(최초 상태/선택 없음) more Actions 그룹이 뜨지 않도록 했다. 빌드 산출물 폴더 기준은 `dist/`다.

## 확인 가능한 작업 범위

- Git commit: 미커밋 작업 범위
- Git tag: 미생성
- 변경 범위: `manifest.json`, `index.html`, `index.js`, `src/ui/actionPresetPart.js`, `docs/`, `CLAUDE.md`, `dist/Auto-HUB_v1.1.5_build006/`
- 패키지 폴더: `dist/Auto-HUB_v1.1.5_build006`
- zip 파일: `dist/Auto-HUB_v1.1.5_build006.zip`
- `.ccx`: `dist/Auto-HUB_v1.1.5_build006.ccx`

## 추가 기능

- (없음) 기능 추가 없이 동작 보정과 버전 상승 중심.

## 수정사항

- 2026-06-20: ACTION "more Actions" 노출 분류 기준을 `enabled` → `isFavoriteSlot`(활성+선택)로 변경하고, 즐겨찾기가 0개면 모든 슬롯을 인라인 표시하도록 했다. 최초 상태/선택 없음에서 more Actions가 뜨던 문제를 정리했다.
- 2026-06-20: 앱 버전을 `v1.1.5`, 내부 빌드를 `build 006`으로 올렸다.
- 2026-06-20: 빌드 산출물 폴더를 `merged/`에서 `dist/`로 변경하고 빌드 가이드/템플릿/보고서 경로를 정리했다. (build005)
- 2026-06-20: 앱 버전을 `v1.1.4`, 내부 빌드를 `build 004`로 올렸다.
- 2026-06-20: 실행 버튼 섹션, ACTION/OPEN/SAVE 타이틀바, OPEN/SAVE 섹션 여백과 버튼 색상을 조정했다.
- 2026-06-20: OPEN `1Folder 2file`과 `2Folder each1file`이 공통 `1>2` 버튼을 쓰도록 정리하고, disclosure 행 간격을 고정했다.
- 2026-06-18: 앱 버전을 `v1.1.3`, 내부 빌드를 `build 003`으로 올렸다.
- 2026-06-18: Run 출력 폴더는 `Run_N`, 1test 출력 폴더는 `1test/1test_N` 형식으로 생성되도록 단순화했다.

## 버그 수정

- 2026-06-20: 최초 로딩 등 즐겨찾기가 없는 상태에서 빈 슬롯이 "more Actions (1)"로 잘못 묶여 표시되던 문제를 수정했다.
- 2026-06-20: `1 test` 저장 폴더가 지정된 경우 저장 경로 기준의 고정 `1test` 루트와 숫자 실행 폴더를 쓰도록 수정했다. (build004)
- 2026-06-20: UXP Developer Tool에서 접힌 패널 탭이 기본 placeholder로 보일 수 있도록 만든 panel/root 아이콘 manifest 누락과 theme 매칭을 보강했다. (build004)

## 설치/업데이트 참고사항

- UXP Developer Tool에서 추가할 폴더: `dist/Auto-HUB_v1.1.5_build006`
- `.ccx` 더블클릭 설치본은 manifest `id`(`com.psautohub.panel`) 기준으로 기존 1.1.4 설치를 업데이트한다.
- 기존 패널을 닫고 다시 열어야 하는지: 예. 접힘 패널 아이콘 변경 확인은 Photoshop 완전 종료 후 재실행 권장.
- 기존 Action preset 유지 여부: 유지. 사용자 preset/settings 삭제 작업 없음
- 수동 제거가 필요한 이전 패키지: 없음

## 검증 결과

- 루트 정적 검증: `node --check`와 manifest JSON parse로 확인
- 패키지 내부 구조 확인: `manifest.json`, `index.html`, `index.js`, `styles/`, `assets/`, `src/constants/`, `src/core/`, `src/core/debug/`, `src/ui/` 포함 여부 확인
- 앱 버전/빌드 번호 확인: `manifest.json` `1.1.5`, panel title `Auto-HUB v1.1.5`, `BUILD_TOKEN` `v1.1.5-build006`, `packageBuildId` `build006`
- Photoshop UXP 설치 테스트: 미실행. Photoshop에서 수동 확인 필요
- ACTION more Actions 노출 조건 테스트: 미실행. Photoshop에서 수동 확인 필요
- 체크섬: 최종 zip/.ccx 외부 배포 메모와 작업 로그에 기록한다.
