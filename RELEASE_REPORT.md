# Auto-HUB v1.1.4 / build 004 릴리즈 보고서

릴리즈 날짜: 2026-06-20

## 패치 범위

루트 source of truth 기준 변경을 설치 패키지 `merged/Auto-HUB_v1.1.4_build004`에 동기화한다. 이번 설치본은 실행 버튼/ACTION·OPEN·SAVE 패널 레이아웃 보정, OPEN 1>2 공통 버튼 정렬, 1 test 저장 폴더 기준 수정, UXP 접힘 패널 아이콘 manifest 설정을 포함한다.

## 확인 가능한 작업 범위

- Git commit: 이번 릴리즈 커밋
- Git tag: 미생성
- 변경 범위: `manifest.json`, `index.html`, `index.js`, `styles/`, `assets/`, `src/`, `icons/`, `docs/`, `merged/Auto-HUB_v1.1.4_build004/`
- 패키지 폴더: `merged/Auto-HUB_v1.1.4_build004`
- zip 파일: `merged/Auto-HUB_v1.1.4_build004.zip`

## 추가 기능

- Debug Mode 공통 모듈과 build fingerprint 이벤트 기반을 설치 패키지에 포함했다.
- OPEN/SAVE 폴더 선택 버튼에 정적 PNG 기반 폴더 아이콘과 reset 상태 표시를 포함했다.
- OPEN/SAVE Folder 1/2 식별용 슬롯 아이콘을 포함했다.
- UXP 접힘 패널 탭과 플러그인 목록용 Auto-HUB 아이콘 PNG를 포함했다.

## 수정사항

- 2026-06-20: 앱 버전을 `v1.1.4`, 내부 빌드를 `build 004`로 올렸다.
- 2026-06-20: 실행 버튼 섹션, ACTION/OPEN/SAVE 타이틀바, OPEN/SAVE 섹션 여백과 버튼 색상을 조정했다.
- 2026-06-20: OPEN `1Folder 2file`과 `2Folder each1file`이 공통 `1>2` 버튼을 쓰도록 정리하고, disclosure 행 간격을 고정했다.
- 2026-06-18: 앱 버전을 `v1.1.3`, 내부 빌드를 `build 003`으로 올렸다.
- 2026-06-18: Run 출력 폴더는 `Run_N`, 1test 출력 폴더는 `1test/1test_N` 형식으로 생성되도록 단순화했다. 기존 같은 prefix 폴더 중 가장 큰 번호 다음 번호를 사용한다.
- 2026-06-18: UXP 공통 문서 기준에 맞춰 패널 `minimumSize`를 `260x120`으로 낮추고, 초기 표시 크기를 `preferredDockedSize 280x700`, `preferredFloatingSize 360x700`으로 분리했다.
- 2026-06-15: OPEN 옵션 줄과 Folder 1/2 행 레이아웃을 조정하고, `1>2` 버튼 표시 조건과 정렬을 정리했다.
- 2026-06-15: SAVE Folder 2는 OPEN `2Folder each1file`이 펼쳐진 상태에서만 열고 닫을 수 있도록 조건을 분리했다.
- 2026-06-15: SAVE Folder 1/2 행 간격과 OPEN 내부 세로 간격을 압축했다.

## 버그 수정

- 2026-06-20: `1 test` 저장 폴더가 지정된 경우 저장 경로 기준의 고정 `1test` 루트와 숫자 실행 폴더를 쓰도록 수정했다.
- 2026-06-20: UXP Developer Tool에서 접힌 패널 탭이 기본 placeholder로 보일 수 있도록 만든 panel/root 아이콘 manifest 누락과 theme 매칭을 보강했다.
- 2026-06-18: timestamp가 붙은 긴 출력 폴더명 대신 짧은 번호형 폴더명을 사용하도록 수정했다.
- 2026-06-18: `minimumSize`를 초기 표시 크기처럼 크게 잡아 Photoshop 도킹/겹침 레이아웃이 불안정해질 수 있던 설정을 보정했다.
- 2026-06-15: native `button` 내부 이미지 렌더 충돌 가능성을 피하기 위해 폴더 아이콘 버튼을 정적 `div[role="button"]` 구조로 유지했다.
- 2026-06-15: `1>2` 래퍼에 남아 있던 `visibility:hidden` 상태로 버튼이 표시되지 않던 문제를 수정했다.
- 2026-06-15: SAVE Folder 2를 접은 상태에서도 `saveFolder2`가 실행 payload에 남을 수 있는 혼선을 방지했다.

## 설치/업데이트 참고사항

- UXP Developer Tool에서 추가할 폴더: `merged/Auto-HUB_v1.1.4_build004`
- 기존 패널을 닫고 다시 열어야 하는지: 예, 기존 로드 패널을 reload 또는 remove 후 다시 add
- 기존 Action preset 유지 여부: 유지. 사용자 preset/settings 삭제 작업 없음
- 수동 제거가 필요한 이전 패키지: 없음. 다만 테스트 시 UXP Developer Tool이 루트와 이전 `merged/*` 중 어느 폴더를 로드 중인지 확인 필요

## 검증 결과

- 루트 정적 검증: 패키지 생성 전 `node --check`와 manifest JSON parse로 확인
- 패키지 정적 검증: 패키지 생성 후 `node --check`와 manifest JSON parse로 확인
- 패키지 내부 구조 확인: `manifest.json`, `index.html`, `index.js`, `styles/`, `assets/`, `src/constants/`, `src/core/`, `src/core/debug/`, `src/ui/` 포함 여부 확인
- 앱 버전/빌드 번호 확인: `manifest.json` `1.1.4`, panel title `Auto-HUB v1.1.4`, `BUILD_TOKEN` `v1.1.4-build004`, `packageBuildId` `build004`
- Photoshop UXP 설치 테스트: 미실행. Photoshop에서 수동 확인 필요
- ACTION 기본 slot / picker 테스트: 미실행. Photoshop에서 수동 확인 필요
- OPEN/SAVE 폴더 선택 테스트: 미실행. Photoshop에서 수동 확인 필요
- 1 test: 미실행. Photoshop에서 수동 확인 필요
- Run: 미실행. Photoshop에서 수동 확인 필요
- Debug UI 기본 비노출: 미실행. Photoshop에서 수동 확인 필요
- 체크섬: 최종 zip 외부 배포 메모와 작업 로그에 기록한다. 패키지 내부 보고서에는 zip 체크섬을 넣지 않는다.
