# Auto-HUB — Claude 작업 가이드

Photoshop UXP 패널 `Auto-HUB` 프로젝트의 Claude Code 작업 지침이다. 동일 내용을 Codex/에이전트용 `AGENTS.md`가 별도 포맷으로 유지하므로, 두 문서를 모두 갱신할 때는 같은 사실 기준으로 맞춘다.

## 작업 원칙

1. **Think Before Coding** — 추측하지 않는다. 가정은 명시하고, 모호하면 조용히 한 해석을 고르지 말고 가능한 해석을 제시하고 묻는다. 더 단순한 방법이 있으면 말하고, 혼란스러우면 무엇이 불명확한지 짚고 확인을 요청한다.
2. **Simplicity First** — 문제를 푸는 최소 코드만. 요청하지 않은 기능·추상화·유연성·불가능한 시나리오의 에러 처리는 넣지 않는다. 200줄이 50줄로 될 수 있으면 다시 쓴다. 기준: "시니어 엔지니어가 과하다고 할까?"
3. **Surgical Changes** — 꼭 필요한 곳만 건드린다. 인접 코드·주석·포맷을 임의로 "개선"하지 않고 기존 스타일을 따른다. 안 깨진 것은 리팩터링하지 않는다. 내 변경이 만든 미사용 import/변수/함수만 정리하고, 기존 dead code는 발견하면 언급만 하고 지우지 않는다. 바뀐 모든 줄이 요청과 직접 연결돼야 한다.

## 프로젝트 문서

- 빌드/릴리즈/버전 규칙: `docs/build-release-guide.md`
- UXP 채널/릴리즈 빌드 정리본(공통 가이드 발췌): `docs/uxp-release-channel-guide.md`
- 프로젝트 폴더 구조 정리본(공통 가이드 발췌): `docs/project-folder-structure-guide.md`
- UXP 빌드/채널/버전 공통 원문: `0_CommonGuides/guides/photoshop-scripts/uxp-build-release-guide.md`, `0_CommonGuides/02-version-management-policy.md`, `0_CommonGuides/04-release-report-guide.md`
- 릴리즈 보고서 템플릿: `docs/release-report-template.md`
- 워크로그 규칙: `docs/WORKLOG_GUIDE.md` / 현재 워크로그: `docs/WORKLOG.md`
- Debug Mode 계획: `docs/추가작업/debug-mode-plan.md`
- Action 카탈로그 갱신 계획: `docs/추가작업/action-catalog-refresh-plan.md`
- 공통 개선 백로그: `docs/추가작업/project-wide-improvements.md`

## Source Of Truth

- 편집 기준은 리포지터리 루트다. 루트가 Photoshop UXP 개발 테스트의 기본 대상이다.
- `dist/*` 폴더는 설치/배포 산출물이며 편집 source of truth가 아니다.
- Photoshop 패널 문제를 진단하기 전에 UXP Developer Tool이 루트를 로드 중인지 `dist/Auto-HUB_*` 패키지를 로드 중인지 먼저 확인한다.
- `dist/*` 패키지를 로드 중이면 루트 소스 변경은 패키지 동기화 전까지 패널에 보이지 않는다.
- 테스트가 크게 깨지면 중첩 복사 테스트 폴더를 새로 만들지 말고, 최신 정상 커밋 또는 빌드에서 루트 패널 파일을 복원한다.

## 빌드와 버전

- 현재 루트 기준: `Auto-HUB v1.1.6 / build 007` (내부 토큰 `v1.1.6-build007`).
- 빌드 산출물 경로는 리포 루트의 `dist/`다. 패키지 폴더는 `dist/Auto-HUB_vX.Y.Z_buildNNN`, zip은 같은 이름의 `.zip`이다. 과거 설치본은 `dist/old backup/`에 보관한다.
- 설치 형식은 현재 sideload(폴더/zip + UXP Developer Tool `Add Plugin`)다. `.ccx`는 생성하지 않으며, 일반 사용자 더블클릭 배포가 필요해지면 `.ccx` 단계를 추가한다.
- 릴리즈를 준비할 때 다음을 같은 설치본 기준으로 동기화한다:
  - `manifest.json` `version`
  - `index.js`의 헤더 주석, `BUILD_TOKEN`, `BUILD_FINGERPRINT.appVersion`, `BUILD_FINGERPRINT.packageBuildId`
  - `index.html` 패널 타이틀(앱 버전만 표시)
  - `docs/추가작업/debug-log-events.md` 대상 빌드
  - 패키지 폴더명 / zip 파일명
  - 릴리즈 보고서 `RELEASE_REPORT.md`
- `src/core/debug/`처럼 새 소스 폴더는 패키지 산출물에 반드시 포함한다. 누락 시 UXP에서 `index.js` 초기화가 멈출 수 있다.
- 설치 패키지 생성·갱신 전에는 `docs/build-release-guide.md`의 절차와 체크리스트를 따른다.

## 검증

- 변경한 JavaScript는 가능하면 `node --check`로 정적 검증한다.
- `manifest.json`이 JSON으로 파싱되는지 확인한다.
- 릴리즈/패키지 작업은 `docs/build-release-guide.md`의 체크리스트를 따른다.
- 패널 렌더링, 액션 카탈로그, 파일 다이얼로그, 실행 흐름에 영향을 주는 변경은 Photoshop에서 직접 확인한다.

## 워크로그

- diff만 봐서는 드러나지 않는 결정이나 런타임 제약이 생기면 `docs/WORKLOG.md`에 짧게 남긴다.
- 특히 UXP 전용 동작, 패키지/루트 불일치, 수동 검증 공백, Action slot·Reset/Refresh·저장 흐름·Debug Mode의 UX 정책 결정을 기록한다.
- 워크로그를 전체 diff 복사본으로 만들지 않는다. 목적, 결정, 검증, 남은 작업을 기록한다.

## Action 중단 동작

- Photoshop 액션 오류/팝업 상황에서는 배치 속도보다 중단 신뢰성이 우선이다.
- 현재 규칙: 액션 처리가 명확히 성공했을 때만 다음 파일로 넘어간다.
- 액션 단계 문제가 감지되면 현재 Photoshop 문서 상태를 그대로 둔다.
- 액션 중단 상황에서 문서를 자동 저장하거나 자동으로 닫지 않는다.
- 배치 중단을 확정하기 전 패널 `Cancel` 입력을 기다린다.

## Action Slot 메모리

- 현재 로드된 카탈로그 값뿐 아니라 slot preset 상태를 기억한다.
- 저장된 preset은 다음을 보존해야 한다: slot 순서, 선택한 action set, 선택한 action, enabled/disabled 상태.
- 액션 카탈로그를 새로고침할 때 가능한 한 저장된 slot 상태를 보존한다.

## 커밋

- work(하나의 목적을 가진 변경 묶음)가 완료되면 매번 개별 지시 없이 commit과 `docs/WORKLOG.md` 갱신을 자동 수행한다.
- commit은 work 단위로 묶고 파일마다 쪼개지 않는다. 목적이 다른 변경은 섞지 않는다.
- commit 전 `node --check` 등 가능한 정적 검증을 하고, 검증을 생략하면 이유를 남긴다.
- push는 자동이 아니다. 별도 지시가 있을 때만 수행한다.
- 상세 기준: `docs/WORKLOG_GUIDE.md`, 공통 `../공통/docs/WORKLOG_GUIDE.md`.

## 안전

- 사용자가 명시적으로 패키지 산출물 패치를 요청하지 않는 한 `dist/*`를 편집 소스로 취급하지 않는다.
- 사용자 preset, 설정, 패키지 백업은 명시적 요청 없이 삭제하지 않는다.
- 워킹 트리의 기존 사용자 변경을 보존한다.
