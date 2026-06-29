# Auto-HUB Worklog

## 2026-06-29 - UXP 채널/릴리즈 빌드 가이드 정리본 추가

- 목적: 공통 가이드(`0_CommonGuides`)의 UXP 채널·dev 폴더 구조·릴리즈 빌드 기준을 프로젝트에서 바로 참조할 수 있게 정리했다.
- 변경: `docs/uxp-release-channel-guide.md` 신규 작성(채널 모델, 권장 id/표시명, 분리 대상, 산출물 구조, 버전 정책, 빌드 후 확인, 변경/릴리즈 리포트 차이, Auto-HUB 현황·갭). `CLAUDE.md` 프로젝트 문서 목록에 정리본과 공통 원문 경로를 추가하고, 구식 `../공통/docs/uxp/...` 링크를 `0_CommonGuides` 기준으로 교체.
- 발견(갭): 공통 최신 모델(doc 0006)은 `_Dev`(`.dev`)/QA 포터블(`.qa`)/`_Lab`(`.lab`) 별도 id를 권장하나, 현재 `dist/Auto-HUB-DevTools_v1.1.5_build006`은 Release와 동일한 plugin id `com.psautohub.panel`을 쓴다. Release와 동시 설치 시 업데이트 식별 충돌 위험이 있어 후속 결정 대상으로 문서에 명시했다.
- 결정: 이번 작업은 "일단 정리"용 참조 문서 추가까지만 한다. 채널 구조 실제 변경(id 분리, 데이터 경로 분리)은 별도 결정 후 진행한다.
- 검증: 문서/마크다운 변경만이라 `node --check` 대상 없음. 공통 원문 doc_version(0006/0003/0003)과 현재 manifest id/version 실태를 직접 확인해 정리했다.
- 남은 작업: 위 채널 id/데이터 분리 정식화 여부 결정.

## 2026-06-29 - AGENTS 작업 가이드 최신화

- 목적: `CLAUDE.md`에 반영된 최신 작업/빌드/패키지 기준을 Codex/agent용 `AGENTS.md`에도 맞췄다.
- 변경: 작업 원칙, `dist/*` source-of-truth 기준, v1.1.6 build007 버전 기준, sideload/.ccx 정책, Action 중단/slot 메모리, commit 규칙을 `AGENTS.md`에 추가·갱신했다.
- 결정: `merged/*` 기준은 과거 산출물 경로이므로 agent 문서에서는 현재 기준인 `dist/*`로 정리한다. `CLAUDE.md`와 실제 `manifest.json`/`index.js`/`dist/` 상태가 일치하는 것을 확인했다.
- 검증: 문서 변경만 수행해 `node --check` 대상 없음. `git diff`로 `AGENTS.md` 반영 범위 확인.
- 남은 작업: 없음.

## 2026-06-21 - v1.1.6 build007 설치 빌드 제작

- 목적: 패널 톤 재정비/폴더 행 아이콘화/액션 picker 폭 확장 + more Actions 노출 수정까지 누적된 루트 변경을 설치 가능한 빌드로 묶었다. 아이콘(접힘 패널 탭) 표시 이슈는 추후 처리로 분리.
- 변경(버전): 앱 버전 `v1.1.6`, 내부 빌드 `build007`로 올렸다. `manifest.json`, `index.js`(BUILD_TOKEN/appVersion/packageBuildId/주석), `index.html`, `docs/build-release-guide.md`, `docs/추가작업/debug-log-events.md`, `CLAUDE.md`, `RELEASE_REPORT.md` 동기화.
- 정리(아이콘 테스트 잔재): 디버깅용 주황 `panel-test-23/46.png`와 `@2x` 실험 파일을 제거하고, 패널 entrypoint 아이콘을 정상 설정(실제 `panel-icon-light/dark-23.png`, `scale:[1]`, 테마 쌍)으로 복원했다. root 아이콘도 `scale:[1]`로 통일.
- 결정(아이콘 처리 보류): 접힘 패널 탭 커스텀 아이콘 미표시는 진단 결과 manifest/파일 문제가 아니라 (1) UDT 로드 폴더와 편집 폴더 불일치 (2) 빈-네모 placeholder 아트 (3) UXP/PS 캐시·렌더 변수가 얽힌 cosmetic 이슈로 판단, 이번 빌드에서 제외하고 추후 실제 로고 작업 시 함께 처리한다.
- 빌드: 가이드 체크리스트대로 `node --check`(index.js, src/core/*, src/ui/*)·manifest parse 통과. `dist/Auto-HUB_v1.1.6_build007` 폴더 + zip 생성(.DS_Store/panel-test 미포함 확인), `uxp` CLI로 `.ccx` 생성(PS 27.7 검증 통과, manifest root 배치 확인).
- 검증/체크섬: zip `829a1cb1c49cda6c0a8a88ac8d7e372282e12408f686279593cb2eb2dfd177d0`, `.ccx` `35fb05028e500c170c6d196513b74415fcffd9a3863b09c338940cbef0c7f5a8`.
- 남은 작업: Photoshop 실기 확인(톤/폴더 아이콘/picker 폭, more Actions 노출, 1 test, Run). 접힘 패널 아이콘 cosmetic 처리.

## 2026-06-21 - 패널 비주얼 디자인 톤 재정비 + 폴더 행 아이콘화 + 액션 picker 폭 확장

- 목적: 구조는 유지하고 패널 전반의 톤/가독성을 정리했다. 색 계층 대비를 낮춰 "톤으로 구분되는 깔끔한 전문 패널" 방향으로 맞췄다.
- 변경(토큰): `styles/panel.css` 디자인 토큰 전반을 재조정했다. surface/text/accent 색을 깊은 차콜 기반으로 낮췄다가, 어두운 포인트들의 톤차가 심하다는 피드백으로 `--surface-base` 등 어두운 레이어를 다시 올렸다. 실행 버튼 영역·앱버전 푸터·섹션 토글 배경은 옆 탭(Lasso Auto Fill) 바탕톤(~`#464646`)에 근접하도록 맞췄다. 섹션 토글은 좌측 2px accent 보더 + uppercase 라벨로 정리했다.
- 변경(체크박스): 액션 행 체크박스 `:checked` 배경을 Run 버튼의 파란색(`--run-main` #3d7ec4)으로 통일했다. 기존 규칙을 뒤에서 덮어쓰면 UXP 시스템 스타일에 밀려 흰색으로 남아, 원본 `.action-checkbox:checked` 규칙 자체를 수정하고 `!important`로 강제했다.
- 결정(order 버튼): OPEN 옵션 줄의 `order` 라벨을 제거하고 `1>2` 토글 버튼만 남겼다. 버튼 등장/숨김 시 행 높이가 흔들리던 문제는, `display:none`→`flex` 토글이 레이아웃에서 요소를 제거하는 게 원인이었다. `visibility:hidden`으로 바꿔 자리를 항상 예약하도록 했다(HTML 초기값도 `hidden` 속성 → `style="visibility:hidden"`). `.btn-cross` 클래스를 떼어 `min-height:22px` 간섭도 제거했다.
- 결정(폴더 행 아이콘): OPEN/SAVE의 `Folder` 텍스트 라벨 4곳을 제거하고 path-btn을 전체 폭으로 넓혔다. Browse/Reset 버튼은 정사각 아이콘 버튼으로 바꿨다. 빈 path-btn에는 `::after` 블링킹 커서(`|`)를 넣었다.
- 결정(아이콘 렌더 방식): 폴더 아이콘은 `background:url()`+`background-size:contain` 방식이 UXP에서 표시되지 않았다. 검증된 `.icon-mask`(`background-color:currentColor` + `mask-image`) 방식으로 전환하니 정상 표시됐다 — icon-add/icon-close와 동일 패턴. 공통 `Ref/ps_uxp_icons/FolderBreadcrumb.svg`의 복잡한 18x18 path도 렌더 실패 요인이라, 단순 닫힌 폴더 path로 다시 그려 `assets/icons/folder.svg`에 넣었다. Reset 상태는 `close.svg` 마스크로 교체한다.
- 변경(액션 picker 폭): `src/ui/actionPresetPart.js` `positionPopup`에서 action picker 팝업을 세트 picker 왼쪽 끝~X 버튼 직전까지 펼치도록 했다. 긴 액션 이름이 잘리지 않게 하는 게 우선이라 세트 picker 영역(약 36%)을 팝업이 덮는 것을 허용한다.
- 변경(가독성): 빈 폴더 placeholder(`.path-btn.empty`)를 `--text-faint`→`--text-label`로, 앱버전 표시(`.panel-title`)를 검정(`#000000`)·6px에서 `--text-muted`·10px(`--font-meta`)로 올렸다.
- 검증: `node --check src/ui/actionPresetPart.js` 통과. 색/아이콘/picker 폭은 Photoshop UXP에서 수동 확인 필요.
- 남은 작업: 루트 소스만 수정한 상태다. `dist/*` 패키지 동기화와 Photoshop 실기 확인은 별도 릴리즈 작업으로 분리한다.

## 2026-06-20 - v1.1.5 build006: more Actions 노출 수정 + DevTools 채널 + .ccx CLI 빌드

- 목적: ACTION "more Actions" 노출 조건을 바로잡고, 앱 버전을 v1.1.5로 올려 메인/DevTools 두 설치본을 `.ccx`로 생성했다.
- 변경(UX): `src/ui/actionPresetPart.js` `render()`의 분류 기준을 `enabled` → `isFavoriteSlot`(활성+선택)로 바꾸고, 즐겨찾기 0개면 모든 슬롯을 인라인 표시하도록 수정했다. 최초 상태/선택 없음에서 more Actions가 뜨던 버그를 정리했다.
- 결정(UX): more Actions는 "즐겨찾기를 위로 모았을 때 남는 비즐겨찾기 슬롯"을 접는 영역으로 정의한다. 즐겨찾기가 없으면 접을 대상도 없으므로 그룹 자체를 만들지 않는다. 이 분기 로직은 be154dd(2026-06-02) 도입 후 처음 수정됐다.
- 변경(버전): `manifest.json`, `index.js`(BUILD_TOKEN/appVersion/packageBuildId/주석), `index.html`, `docs/build-release-guide.md`, `docs/추가작업/debug-log-events.md`, `CLAUDE.md`, `RELEASE_REPORT.md`를 `v1.1.5 / build006` 기준으로 동기화했다.
- 결정(빌드 폴더): 빌드 산출물 폴더를 `merged/` → `dist/`로 통일했다.
- 결정(Dev 채널): `dist/Auto-HUB-DevTools_v1.1.5_build006`는 별도 식별자(`id=com.psautohub.panel.dev`, name=`Auto-HUB DevTools`, label=`Auto-HUB Dev`, 패널 타이틀 `Auto-HUB Dev`)로, 메인과 공존 설치되는 테스트 채널이다. preset/storage는 메인과 분리된다.
- 빌드(.ccx): `uxp` CLI로 패키징했다. Apple Silicon이라 Rosetta + x86_64 node 18 필요, helper postinstall의 tar 누락은 수동 우회, 패키징은 UDT 서비스+Photoshop 실행 상태에서 `.git` 없는 `dist/<pkg>` 폴더에서 실행했다. 상세는 메모리 `uxp-ccx-build-apple-silicon`.
- 검증: `node --check`(index.js, actionPresetPart.js), manifest JSON parse, .ccx 내부 manifest 식별자/패널 아이콘 유지, 산출물 생성 확인. 체크섬 — 메인 `.ccx` `3bff946d7e4f00b2bf7541c2538076a3d9edf9b0bc76ab6bc058f27289db75ac`, DevTools `.ccx` `cd9f5417168003e8d1026894d4ed9bfd711ed1fba5b0bae0fdea5bc1dc239629`.
- 남은 작업: Photoshop에서 메인/DevTools 설치 후 more Actions 노출 조건과 접힘 패널 아이콘을 수동 확인. DevTools(새 id, 클린 설치)에서 아이콘이 정상이면 기존 아이콘 미표시는 캐시/재시작 이슈로 확정.

## 2026-06-20 - v1.1.4 build004 설치 패키지 제작

- 목적: 실행 버튼/OPEN-SAVE UI 보정, `1 test` 저장 경로 기준 수정, UXP 접힘 패널 아이콘 manifest 설정을 설치 테스트 가능한 패키지로 묶었다.
- 변경: 루트 앱 버전을 `Auto-HUB v1.1.4`, 내부 빌드를 `build004`로 올렸다. `manifest.json`, `index.html`, `index.js`, `docs/build-release-guide.md`, `docs/추가작업/debug-log-events.md`, `RELEASE_REPORT.md`를 새 빌드 기준으로 갱신했다. `merged/Auto-HUB_v1.1.4_build004` 폴더와 `merged/Auto-HUB_v1.1.4_build004.zip`을 생성했다.
- 결정: 이전 `merged/Auto-HUB_v1.1.3_build003` 설치본은 보존하고, 아이콘 확인 과정에서 임시로 동기화했던 v1.1.3 패키지 변경은 되돌렸다. 새 `icons/` 폴더는 루트와 v1.1.4 패키지에만 포함한다.
- 검증: 루트와 패키지에서 `node --check` 대상 JS 파일, manifest JSON parse, manifest icon path 존재, PNG 크기/alpha, zip 내용, `.DS_Store` 제외, `git diff --check`를 확인했다. zip sha256은 `fdb2985e9b28c15c7b31848943225f88d8e9e2a27248d6caa1285c110ee20b68`이다.
- 남은 작업: Photoshop UXP Developer Tool에서 `merged/Auto-HUB_v1.1.4_build004` 폴더를 로드해 접힘 패널 아이콘, 실행 버튼 섹션, ACTION/OPEN/SAVE 레이아웃, 1 test, Run을 수동 확인해야 한다.

## 2026-06-20 - 실행 버튼 섹션과 섹션 타이틀바 색상 조정

- 목적: 패널 상단의 `Cancel / 1 test / Run` 실행 버튼 섹션과 ACTION/OPEN/SAVE 타이틀바 시각 정렬을 사용자 기준에 맞췄다.
- 변경: 실행 버튼 섹션 배경만 Auto-HUB 탭톤 기준 `#535353`에서 하단 어두운 톤으로 흐르는 그라데이션으로 바꿨다. 상단 10%는 `#535353`로 고정하고 상단 1px 구분선을 제거해 탭에서 실행 버튼 섹션으로 이어져 보이게 했다. 실행 버튼과 `Add action` 버튼 기본 상태는 `#717171` 배경과 `#ffffff` 라벨로 맞추고, 준비/통과 상태 라벨도 흰색으로 정리했다. ACTION/OPEN/SAVE 타이틀 라벨은 화살표 아이콘을 제외하고 우측 정렬했으며, ACTION 타이틀바만 `1 test` 녹색 계열로 변경했다. 최하단 앱버전 표시 섹션은 `#424242` 바탕과 검정 버전 텍스트로 조정했다.
- 변경: OPEN의 Folder 1 표시 행과 `2Folder each1file` disclosure 라벨 사이 간격을 상태와 무관하게 고정했다. 펼침 상태에서 `1>2` 버튼을 새로 `display`하지 않고, 버튼 자리는 항상 예약한 뒤 `visibility`/pointer/focus 상태만 바꿔 disclosure 행의 top margin과 높이가 흔들리지 않도록 했다. `1>2` 버튼은 더 어두운 청회색 톤으로 낮추고, Folder 경로 표시창 오른쪽 끝선에 맞도록 버튼 래퍼의 오른쪽 정렬을 명시했다. OPEN 옵션 줄은 `Subfolders`를 폴더 선택창 왼쪽 끝선에 맞춘 왼쪽, `1Folder 2file`을 오른쪽으로 재배치했으며, `1>2`는 위 옵션 줄에서 제거하고 아래 disclosure 줄의 버튼을 `1Folder 2file`과 `2Folder each1file`이 공통으로 사용하게 했다.
- 변경: ACTION/OPEN/SAVE 섹션의 내용 전체 상단/하단 여백만 통일했다. 타이틀바와 내용 사이 상단 여백은 6px, 섹션 내용 하단 여백은 그 150%인 9px로 두고, 내용 요소들 사이 간격은 유지했다.
- 변경: Photoshop 접힘 탭에서 기본 placeholder 대신 Auto-HUB 아이콘이 쓰이도록 manifest `icons` 설정과 PNG 아이콘을 추가했다. 사용자 제공 `icon_simple-24.png`를 기준으로 top-level 플러그인 아이콘은 48px, 접힘 패널 탭 적용을 위한 `batchPanel` entrypoint 내부 panel icon은 23px으로 분리했다. 어두운 UI용은 원본 흰색 마크를 쓰고, 밝은 UI용은 같은 알파를 유지한 어두운 마크를 생성했다. Adobe manifest v5 예시 기준으로 panel icon의 어두운 UI theme에는 `darkest/dark/medium`을 포함하고, root icon에는 `species: ["generic"]`를 추가했다. 아이콘 전용 표시 여부는 Photoshop 도킹 영역 폭/상태가 최종 결정하므로, panel label은 메뉴 호환성을 위해 유지했다.
- 결정: 사용자 스크린샷 기준으로 루트에는 아이콘 설정이 있으나 `merged/Auto-HUB_v1.1.3_build003`에는 manifest `icons`와 icon 파일이 없어, UXP Developer Tool이 최신 merged 패키지를 로드하는 경우 기본 placeholder가 계속 보일 수 있었다. 루트 source of truth는 유지하되 개발자툴 테스트용으로 최신 merged 폴더에 manifest와 icon 파일을 동기화했다. zip 재생성은 하지 않았다.
- 남은 작업: Photoshop UXP에서 실제 패널 렌더링 시 실행 버튼 섹션 그라데이션과 ACTION/OPEN/SAVE 타이틀 라벨 위치를 수동 확인해야 한다.

## 2026-06-20 - 1test 저장 경로 기준과 실행 폴더 숫자화

- 목적: `1 test` 실행 시 저장 폴더를 지정했는데도 입력 폴더 기준으로 `1test_3`처럼 이어지는 문제를 정리했다.
- 변경: `1 test`는 저장 폴더가 지정된 경우 저장 경로를 기준으로 고정 `1test` 폴더를 만들거나 재사용하고, 그 내부 실행 폴더는 `1`, `2`, `3`처럼 숫자만 사용한다.
- 결정: 이 숫자 폴더 규칙은 `1 test` 전용 예외다. 일반 Run 출력은 기존 `Run_N` 정책을 유지한다.
- 검증: `node --check src/core/batchController.js` 통과.
- 남은 작업: Photoshop UXP에서 저장 폴더를 `1test`로 지정한 뒤 `1test/1` 형태로 생성되는지 수동 확인해야 한다.

## 2026-06-18 - v1.1.3 build003 설치 패키지 제작

- 목적: 미커밋 작업 범위와 추가 요청된 Run/1test 폴더명, UXP 패널 사이즈, 폴더 경로 표시 보정을 설치 가능한 패키지로 동기화했다.
- 변경: 루트 앱 버전을 `Auto-HUB v1.1.3`, 내부 빌드를 `build003`으로 올렸다. `manifest.json`, `index.html`, `index.js`, `docs/build-release-guide.md`, `docs/추가작업/debug-log-events.md`, `RELEASE_REPORT.md`를 새 빌드 기준으로 갱신했다. `merged/Auto-HUB_v1.1.3_build003` 폴더와 `merged/Auto-HUB_v1.1.3_build003.zip`을 생성했다.
- 결정: 기존 `merged/Auto-HUB_v1.1.1_build111`, `merged/Auto-HUB_v1.1.2_build002` 패키지는 보존하고, 새 설치본은 별도 폴더로 생성했다. 패키지 복사와 zip 생성 시 `.DS_Store`는 제외했다.
- 검증: 루트와 패키지에서 `node --check` 대상 JS 파일, manifest JSON parse, 패키지 구조, 루트/패키지 동기화, zip 내용 확인을 완료했다. zip sha256은 `b44bb277f74140b02177021a7ec667c44e203bc8266a59f0b4067a684fb17b57`이다.
- 남은 작업: Photoshop UXP Developer Tool에서 `merged/Auto-HUB_v1.1.3_build003` 폴더를 로드해 ACTION slot, picker, OPEN/SAVE 폴더 표시/아이콘, 1 test, Run, Debug UI 기본 비노출을 수동 검증해야 한다.

## 2026-06-18 - 폴더 선택 표시를 부모/현재 폴더로 축약

- 목적: 선택 폴더 표시가 긴 전체 경로로 밀리거나, 마지막 폴더명만 보여 구분이 어려운 문제를 줄였다.
- 변경: MergeSplit UXP 패널 방식을 참고해 OPEN/SAVE 폴더 표시를 마지막 2단계 경로로 축약한다. 예: `/A/B/Selected`는 `…/B/Selected`로 표시하고, tooltip/title에는 전체 경로를 유지한다.
- 결정: 폴더 entry 자체와 실행 payload는 변경하지 않고 표시 텍스트만 축약한다. 선택 후에도 오른쪽 폴더 버튼은 기존 `folder-plus` 추가 아이콘을 유지한다.
- 검증: `node --check src/ui/inputPart.js`, `node --check src/ui/outputPart.js` 통과. 아이콘 reset 전환 CSS 제거 확인.
- 남은 작업: Photoshop UXP에서 OPEN Folder 1/2, SAVE Folder 1/2 표시를 수동 확인해야 한다.

## 2026-06-18 - UXP 패널 manifest sizing 보정

- 목적: Photoshop 패널 도킹/겹침 시 가로폭과 최소 높이 제약이 과하게 잡히는 문제를 줄였다.
- 변경: 공통 UXP 문서 기준에 맞춰 `minimumSize`를 `260x120`으로 낮추고, 초기 표시 크기는 `preferredDockedSize 280x700`, `preferredFloatingSize 360x700`으로 분리했다.
- 결정: `minimumSize`는 원하는 초기 크기가 아니라 Photoshop 레이아웃 하한값으로 취급한다. 기존 `360x520` minimum과 `640` floating width는 과한 값으로 판단해 낮췄다.
- 검증: manifest JSON parse 통과. `minimumSize`, `preferredDockedSize`, `preferredFloatingSize` 값 확인 완료.
- 남은 작업: Photoshop UXP에서 docked/floating 최초 크기와 좁은 그룹 도킹 동작을 수동 확인해야 한다.

## 2026-06-18 - Run/1test 출력 폴더명 단순화

- 목적: 사용자 제보 기준으로 timestamp가 붙은 출력 폴더명이 Finder에서 길게 보이는 문제를 줄였다.
- 변경: Run 출력 폴더는 `Run_N`, 1test 출력 폴더는 고정 `1test` 루트 아래 `1test_N` 형식으로 생성한다. 기존 같은 prefix 폴더 중 가장 큰 번호 다음 번호를 사용한다.
- 결정: 액션 실행, 저장, PSD/PSB fallback, 파일 충돌 번호 정책은 유지하고 생성 폴더명 정책만 변경한다. 기존 timestamp 폴더는 보존하며 새 번호 산정에는 새 단순 이름 패턴만 사용한다.
- 검증: `node --check src/core/batchController.js`, `node --check src/core/runPlan.js`, `node --check src/core/saveHandler.js` 통과.
- 남은 작업: Photoshop UXP에서 Run, 1 test, Save Copy/Save Folder 출력 폴더 생성명을 수동 확인해야 한다.

## 2026-06-15 - v1.1.2 build002 설치 패키지 제작

- 목적: 2026-06-14~15 UI/UX 수정 사항을 설치 가능한 패키지로 동기화했다.
- 변경: 루트 앱 버전을 `Auto-HUB v1.1.2`로 올리고 내부 빌드를 `build002`로 정정했다. `manifest.json`, `index.html`, `index.js`, `docs/build-release-guide.md`, `docs/추가작업/debug-log-events.md`, `RELEASE_REPORT.md`를 새 빌드 기준으로 갱신했다. `merged/Auto-HUB_v1.1.2_build002` 폴더와 `merged/Auto-HUB_v1.1.2_build002.zip`을 생성했다.
- 결정: 기존 `merged/Auto-HUB_v1.1.1_build111` 패키지는 보존하고, 새 설치본은 별도 폴더로 생성했다. 패키지 복사 시 `.DS_Store`는 제외했다.
- 결정: `build112`는 버전 숫자를 빌드 번호처럼 이어붙인 잘못된 표기이므로 실제 설치 빌드 횟수 기준인 `build002`로 교정한다. 앱 UI에는 빌드 번호를 표시하지 않고 앱 버전만 표시한다.
- 검증: 루트와 패키지에서 `node --check` 대상 JS 파일, manifest JSON parse, 패키지 구조, 버전/빌드 토큰, zip 내용 확인을 완료했다. zip sha256은 `42e7bbbacd418edd6d72cab3fe9701014c62f1a2e7b55075965adea423405a1a`이다.
- 남은 작업: Photoshop UXP Developer Tool에서 `merged/Auto-HUB_v1.1.2_build002` 폴더를 로드해 ACTION slot, picker, OPEN/SAVE 폴더 UI, 1 test, Run, Debug UI 기본 비노출을 수동 검증해야 한다.

## 2026-06-14 - 초기 패널 크기와 SAVE 슬롯 아이콘 표시

- 목적: 최초 로딩 시 floating 패널이 너무 작아 주요 내용이 잘리고, SAVE의 Folder 1 슬롯 아이콘이 Folder 2 접힘 상태에서도 남는 문제를 정리했다.
- 변경: 루트 manifest의 최소/기본 패널 크기를 키우고 `preferredFloatingSize`를 추가했다. SAVE Folder 1/2 슬롯 아이콘은 정적 HTML 요소를 유지하되 `outputPart` 렌더에서 Folder 2 펼침 상태에 따라 표시/숨김을 직접 제어하도록 바꿨다. SAVE의 Folder 2 disclosure는 OPEN 2Folder 상태를 뒤집지 않고 SAVE 자체 펼침 상태만 토글하도록 분리했다.
- 변경: SAVE의 Folder 1/2 행 간격을 전역 row 규칙과 분리해 압축했다. Folder disclosure의 상단 padding과 disclosure content padding을 줄여 1/2 폴더 묶음이 더 타이트하게 보이도록 했다.
- 변경: SAVE Folder 2는 OPEN의 `2Folder each1file`이 펼쳐진 상태에서만 열고 닫을 수 있도록 availability 조건을 추가했다. OPEN Folder 2가 새로 켜질 때는 SAVE Folder 2를 자동으로 펼치고, OPEN Folder 2가 꺼지면 SAVE Folder 2를 닫고 실행 payload에서도 `saveFolder2`를 제외한다.
- 변경: OPEN 레이아웃을 조정해 `1>2`, `1Folder 2file`, `Subfolders` 컨트롤을 Folder 1 입력 위로 올리고, Folder 2 disclosure 줄에도 같은 `1>2` 순서 버튼을 배치했다. 두 순서 버튼은 같은 상태와 클릭 동작을 공유한다.
- 변경: OPEN 내부 세로 여백을 압축했다. 상단 옵션 줄 padding, Folder 1/Folder 2 disclosure 사이 margin, disclosure 자체 padding/min-height, Folder 2 content padding을 줄이고 두 `1>2` 버튼 스타일 selector를 통일했다.
- 변경: OPEN 상단 옵션 줄을 오른쪽 정렬로 바꿨다. 상단 `1>2`는 `1Folder 2file` 체크 상태에서만 표시하고, Folder 2 disclosure 줄의 `1>2`는 `2Folder each1file`이 펼쳐진 상태에서만 표시하도록 조건을 분리했다.
- 변경: `1>2` 래퍼에 남아 있던 인라인 `visibility:hidden`을 제거하고, 렌더에서 `display`와 `visibility`를 함께 정리한다. 조건이 맞아도 버튼이 보이지 않는 UXP/DOM 상태 불일치를 피하기 위한 조치다.
- 변경: 상단 `1>2`가 표시될 때 레이아웃이 깨지지 않도록 `1Folder 2file` 라벨 뒤에 버튼을 배치하고, OPEN 옵션 줄 항목은 shrink되지 않는 오른쪽 정렬 그룹으로 고정했다.
- 변경: 상단 `1>2` 표시 시 OPEN 옵션 줄 높이가 늘어나지 않도록 row 높이와 버튼 box-sizing/max-height를 고정했다. 가로 배치는 유지하고 세로 높이 변화만 막는다.
- 변경: Folder 2 disclosure 줄의 `1>2` 버튼은 폴더 선택 입력칸 오른쪽 끝과 같은 열에 맞도록, 폴더 아이콘 버튼 폭만큼 오른쪽 여백을 예약했다.
- 결정: UXP에서 동적 이미지 DOM 생성 시 Photoshop 종료가 발생한 이력이 있어, 이번에도 DOM 생성/삭제 없이 기존 요소의 style/class/hidden 상태만 변경한다. `merged/*`는 산출물이므로 루트 source of truth만 수정했다.
- 검증: `node --check index.js`, `node --check src/ui/outputPart.js`, manifest JSON parse를 통과했다.
- 남은 작업: Photoshop UXP에서 패널을 닫았다 다시 열거나 플러그인을 리로드해 최초 크기와 SAVE Folder 2 접힘/펼침 아이콘 표시를 수동 확인해야 한다.

## 2026-06-14 - 폴더 아이콘 버튼 표시 보강

- 목적: 폴더 선택 버튼에서 버튼 박스는 보이지만 폴더 아이콘이 비어 보이는 사용자 제보를 확인했다.
- 변경: 루트 소스의 OPEN/SAVE 폴더 컨트롤을 단일 `folder-state-icon` 구조로 맞추고, SAVE 렌더가 아이콘을 `Browse/Reset` 텍스트로 덮어쓰지 않도록 조정했다. 폴더 기본 아이콘은 사용자 제공 투명 PNG `assets/icons/folder-plus.png`를 `<img>`로 표시하고, reset 상태는 CSS 선 아이콘으로 표시한다. 2Folder 모드에서는 OPEN Folder 1/2 입력칸 앞에 정적 HTML로 둔 `folder-slot-1.png`, `folder-slot-2.png` 식별 아이콘을 클래스 토글로 표시한다. SAVE Folder 1/2 슬롯 아이콘은 UXP 클래스 반영 불안정을 피하기 위해 정적 표시한다. 슬롯 아이콘 크기는 24px로 맞췄다. 전체 패널 스크롤 영역에서 빈 하단 스크롤/그립처럼 보일 수 있는 `scrollbar-gutter` 고정 예약을 제거했다.
- 결정: Photoshop이 2Folder 펼침 시 종료되어, native button 내부에 `<img>`나 `<span>`을 동적으로 생성하는 방식은 UXP에서 금지한다. 펼침/접힘 렌더는 DOM 생성/삭제 대신 기존 요소의 class/hidden/text 상태만 변경한다.
- 결정: 폴더 아이콘이 native `button` 내부에서 계속 비는 증상이 있어, 작은 폴더 아이콘 컨트롤만 `div[role="button"]`로 바꿔 UXP 버튼 렌더러와의 충돌 가능성을 피했다. `merged/*`는 산출물이므로 이번 수정은 루트 source of truth에만 적용했다. UXP Developer Tool이 기존 `merged/Auto-HUB_v1.1.1_build111` 패키지를 로드 중이면 패키지 동기화 전까지 루트 수정이 보이지 않는다.
- 검증: `node --check src/ui/inputPart.js`, `node --check src/ui/outputPart.js`. 임시 localhost 미리보기에서 폴더 아이콘 요소가 실제 15x13 크기와 border를 갖고 표시되는 것을 확인했다.
- 남은 작업: Photoshop UXP에서 루트 또는 재동기화된 패키지로 OPEN/SAVE 폴더 아이콘과 reset 상태를 수동 확인해야 한다.

## 2026-06-14 - v1.1.1 build111 설치 패키지 제작

- 목적: build/release 규칙에 맞춰 루트 source of truth를 설치 패키지로 동기화하고 배포 가능한 zip을 만들었다.
- 변경: `merged/Auto-HUB_v1.1.1_build111`에 `manifest.json`, `index.html`, `index.js`, `styles/`, `assets/`, `src/`를 재동기화했고 `src/core/debug/`와 orange chevron 아이콘 누락을 해소했다. `RELEASE_REPORT.md`를 루트와 패키지에 추가하고 `merged/Auto-HUB_v1.1.1_build111.zip`을 생성했다.
- 결정: 사용자 preset/settings와 이전 `merged/*` 백업은 건드리지 않았다. 이번 설치본은 기존 문서 기준인 `Auto-HUB v1.1.1 / build 111` 토큰을 유지한다.
- 검증: 루트와 패키지 JS `node --check`, manifest JSON parse, 루트/패키지 파일 목록 및 내용 비교, zip 내용 확인을 완료했다. zip sha256은 `5496913da4de0396c3a137eba2122e69356d7290cbfec56a24ff6b9c9746e2ba`이다.
- 남은 작업: Photoshop UXP Developer Tool에서 `merged/Auto-HUB_v1.1.1_build111` 폴더를 로드해 ACTION slot, picker, OPEN/SAVE, 1 test, Run, Debug UI 기본 비노출을 수동 검증해야 한다.

## 2026-06-14 - Action 초기 표시와 패키지 동기화 이슈 정리

- 목적: 최초 실행 시 ACTION 기본 슬롯, OPEN 폴더 안내, accordion이 동작하지 않는 증상을 분리했다.
- 변경: 루트 기준으로 Action slot 초기 렌더를 catalog refresh 전에 수행하도록 보강했고, 폴더 빈 상태 HTML fallback을 `폴더 선택`으로 맞췄다. Debug 모듈 require는 UXP 호환성을 위해 `./src/core/debug/index` 명시 경로로 바꿨다.
- 결정: 증상이 ACTION/OPEN/accordion 전체에 동시에 나타나면 CSS 레이아웃 문제보다 JS 초기화 중단을 먼저 의심한다.
- 검증: `node --check index.js`, `node --check src/ui/actionPresetPart.js`, `require('./src/core/debug/index')` 로드 확인.
- 남은 작업: Photoshop UXP에서 실제 패널 리로드 검증이 필요하다. `merged/Auto-HUB_v1.1.1_build111` 패키지는 루트 변경과 아직 동기화되지 않았다.

## 2026-06-14 - Action slot과 more Actions 표시 기준 정리

- 목적: 최초 실행에서 `more Actions`가 표시되고 기본 빈 슬롯이 보이지 않는 문제를 정리했다.
- 변경: 즐겨찾기 slot이 없으면 `more Actions`를 렌더하지 않고 기본 빈 slot 1개를 메인에 표시하도록 렌더 기준을 바꿨다.
- 결정: `more Actions` 표시 기준은 “즐겨찾기 1개 이상 + 추가 slot 1개 이상”이다. 즐겨찾기 0개 상태에서는 접힌 `more Actions`도 존재하지 않는다.
- 검증: `node --check src/ui/actionPresetPart.js`.
- 남은 작업: Reset All을 `Reset Slots`와 `Refresh Actions`로 분리하는 UI/UX 재정의가 남아 있다.

## 2026-06-12 - Debug Mode 공통 인프라 도입

- 목적: 사용자 제보, 지원 분석, 개발자 추적을 같은 데이터 흐름으로 처리하는 Debug Mode를 추가했다.
- 변경: `src/core/debug/` 모듈, numeric debug level, raw/display buffer 분리, redaction, raw copy 기반을 루트 소스에 추가했다.
- 결정: Debug UI는 배포 빌드에서 기본 비노출이며, raw log는 장기 저장하지 않는다.
- 검증: 관련 JS 파일 `node --check`, debug redaction smoke test.
- 남은 작업: UXP 패널 수동 검증과 `merged/*` 패키지 동기화가 필요하다.
