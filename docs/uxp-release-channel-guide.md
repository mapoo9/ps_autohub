# Auto-HUB UXP 채널 / 릴리즈 빌드 가이드 (공통 가이드 정리본)

작성일: 2026-06-29

이 문서는 공통 가이드(`0_CommonGuides`)의 UXP 채널·dev 폴더 구조·릴리즈 빌드 기준을 Auto-HUB 기준으로 정리한 요약본이다. 기준 원문은 공통 가이드이며, 본 문서는 프로젝트 적용 관점에서 발췌·매핑한다.

- 채널/빌드 산출물 원문: `0_CommonGuides/guides/photoshop-scripts/uxp-build-release-guide.md` (doc_version 0006)
- 버전 관리 원문: `0_CommonGuides/02-version-management-policy.md` (doc_version 0003)
- 릴리즈 리포트 원문: `0_CommonGuides/04-release-report-guide.md` (doc_version 0003)
- 프로젝트 실제 빌드 절차(.ccx/sideload/검증): `docs/build-release-guide.md`

> "일단 정리"용 참조 문서다. 공통 가이드의 채널 모델과 Auto-HUB 현재 상태 사이에 갭이 있으며, 맨 아래 "Auto-HUB 현황과 갭"에 정리했다. 채널 구조를 실제로 바꾸는 작업은 별도 결정 후 진행한다.

## 채널 모델

공통 가이드(0006) 기준 UXP 패널은 다음 채널을 구분한다.

```text
Release          = 실제 배포 채널. 한 번의 릴리즈 빌드가 두 산출물을 만든다.
  - 설치본(.ccx)  = 사용자 설치본, 업데이트 기준. plugin id com.example.product
  - QA 포터블      = 개발툴에서 실행해 릴리즈를 확인하는 포터블 버전(옛 _Build). plugin id com.example.product.qa
_Dev             = UXP Developer Tool에 붙여 최신 작업과 검증을 진행하는 기본 개발 채널
_Lab             = 데이터와 코드를 격리하는 구조 변경 실험 채널
```

핵심 원칙:

- `_Dev`가 일상 개발의 시작점이다. 최신 데이터·UI·bridge 동작을 여기서 먼저 검증한다.
- QA 포터블은 버전별 아카이브가 아니라, 릴리즈 빌드 요청 시 `_Dev`의 확정 상태를 정리한 "최신 릴리즈 확인본"이다.
- 설치본(.ccx)은 정리·검증된 QA 포터블 내용을 기준으로 만든다.
- `_Lab`은 폴더 구조·데이터 저장 방식·통신 구조·bridge 구조처럼 되돌릴 가능성이 큰 구조 실험 전용이며, Release/`_Dev`의 데이터·설정을 공유하지 않는다.

권장 흐름:

```text
_Dev
  ↓ 최신 동작 검증, 사용자 요청 반영
Release · QA 포터블 (옛 _Build)
  ↓ 릴리즈 빌드 요청 시 Dev 상태를 릴리즈 확인본으로 정리, 개발툴에서 확인
Release · 설치본
  ↓ .ccx / all-in-one 설치본 패키징
```

## 권장 UXP id / 표시명

| 채널 | UXP id 예시 | 표시명(타이틀/About) | 용도 |
|---|---|---|---|
| Release · 설치본 | `com.psautohub.panel` | `Auto-HUB {버전}` | 최종 `.ccx`, 사용자 설치본, 업데이트 기준 |
| Release · QA 포터블 | `com.psautohub.panel.qa` | `Auto-HUB {버전} (QA)` | 개발툴에서 릴리즈를 확인하는 포터블본 |
| `_Dev` | `com.psautohub.panel.dev` | `Auto-HUB_Dev {버전}` | 기본 개발, UXP Developer Tool, 최신 상태 확인 |
| `_Lab` | `com.psautohub.panel.lab` | `Auto-HUB_Lab {버전}` | 구조 변경 실험, 별도 데이터/설정 |

- Release id는 업데이트 식별 기준이므로 일반 업데이트에서 바꾸지 않는다.
- 설치본과 QA 포터블은 Finder/패널 이름이 같으므로 타이틀/About에 `(QA)` + 버전을 노출해 구분한다.
- `_Dev`/`_Lab`은 Release와 동시에 로드될 수 있어 별도 id를 권장한다.

## 채널 분리 대상

동시 설치·동시 로드 가능성이 있으면 아래가 섞이지 않게 한다.

- UXP plugin id
- 앱 표시명과 패널 label
- 단축키 스크립트 파일명 또는 공통 단축키 소유권
- bridge folder와 command id (또는 공통 bridge owner 파일)
- status, cache, logs, settings, input/output 디렉터리
- (해당 시) Widget/Agent 앱 이름, port, URL scheme

단축키 스크립트 파일명에는 build 번호나 채널 suffix를 붙이지 않는다. 빌드마다 메뉴명이 바뀌면 사용자의 기존 단축키 지정이 끊긴다.

## 빌드 산출물 / 폴더 구조

공통 가이드 기준:

- `_Dev` 산출물은 프로젝트 루트나 개발 전용 경로를 직접 UXP Developer Tool에 로드한다. 별도 `.ccx`를 만들거나 `dist/dev/`에 중복 생성하지 않는다.
- QA 포터블(릴리즈 확인본)은 설치본과 같은 Release 경로 아래에 둔다. 최신 후보를 덮어쓰는 경로로 운용하고, 파일명에는 `_Build`/`qa`를 붙이지 않고 앱 이름 + 앱 버전으로 표기한다.
- `.ccx` 설치본은 QA 포터블에서 확인한 내용을 기준으로 생성한다. 최종 배포물은 QA 포터블 확인본 기준으로 all-in-one 패키징한다.
- 구조 실험은 `dist/lab/`보다 별도 worktree/폴더로 데이터·코드를 격리하는 것을 우선한다.

Auto-HUB의 실제 산출물 경로·패키징 절차는 `docs/build-release-guide.md`를 따른다.

```text
PS-AutoHUB/
└── dist/
    ├── Auto-HUB_vX.Y.Z_buildNNN/      # 루트 소스 복사본 + RELEASE_REPORT.md
    ├── Auto-HUB_vX.Y.Z_buildNNN.zip   # sideload 배포 zip
    ├── Auto-HUB_vX.Y.Z_buildNNN.ccx   # 정식 배포(필요 시)
    └── old backup/                    # 과거 설치본 보관
```

## 버전 관리 기준

```text
앱 버전: MAJOR.MINOR.PATCH   (사용자/외부 배포 기준)
빌드 번호: buildNNN          (내부 추적·변경 리포트용 보조 식별자)
```

- 릴리즈 빌드 제작 요청 = `PATCH` 자동 상승 + `BUILD` 자동 상승.
- `MINOR`/`MAJOR`는 사람이 먼저 판단한 뒤 릴리즈 빌드에서 `BUILD`와 함께 올린다.
  - MAJOR: 기존 사용 방식과 호환이 크게 깨지는 변경
  - MINOR: 기능 추가, 큰 동작 옵션 추가, 의미 있는 UX 변경
  - PATCH: 릴리즈 빌드 제작, 버그 수정, 패키징/문서/설정 변경 등 외부 공유 가능한 배포 단위
- 빌드 번호는 외부 파일명·앱 화면·사용자 안내 문서에 노출하지 않는다. 변경 리포트와 내부 추적에만 쓴다.
- 배포 파일명/표시 버전은 앱 버전 기준(`Auto-HUB v1.1.6`).

빌드 번호를 외부에 안 쓴다는 것이 빌드 후 검증 생략을 뜻하지는 않는다. 산출물 확인, 표시 버전 확인, 설치/업데이트 테스트는 앱 버전 기준으로 계속 수행한다.

## 릴리즈 빌드 후 확인 (앱 버전 기준)

- 앱 버전 PATCH와 내부 빌드 번호가 자동 증가했는지 (빌드 번호는 변경 리포트에 기록)
- 패키지 manifest / 런타임 코드 / 패널 표시 버전이 모두 최신 앱 버전인지
- 사용자에게 보이는 영역에 빌드 번호가 노출되지 않는지
- 배포 파일명이 앱 버전 기준이고 빌드 번호가 없는지, 압축 내부 구조와 README/리포트 포함 여부
- 체크섬을 앱 버전 기준 산출물명으로 기록
- 신규 설치 / 기존 버전 → 새 버전 업데이트 / 단축키·설정·사용자 파일 유지 / 재시작·리로드 후 새 버전 반영

`_key` 단축키·bridge가 있는 경우의 릴리즈 검증은 공통 가이드 "릴리즈 검증 기준" 섹션을 따른다(현재 Auto-HUB는 단축키 bridge 미사용 시 해당 없음).

## 변경 리포트 vs 릴리즈 리포트

| 구분 | 변경 리포트 | 릴리즈 리포트 |
|---|---|---|
| 목적 | 이전 릴리즈 이후 변경점 추적 | 현재 배포본 상태 설명 |
| 독자 | 내부 작업자·유지보수자 | 사용자·배포/지원 담당자 |
| 빌드 번호 | 내부 추적용 기록 가능 | 기본 비노출 |
| 핵심 질문 | 지난 릴리즈 이후 무엇이 바뀌었나? | 이번 배포본은 어떤 상태인가? |

릴리즈 리포트 양식은 `docs/release-report-template.md`(공통 `04-release-report-guide.md` 기준)를 사용한다. 현재 포함 상태, 사용자 기준 변경사항, 진행 중인 기능, 설치/업데이트 참고, 알려진 이슈, 검증 결과를 구분해 적는다.

## Auto-HUB 현황과 갭

현재(`v1.1.6 / build007`) 실태와 공통 모델(0006) 차이:

- **단일 채널 운영**: 루트 = 개발/테스트 기준, `dist/Auto-HUB_*`는 sideload + `.ccx` 산출물. 공통의 `_Dev`/QA 포터블/`_Lab` 구조는 아직 형식화하지 않았다.
- **DevTools 패키지 id 충돌**: `dist/Auto-HUB-DevTools_v1.1.5_build006`은 name이 "Auto-HUB DevTools"(version 1.1.7)이지만 plugin id가 Release와 동일한 `com.psautohub.panel`이다. 공통 가이드 권장(`_Dev`는 `.dev`, QA는 `.qa` 별도 id)과 어긋나, Release와 동시 설치 시 업데이트 식별이 충돌할 수 있다.
- **채널별 데이터/경로 분리 미적용**: settings/cache/logs/input·output 등 채널 분리 대상이 단일 경로를 공유한다.

권장 후속(별도 결정 후 진행):

1. 개발 채널을 `_Dev`(id `com.psautohub.panel.dev`, 표시 `Auto-HUB_Dev`)로 정식화하고 Release id와 분리.
2. 릴리즈 확인본이 필요하면 QA 포터블(id `.qa`, 타이틀 `(QA)`)로 정의하고 Release 경로 아래 최신 후보로 운용.
3. 구조 변경 실험은 `_Lab` 또는 별도 worktree로 데이터까지 격리.

## 관련 문서

- `docs/build-release-guide.md` — Auto-HUB 실제 빌드 경로·설치 형식·`.ccx` 절차·검증 체크리스트
- `docs/release-report-template.md` — 릴리즈 리포트 템플릿
- `0_CommonGuides/guides/photoshop-scripts/uxp-build-release-guide.md` — 채널/bridge/산출물 공통 원문
- `0_CommonGuides/02-version-management-policy.md` — 버전·빌드 번호 공통 원문
- `0_CommonGuides/04-release-report-guide.md` — 릴리즈 리포트 공통 원문
