# Auto-HUB 프로젝트 폴더 구조 가이드 (공통 가이드 정리본)

작성일: 2026-06-29

공통 가이드 `0_CommonGuides/guides/project-folder-structure-guide.md` (doc_version 0004) 기준을 Auto-HUB 관점에서 정리한 참조 문서다. 원문이 기준이며, 본 문서는 발췌·매핑 + 현황/갭 정리다.

> 공통 가이드 자체가 "기존 프로젝트에 즉시 강제하지 않는다. 적용 전 현재 구조·실행·빌드·권한·테스트·버전 방식을 먼저 확인한다"고 명시한다. Auto-HUB의 실제 구조 이전은 별도 결정 후 진행하며, 이 문서는 기준 정리까지만 한다.

## 핵심 원칙

프로젝트 폴더는 실행, 산출물, 로그, 실험, 릴리즈 흐름이 섞이지 않게 구성한다. 공통 바깥 구조는 가능한 한 동일하게 유지하고, 프로젝트 타입별 차이는 `dev/` 내부에서 흡수한다.

## 권장 루트 구조

```text
<ProjectName>/
├── input/      # 공유 입력 데이터 (모든 앱이 같은 폴더를 봄)
├── output/     # 최종 출력 데이터
├── runs/       # 실행 단위 상태·설정·결과 요약·재실행 정보
├── logs/       # 사용자 로그 / 디버그 로그 분리
├── cache/      # 삭제해도 재생성 가능한 임시 데이터
├── docs/       # 설계·운영·빌드·릴리즈·인수인계 문서
├── dev/        # 개발 원본, source of truth
├── launcher/   # 실행·설치·권한 부여 진입점
└── build/      # 릴리즈 산출물 박제(배포 최종본만)
```

필요 시 추가: `scripts/`, `assets/`, `temp/`. 빈 폴더를 형식상 만들 필요는 없고, 역할이 생기면 위 이름을 우선 쓴다.

## dev / launcher / build 분담

| 레이어 | 역할 | 사용 빈도 | 권한 |
|---|---|---|---|
| `dev/` | 코드 작성·개발 원본 | 상시 | 프로젝트 개발 권한 |
| `launcher/` | 빌드·설치·실행 반복 진입점 | 기능 변경 시마다 | 앱별 Bundle ID 단위 |
| `build/` | 릴리즈 산출물 박제 | 배포 시점 | 최종본 |

- macOS는 자동화·접근성·파일 접근 권한을 Bundle ID 단위로 기억하므로, 개발 중 반복 실행 지점(`launcher/`)과 릴리즈 박제 지점(`build/`)을 섞지 않는다.
- `build/` 내부는 산출물 성격별로 나눈다(예: `build/plugin/` UXP 빌드본, `build/agent/` 사이드카, `build/release/` 배포 패키지·체크섬·릴리즈 문서).
- 외부 배포 파일명은 앱 버전 기준, 빌드 번호는 기본 비포함.

## dev 내부 구조 (UXP 멀티앱)

```text
dev/
├── apps/
│   ├── plugin/   # 메인 UXP 패널
│   ├── widget/   # 인디케이터/정보 전달 독립 앱
│   ├── _key/     # psjs 단축키 트리거 앱
│   └── _agent/   # 외부 이미지 처리 앱
├── shared/       # 앱 간 통신 규약(메시지 타입, 포트, status/heartbeat 스키마, URL scheme, bridge command, 요구 버전)
└── db/           # 스키마/마이그레이션/시드(필요할 때만)
```

- 위젯·인디케이터는 패널 안에 억지로 넣기보다 독립 앱으로 분리하고, URL scheme·status 파일·bridge command 파일로 통신한다.
- Photoshop script는 `_key`(패널 소유 설정·실행을 단축키/액션에서 호출하는 트리거)와 `psjs-standalone`(PSJS가 직접 실행 흐름 소유)을 구분한다.
- 세부 분류는 `0_CommonGuides/guides/photoshop-scripts/`를 우선 확인한다.

## lab worktree

`lab`은 루트 안 폴더가 아니라 **프로젝트 단위 worktree**로 관리한다. 가벼운 실험은 일반 브랜치로, 환경 전체 격리가 필요하면 프로젝트 폴더 바깥에 worktree를 만든다.

```sh
git worktree add ../Auto-HUB-lab -b lab
```

- worktree는 메인 프로젝트 폴더 안에 두지 않는다. 루트 내부에 `lab/` 폴더를 만들지 않는다.
- worktree는 Git 추적 파일만 가져오므로, 실제 테스트 환경에 필요한 Git 미관리/ignored 파일(`input/`, `output/`, `cache/`, 로컬 설정 등)은 생성 직후 복사한다.
- 실험 성공 시 코드 변경만 메인에 반영(`git merge lab` 또는 `cherry-pick`)하고, 데이터·캐시·산출물·로그는 가져오지 않는다.
- 정리: `git worktree remove ../Auto-HUB-lab && git branch -d lab`.

이 기준은 `docs/uxp-release-channel-guide.md`의 `_Lab` 채널 정의와 연결된다.

## 프로젝트별로 따로 정할 항목

공통 가이드 본문에 고정하지 않고 프로젝트 빌드 가이드 또는 `docs/project-overrides.md`에 기록: `shared/` 위치, 사이드카 방식, 멀티앱 메시지 스키마, URL scheme/bridge command 위치, Bundle ID·권한, 사이드카 산출물 이름, README/설치/업데이트 정책, 검증 체크리스트.

## Auto-HUB 현황과 갭

현재(`v1.1.6 / build007`) Auto-HUB는 공통 권장 구조와 다른 평면 레이아웃이다.

| 항목 | 공통 권장 | Auto-HUB 현재 |
|---|---|---|
| source of truth | `dev/`(또는 `dev/apps/plugin/`) | 리포 루트 자체 (`manifest.json`, `index.js`, `src/` 등 루트 배치) |
| 릴리즈 산출물 | `build/`(`build/plugin/`, `build/release/`) | `dist/Auto-HUB_*` (폴더/zip/.ccx) |
| input/output/runs/logs/cache | 루트 공유 폴더 | 별도 표준 폴더 없음(패널 런타임 내부 처리) |
| 멀티앱 분리 | `dev/apps/{plugin,widget,_key,_agent}` | 단일 패널, `_key`/widget/agent 미사용 |
| lab | 프로젝트 밖 worktree | 미운영 |

판단:

- Auto-HUB는 단일 UXP 패널이라 멀티앱(`apps/`, `shared/`, `_agent`) 구조는 현재 불필요하다.
- 가장 큰 차이는 **SoT 위치(루트 vs `dev/`)와 산출물 폴더명(`dist/` vs `build/`)** 이다. 이는 단순 이름 차이가 아니라 UXP Developer Tool 로드 경로·기존 워크플로·문서 전반에 얽혀 있어, 옮기려면 별도 마이그레이션 결정이 필요하다.
- 즉시 적용 권장은 없다. 공통 표준에 맞출지, 현재 평면 구조를 Auto-HUB override로 명문화할지를 후속 결정 대상으로 둔다.

후속 결정이 필요한 항목:

1. SoT를 `dev/`로 옮길지 vs 루트 유지(현 상태)를 `docs/project-overrides.md`로 공식화할지.
2. 산출물 폴더 `dist/` → `build/` 통일 여부(공통 빌드 가이드 표기와 맞춤).
3. 구조 실험 발생 시 `lab` worktree 운영 도입 여부.

## 관련 문서

- `docs/uxp-release-channel-guide.md` — UXP 채널/릴리즈 빌드 정리본(`_Lab` 채널 포함)
- `docs/build-release-guide.md` — Auto-HUB 실제 빌드 경로·절차
- `0_CommonGuides/guides/project-folder-structure-guide.md` — 폴더 구조 공통 원문
- `0_CommonGuides/guides/photoshop-scripts/` — Photoshop script/bridge 세부 기준
