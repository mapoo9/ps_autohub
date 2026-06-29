# 릴리즈 빌드 구조 · 앱버전 정리 · 폴더 구조 변경 작업 플랜 (에이전트 구성)

작성일: 2026-06-29

## 목적

세 가지를 한 번에 정리한다.

1. **폴더 구조 변경** — 패널 SoT를 리포 루트 → `dev/`, 산출물 `dist/` → `build/release/`로 이동(공통 표준 정렬). 기준: `docs/project-folder-structure-guide.md`.
2. **앱버전 정리** — 외부 파일명·표시에서 빌드 번호 제거, 빌드 번호는 내부 추적용으로만. 버전 동기화 지점 일괄 정렬. 기준: `docs/uxp-release-channel-guide.md` 버전 정책.
3. **릴리즈 빌드 구조 정리** — 새 폴더 구조 기준으로 `build/release/` 패키징 절차·`.ccx` 빌드 명령·체크리스트를 갱신하고, 이 구조에서 첫 검증 빌드를 만든다.

본 문서는 **에이전트 사용을 전제로 한 실행 플랜**이다. 각 단계마다 담당 에이전트·모델·입력·산출·검증을 정의한다. 실행은 사용자 승인 후 진행한다.

---

## A. 확정 필요 결정 (실행 전 게이트)

아래는 플랜 구조를 바꾸는 결정이다. 괄호는 권장안.

- **A1. SoT 이동** — 패널 소스를 `dev/`로 내린다. (권장: 진행) UDT 로드 경로가 루트 → `dev/`로 바뀐다.
- **A2. 산출물 폴더** — `dist/` → `build/release/`. (권장: 진행)
- **A3. 외부 파일명에서 빌드 번호 제거** — `Auto-HUB_v1.1.6_build007` → `Auto-HUB_v1.1.7`. (권장: 진행) 빌드 번호는 `index.js`/리포트 등 내부에만.
- **A4. 다음 메인 버전** — 패키징 변경 = PATCH 상승이므로 `v1.1.7 / build008`. (권장) 단, `dist/Auto-HUB-DevTools_*` 패키지 manifest가 이미 1.1.7을 들고 있어 혼동 소지 → 해당 DevTools 산출물은 stale로 `build/release/old-backup/`에 내린다.
- **A5. DevTools/_Dev 채널 id 분리(`com.psautohub.panel.dev`)** — 이번 범위에서는 **제외**(별도 작업)하고 문서에만 후속으로 남긴다. (권장: 제외) 이 플랜은 "구조+버전 정리"에 집중한다.
- **A6. 임시 폴더** — `compare_tmp/`·`review_tmp/`를 `temp/`로 통합(gitignore 유지). (권장: 진행, 저위험)

> A1~A4가 핵심이고 서로 묶여 있다. A5를 포함하려면 채널 분리 서브플랜을 별도로 덧붙인다.

---

## B. 목표 구조 (확정안 기준)

```text
PS-AutoHUB/
├── docs/
├── dev/                         # SoT (UDT 로드 대상)
│   ├── manifest.json
│   ├── index.html · index.js
│   ├── src/{constants,core,core/debug,ui}/
│   ├── styles/ · assets/{fonts,icons}/ · icons/
├── build/release/
│   ├── Auto-HUB_v1.1.7/         # dev 복사본 + RELEASE_REPORT.md
│   ├── Auto-HUB_v1.1.7.zip
│   ├── Auto-HUB_v1.1.7.ccx
│   ├── checksums.txt
│   └── old-backup/              # 과거 dist 산출물 전체 이관
├── temp/                        # compare_tmp+review_tmp (gitignore)
├── AGENTS.md · CLAUDE.md · CLAUDE_CODEX.md
└── .gitignore · .claude/
```

미적용(단일 패널이라 불필요): `input/ output/ runs/ cache/ launcher/ dev/apps/ shared/ db/`. 필요해지면 그때 도입.

---

## C. 영향 인벤토리 (정적 분석 결과)

- **이동 대상(코드)**: `manifest.json`, `index.html`, `index.js`, `src/`, `styles/`, `assets/`, `icons/` → `dev/`. `index.js`는 전부 상대 require라 묶음 이동 시 경로 무손상.
- **버전 동기화 6지점**: `manifest.json:5` / `index.js:2,28,92,99` / `index.html:171` / `docs/추가작업/debug-log-events.md:4` / 패키지 폴더·zip·.ccx명 / `RELEASE_REPORT.md`.
- **`dist/`·루트 경로를 참조하는 문서(수정 대상)**: `CLAUDE.md`, `AGENTS.md`, `RELEASE_REPORT.md`, `docs/build-release-guide.md`, `docs/uxp-release-channel-guide.md`, `docs/project-folder-structure-guide.md`, `docs/release-report-template.md`, `docs/WORKLOG_GUIDE.md`, `docs/WORKLOG.md`(이력은 보존, 신규 엔트리만).
- **빌드 절차 영향**: `.ccx` CLI 명령의 `cd dist/Auto-HUB_...` → `cd build/release/Auto-HUB_v1.1.7`. `node --check` 대상 경로가 `dev/` 접두로 변경.

---

## D. 에이전트 구성 · 모델 배정

오케스트레이션은 메인 루프(Opus 4.8)가 맡고, 각 단계를 전담 에이전트로 분리한다. 모델 선택 원칙:

- **Opus 4.8** — 판단·위험 검토·일관성 검증. 인벤토리 확정, 이동 명령 설계, 적대적 리뷰, `.ccx` 빌드 판단.
- **Sonnet 4.6** — 사양이 확정된 기계적 편집. git mv 실행, 버전 문자열 치환, 문서 일괄 수정.
- **Haiku 4.5** — 경량 스윕·검증. grep 누락 점검, `node --check`/manifest parse/체크섬 실행.

| # | 단계 | 에이전트(agentType) | 모델 | 입력 | 산출 | 검증 게이트 |
|---|---|---|---|---|---|---|
| P0 | 인벤토리·결정 락 | Explore | **Opus** | 리포 현 상태, 본 플랜 | 이동 파일 전수 목록 + 경로 참조 전수 목록 + 정확한 git mv 명령 시퀀스(검토용) | 사람이 A1~A6 확정, git 트리 clean·태그 `pre-restructure` 생성 |
| P1 | 폴더 이동 | general-purpose | **Sonnet** | P0의 명령 시퀀스 | `git mv`로 코드→`dev/`, `dist/`→`build/release/`, tmp→`temp/`. 이력 보존 | `git status`로 rename 인식 확인, `dev/`에서 `node --check` 통과 |
| P2 | 앱버전 정리 | general-purpose | **Sonnet** | 6 동기화 지점, A3/A4 | 버전 문자열을 `v1.1.7/build008`로, 외부명에서 build 제거. 패키지 폴더·zip·.ccx명 규칙화 | `node --check dev/index.js`, 표시/내부 토큰 일치 grep |
| P3 | 문서·절차 갱신 | general-purpose ×N (병렬) | **Sonnet** | C의 문서 목록 | 파일별 `dist/`→`build/release/`·루트→`dev/` 반영, 빌드 가이드 명령/체크리스트 갱신 | 파일별 마크다운 링크·경로 유효성 점검 |
| P4 | 누락 스윕 | Explore | **Haiku** | 변경 후 트리 | 남은 `dist/`·루트-SoT 참조, 깨진 상대경로, 빌드 번호 외부노출 잔재 보고 | 0건이어야 통과(있으면 P3 재투입) |
| P5 | 검증 빌드 생성 | general-purpose | **Opus** | `dev/`, 빌드 가이드 | `build/release/Auto-HUB_v1.1.7/`+zip+`.ccx`(Apple Silicon 절차)+checksums+RELEASE_REPORT | `node --check` 전수, manifest parse, zip 내부구조, 체크섬 기록 |
| P6 | 적대적 리뷰 | code-reviewer(또는 general) ×3 렌즈 | **Opus** | 전체 diff | 렌즈별(①경로/상대참조 ②버전 일관성 ③문서 정확성) 결함 보고 | 다수결로 confirmed 결함 0건 |
| — | 실기 확인 | **사람(수동)** | 새 `dev/` 로드 | UDT 재설정 후 패널 스모크 | accordion/ACTION/OPEN/1 test/Run/Debug 비노출 정상 |

병렬 가능: P3의 문서별 에이전트는 동시 실행. P1→P2→(P3∥)→P4→P5→P6는 순차 의존.

> 워크플로로 실행 시: P0(Opus) → P1·P2 파이프라인(Sonnet) → P3 parallel(Sonnet) → P4(Haiku) → P5(Opus) → P6 parallel 3-lens(Opus) 구조로 매핑된다. 실행은 사용자가 "진행" 지시 시 `Workflow`로 구성한다.

---

## E. 실행 순서 · 의존성

```text
P0(결정 락·인벤토리·태그)
  └─ P1(폴더 이동) ─ P2(버전 정리)
        └─ P3(문서 갱신, 파일별 병렬)
              └─ P4(누락 스윕)
                    └─ P5(검증 빌드)
                          └─ P6(적대적 리뷰) ─ 사람 실기 확인 ─ 커밋/태그 v1.1.7
```

각 P 종료마다 단위 커밋(work 단위). P5 산출물 zip은 `.gitignore`(`*.zip`) 대상이라 커밋되지 않음 — 의도된 동작.

---

## F. 검증 게이트(요약)

- 정적: `node --check dev/index.js dev/src/core/*.js dev/src/core/debug/*.js dev/src/ui/*.js`, manifest JSON parse.
- 경로: 잔존 `dist/`·루트-SoT 참조 0건, `dev/` 상대 require 무손상, 마크다운 링크 유효.
- 버전: 표시(`index.html`, panel-title)·manifest·내부 토큰이 모두 `1.1.7` 정렬, 외부 파일명에 `buildNNN` 없음, 빌드 번호는 `index.js`/리포트에만.
- 산출물: `build/release/`에 앱버전명 폴더/zip/.ccx, checksums 기록, RELEASE_REPORT 동봉.
- 실기(사람): UDT가 `dev/` 로드, 패널 기본 흐름·Debug 비노출.

## G. 롤백 전략

- 시작 전 `git tag pre-restructure` + 전용 브랜치(`restructure/dev-build`)에서 작업.
- 모든 이동은 `git mv`로 이력 보존 → 단계별 `git revert`/브랜치 폐기로 복구.
- UDT 경로만 수동 원복(루트 재로드)하면 기능 회귀 시 즉시 이전 상태 테스트 가능.

## H. 리스크

- **UDT 로드 경로 변경(중)** — 가장 흔한 사고원. P0 명령에 "이동 후 UDT에서 `dev/` 재추가" 안내 명시, 실기 확인을 사람 게이트로 강제.
- **버전 1.1.7 선점 혼동(저)** — DevTools 산출물이 1.1.7 보유. A4대로 old-backup 이관으로 해소.
- **문서 누락(저)** — P4 Haiku 스윕 + P6 문서 정확성 렌즈로 이중 점검.
- **`.ccx` Apple Silicon 함정(중)** — 기존 검증 절차(`docs/build-release-guide.md`, 메모리 `uxp-ccx-build-apple-silicon`)를 P5가 그대로 따른다. PS·UDT 실행 선행 조건 포함.

## I. 산출물 체크리스트

- [ ] `dev/` 패널 SoT, `node --check` 통과
- [ ] `build/release/Auto-HUB_v1.1.7/` + zip + .ccx + checksums + RELEASE_REPORT
- [ ] 6 동기화 지점 1.1.7 정렬, 외부명 buildNNN 제거
- [ ] 문서(CLAUDE/AGENTS/build-release-guide/정리본 2종/template) 경로 갱신
- [ ] WORKLOG 신규 엔트리, `git tag v1.1.7`
- [ ] 후속: `_Dev` 채널 id 분리(A5)는 별도 플랜으로 이월

## 관련 문서

- `docs/project-folder-structure-guide.md` · `docs/uxp-release-channel-guide.md` · `docs/build-release-guide.md`
