# Auto-HUB Build And Release Guide

작성일: 2026-06-14

## 현재 기준

- Product name: `Auto-HUB`
- App version: `1.1.6`
- Display version: `v1.1.6`
- Build label: `build 007`
- Internal build token: `v1.1.6-build007`
- Install package folder: `dist/Auto-HUB_v1.1.6_build007`
- Source of truth: repository root

루트 소스가 개발 기준이고, `dist/*`는 설치/배포 산출물로 취급한다. Photoshop UXP Developer Tool이 어느 폴더를 로드 중인지에 따라 테스트 결과가 달라질 수 있다.

## 빌드 경로와 설치 형식

자동 빌드 스크립트는 없다. 현재는 루트 소스를 패키지 폴더로 복사하고 zip으로 묶는 수동 패키징이다.

빌드 산출물 위치는 항상 리포 루트의 `dist/` 아래다.

```text
PS-AutoHUB/
└── dist/
    ├── Auto-HUB_vX.Y.Z_buildNNN/      # 루트 소스 복사본 + RELEASE_REPORT.md
    └── Auto-HUB_vX.Y.Z_buildNNN.zip   # 같은 폴더를 압축한 배포 zip
```

- 산출물은 `dist/` 밖이나 루트에 직접 만들지 않는다.
- 패키지 폴더 내용은 루트 소스 전체(`manifest.json`, `index.html`, `index.js`, `styles/`, `assets/`, `src/`, `icons/`)와 `RELEASE_REPORT.md`다.
- `dist/old backup/`은 과거 설치본 보관용이며 새 빌드 대상이 아니다.

설치 형식은 두 가지로 나눈다.

- 현재 방식: 폴더/zip + UXP Developer Tool `Add Plugin` 로드(개발자 sideload). 사용자가 받은 zip을 풀어 폴더를 UDT에 추가한다. 서명·CC 데스크톱이 필요 없고, 업데이트는 폴더 교체 후 reload 또는 remove/add로 처리한다.
- 표준 정식 배포 형식: `.ccx`. UXP 플러그인의 일반 사용자 배포 포맷이며 UDT `Package` 또는 `uxp plugin package`로 생성한다. 더블클릭하면 Adobe UPIA가 설치하고, manifest `id`(`com.psautohub.panel`) 기준으로 자동 업데이트한다. 사용자 쪽에 Creative Cloud Desktop 또는 UnifiedPluginInstallerAgent가 필요하다.

### `.ccx` 빌드 절차 (Apple Silicon, 검증됨)

`uxp` CLI로 정식 `.ccx`를 만든다. Apple Silicon에서는 함정이 많아 아래 순서를 그대로 따른다. 자세한 배경은 메모리 `uxp-ccx-build-apple-silicon` 참고.

선행 조건: UXP Developer Tools 앱 실행(서비스 포트 14001 제공) + Photoshop 실행(패키징이 연결 앱으로 검증함).

1. x86_64 node로 CLI 준비 (1회). helper 네이티브 모듈이 x86_64 전용이라 Rosetta 필요.

```sh
arch -x86_64 /bin/zsh -c 'export NVM_DIR="$HOME/.nvm"; source "$NVM_DIR/nvm.sh"; nvm install 18; nvm use 18; npm i -g @adobe/uxp-devtools-cli --ignore-scripts'
# postinstall의 tar 누락 우회: helper에 tar 넣고 setup 직접 실행
H="$HOME/.nvm/versions/node/v18.20.8/lib/node_modules/@adobe/uxp-devtools-cli/node_modules/@adobe/uxp-devtools-helper"
arch -x86_64 /bin/zsh -c "export NVM_DIR=\$HOME/.nvm; source \$NVM_DIR/nvm.sh; nvm use 18; cd $H && npm i tar@6 --no-save && node scripts/devtools_setup.js"
```

2. `.git`이 없는 깨끗한 패키지 폴더에서 패키징(루트에서 하면 `.git/fsmonitor` 소켓에서 크래시).

```sh
arch -x86_64 /bin/zsh -c 'export NVM_DIR="$HOME/.nvm"; source "$NVM_DIR/nvm.sh"; nvm use 18; cd dist/Auto-HUB_vX.Y.Z_buildNNN && uxp plugin package --outputPath "$PWD/.."'
```

3. 산출물 `com.psautohub.panel_PS.ccx`를 규칙명으로 rename.

```sh
mv dist/com.psautohub.panel_PS.ccx dist/Auto-HUB_vX.Y.Z_buildNNN.ccx
```

`.ccx`는 더블클릭 설치(UPIA/Creative Cloud Desktop 필요)용 정식 배포본이다. sideload zip은 CC 없이 UDT 로드용으로 함께 둔다.

UXP 패널 빌드 형식의 공통 기준은 `공통/docs/uxp/uxp-panel-build-guide.md`를 따른다.

## 버전 체계

Auto-HUB는 앱 버전과 빌드 번호를 분리한다.

```text
앱 버전: MAJOR.MINOR.PATCH
빌드 번호: buildNNN
앱 표시 예시: Auto-HUB v1.1.6
내부 토큰: v1.1.6-build007
패키지 폴더: Auto-HUB_v1.1.6_build007
```

기본 정책:

- 설치본을 만들면 `PATCH`와 `BUILD`를 함께 올린다.
- `PATCH`는 설치 빌드 시 자동 증가한다.
- `BUILD`는 설치 빌드 시에만 증가한다.
- `MINOR` 또는 `MAJOR`는 사용자 요청 또는 명시적인 릴리즈 결정이 있을 때만 증가한다.
- 앱 UI와 일반 사용자에게 보이는 표기는 앱 버전만 표시한다. 빌드 번호는 Debug/지원 로그, 릴리즈 보고서, 패키지 폴더명, zip 파일명 등 내부 추적용으로만 사용한다.
- 로컬 확인용 임시 빌드는 버전 증가 없이 가능하지만 배포용 패키지와 섞지 않는다.

## 업데이트 위치

버전 또는 빌드 번호를 올릴 때 확인할 위치:

- [manifest.json](/Users/kisoon/Documents/0_vibeCoding/PS-AutoHUB/manifest.json): `version`
- [index.js](/Users/kisoon/Documents/0_vibeCoding/PS-AutoHUB/index.js): header comment, `BUILD_TOKEN`, `BUILD_FINGERPRINT.appVersion`, `BUILD_FINGERPRINT.packageBuildId`
- [index.html](/Users/kisoon/Documents/0_vibeCoding/PS-AutoHUB/index.html): panel title에는 앱 버전만 표시
- [docs/추가작업/debug-log-events.md](/Users/kisoon/Documents/0_vibeCoding/PS-AutoHUB/docs/추가작업/debug-log-events.md): 대상 빌드
- 설치 패키지 폴더명: `dist/Auto-HUB_vX.Y.Z_buildNNN`
- 릴리즈 보고서: `RELEASE_REPORT.md`

앱 표시 버전과 진단 로그의 내부 빌드 토큰은 항상 같은 설치본을 가리켜야 한다.

## 루트와 dist 패키지

루트:

- 개발 source of truth
- Codex가 기본적으로 수정하는 위치
- 빠른 UXP 테스트 대상이 될 수 있음

`dist/Auto-HUB_vX.Y.Z_buildNNN`:

- 설치/배포용 패키지 산출물
- 사용자가 UXP Developer Tool에 추가할 수 있는 폴더
- 루트 변경이 자동 반영되지 않음

주의:

- 루트에 새 파일이나 새 폴더를 추가했으면 패키지에도 복사되어야 한다.
- 특히 `src/core/debug/`처럼 새 모듈 폴더가 누락되면 UXP에서 `index.js` 초기화가 멈출 수 있다.
- ACTION slot, OPEN placeholder, accordion이 모두 동작하지 않으면 먼저 로드 중인 폴더와 패키지 동기화 상태를 확인한다.

## 패키지 생성 체크리스트

릴리즈 또는 설치 테스트 전에 확인한다.

1. 루트 정적 검증을 실행한다.

```sh
node --check index.js
node --check src/core/batchController.js
node --check src/core/fileScanner.js
node --check src/core/saveHandler.js
node --check src/core/runPlan.js
node --check src/ui/actionPresetPart.js
node --check src/ui/inputPart.js
node --check src/ui/outputPart.js
```

2. `manifest.json`이 JSON으로 파싱되는지 확인한다.

3. 패키지 폴더가 루트와 동기화되었는지 확인한다.

필수 포함:

- `manifest.json`
- `index.html`
- `index.js`
- `styles/`
- `assets/`
- `src/constants/`
- `src/core/`
- `src/core/debug/`
- `src/ui/`

4. UXP Developer Tool에서 테스트 대상 폴더를 명확히 한다.

- 개발 확인: repo root 또는 명시한 dev target
- 설치 확인: `dist/Auto-HUB_vX.Y.Z_buildNNN`

5. Photoshop에서 패널을 리로드하고 기본 흐름을 확인한다.

- accordion 접기/펼치기
- ACTION 기본 빈 slot 표시
- Action Set / Action picker 열기
- OPEN 폴더 선택 안내 표시
- 1 test
- Run
- Debug UI 기본 비노출

## 릴리즈 보고서

설치본을 외부 공유할 때는 [release-report-template.md](/Users/kisoon/Documents/0_vibeCoding/PS-AutoHUB/docs/release-report-template.md)를 복사해 `RELEASE_REPORT.md`로 작성한다.

보고서에는 다음을 반드시 남긴다.

- 앱 버전과 빌드 번호
- 릴리즈 날짜
- 변경 범위
- 설치/업데이트 참고사항
- 검증 결과
- 패키지 폴더 또는 zip 파일명

## 태그 기준

공식 릴리즈는 앱 버전 태그를 권장한다.

```sh
git tag v1.1.1
```

같은 앱 버전에서 내부 추적용 설치본이 여러 개 필요하면 빌드 번호를 포함한다.

```sh
git tag v1.1.6-build007
```

태그는 릴리즈 기준점이 커밋된 뒤 남긴다.
