# 릴리즈 구조/버전/폴더 정리 — 에이전트 작업 지시서 (Runbook)

작성일: 2026-06-29
상위 플랜: `docs/추가작업/release-restructure-plan.md`

이 문서는 플랜을 **실행 가능한 단계별 작업 지시**로 분해한 런북이다. 각 단계는 담당 에이전트·모델·effort·입력·지시 프롬프트(그대로 사용)·산출 형식·수용 기준·핸드오프를 갖는다. 오케스트레이션은 메인 루프(Opus 4.8)가 맡고, 단계별 단위 커밋을 남긴다.

## 공통 전제 (실행 전 1회)

- 결정 확정: 플랜 A절 A1~A4 = 진행, A5(`_Dev` id 분리) = 제외, A6(temp 통합) = 진행.
- 타깃 버전: `v1.1.7 / build008`.
- 작업 격리:
  ```sh
  git tag pre-restructure
  git switch -c restructure/dev-build
  git status --short   # clean이어야 시작
  ```
- 모델/effort 표기: 각 단계 헤더 참조. 워크플로 실행 시 `agent(prompt, {model, effort, schema, phase})`에 그대로 매핑.

---

## P0 — 인벤토리 · 명령 시퀀스 설계 · 결정 락

- agentType: `Explore` · 모델: **Opus 4.8** · effort: **high** · 격리: 없음(읽기)
- 목적: 추측 없이 이동·수정 대상을 전수 확정하고, P1이 그대로 실행할 git 명령 시퀀스를 만든다.

지시 프롬프트:
```text
PS-AutoHUB 리포에서 다음을 전수 조사해 구조화 산출하라(코드 수정 금지, 읽기만).
1) dev/로 이동할 루트 코드 항목 전체 목록(현재: manifest.json, index.html, index.js, src/, styles/, assets/, icons/). git 추적 여부 표시.
2) 'dist/' 또는 '리포 루트가 SoT'라는 가정을 담은 모든 추적 파일과 정확한 줄 번호(문서 포함).
3) 버전 동기화 지점 6곳의 현재 값과 줄 번호.
4) P1이 실행할 git 명령 시퀀스 초안(git mv 기반, 이력 보존). dist→build/release, 코드→dev/ 포함. tmp 폴더는 untracked이므로 plain mv로 분리 표기.
5) 이동으로 깨질 수 있는 상대경로·require가 있는지 판정(현재 index.js는 ./src 상대 require로 묶음이동 시 안전한지 확인).
출력은 아래 schema로.
```
산출 schema(요지): `{ moveItems[], pathRefs[{file,line,kind}], versionPoints[{file,line,current}], gitCommands[], relPathRisk[] }`

수용 기준:
- pathRefs에 `dist/` 참조 문서가 빠짐없이(P0 기준 최소 8개 문서) 포함.
- gitCommands가 현재 트리에서 dry-run 가능한 형태.
- relPathRisk가 "묶음이동 안전" 또는 구체 위험을 명시.

핸드오프: P1에 `gitCommands`, P2에 `versionPoints`, P3에 `pathRefs` 전달. **사람이 결정/태그/브랜치 확정 후 P1 시작.**

---

## P1 — 폴더 이동 (git mv)

- agentType: `general-purpose` · 모델: **Sonnet 4.6** · effort: **medium** · 격리: 없음(메인 트리에서 순차)
- 목적: P0 명령 시퀀스를 실행해 SoT를 dev/로, 산출물을 build/release/로 이동. 이력 보존.

지시 프롬프트:
```text
P0가 산출한 gitCommands를 그대로 실행하라. 임의 추가·생략 금지.
순서:
  mkdir -p build
  git mv manifest.json index.html index.js src styles assets icons dev/   # dev/ 없으면 git mv가 자동 생성 안 하므로 먼저 mkdir dev
  (정확 명령은 P0 시퀀스 우선)
  git mv dist build/release
tmp 통합(untracked, plain mv):
  mkdir -p temp && mv compare_tmp temp/ 2>/dev/null; mv review_tmp temp/ 2>/dev/null
  .gitignore의 compare_tmp/ · review_tmp/ 항목을 temp/ 로 교체.
실행 후 `git status`로 R(rename) 인식 여부, `node --check dev/index.js`로 상대경로 무손상을 확인하고 결과를 보고하라. 코드 내용은 수정하지 말 것.
```
수용 기준:
- `git status`가 이동을 `renamed:`로 인식(이력 보존).
- `node --check dev/index.js` 통과.
- 루트에 패널 코드 잔존 없음, `build/release/`에 기존 dist 내용 존재.

핸드오프: 단위 커밋 `Move panel source to dev/ and dist to build/release`. P2 시작.

> 주의: 이 단계 직후 UDT 로드 대상이 깨진다. 실기 검증은 P5 이후 사람 게이트까지 보류.

---

## P2 — 앱버전 정리 (v1.1.7 / build008)

- agentType: `general-purpose` · 모델: **Sonnet 4.6** · effort: **medium**
- 목적: 동기화 6지점을 1.1.7/build008로 맞추고, 외부 파일명에서 빌드 번호를 제거하는 규칙을 확정(실제 파일명 변경은 P5 신규 산출물에 적용).

정확한 편집(경로는 P1 이동 후 기준):
```text
dev/manifest.json   "version": "1.1.6" → "1.1.7"
dev/index.js  L2     헤더 "v1.1.6 / build 007" → "v1.1.7 / build 008"
dev/index.js  L28    BUILD_TOKEN 'v1.1.6-build007' → 'v1.1.7-build008'
dev/index.js  L92    appVersion '1.1.6' → '1.1.7'
dev/index.js  L99    packageBuildId 'build007' → 'build008'
dev/index.html L171  "Auto-HUB v1.1.6" → "Auto-HUB v1.1.7"
docs/추가작업/debug-log-events.md L4  "Auto-HUB v1.1.6-build007" → "v1.1.7-build008"
```
지시 프롬프트:
```text
위 7개 지점을 정확히 치환하라. 다른 줄·다른 버전 표기를 임의 변경하지 말 것.
완료 후 검증:
  node --check dev/index.js
  grep -rn "1\.1\.6\|build007" dev/ docs/추가작업/debug-log-events.md   # 잔재 0건 기대
  python3 -c "import json;json.load(open('dev/manifest.json'))"        # parse 확인
빌드 번호는 외부 파일명/표시에 노출하지 않는다는 규칙을 P5 산출물명 기준으로 메모만 남기고, 기존 dist 산출물명은 건드리지 말 것.
```
수용 기준: 잔재 grep 0건, parse 통과, 표시(index.html)·manifest·내부 토큰이 모두 1.1.7.

핸드오프: 단위 커밋 `Bump to v1.1.7 build008 and normalize version sync points`. P3 시작.

---

## P3 — 문서 · 빌드 절차 갱신 (병렬)

- agentType: `general-purpose` ×N · 모델: **Sonnet 4.6** · effort: **medium** · 병렬 실행(파일별 충돌 없음)
- 목적: `dist/`→`build/release/`, 루트-SoT→`dev/` 반영, 빌드 가이드 명령/체크리스트 갱신.

파일별 담당(각 1 에이전트):
```text
A. docs/build-release-guide.md   — 산출물 경로 dist→build/release, .ccx 명령 cd 경로,
                                    node --check 경로 dev/ 접두, 패키지 폴더/zip/.ccx명 규칙(앱버전만)
B. CLAUDE.md + AGENTS.md          — "편집 기준 리포 루트"→dev/ SoT, dist/* 언급, 버전 기준 1.1.7,
                                    빌드 산출물 경로, 검증 명령 경로
C. docs/uxp-release-channel-guide.md + docs/project-folder-structure-guide.md
                                    — "현황·갭" 표를 적용 완료 기준으로 갱신(루트→dev/, dist→build/release 반영)
D. docs/release-report-template.md + RELEASE_REPORT.md
                                    — 경로/버전 표기 정리(RELEASE_REPORT는 P5에서 최종 작성, 여기선 경로만)
```
공통 지시 프롬프트(각 에이전트):
```text
담당 파일에서 'dist/' 경로와 '리포 루트가 SoT'라는 서술을 새 구조(dev/ SoT, build/release/ 산출물)로 갱신하라.
- 버전 표기는 v1.1.7 기준.
- 마크다운 링크의 파일 경로가 실제 새 위치를 가리키는지 확인.
- WORKLOG.md의 과거 이력은 수정하지 말 것(신규 엔트리는 마지막 P에서 추가).
- 요청 범위 밖 문장·포맷을 임의 개선하지 말 것(Surgical Changes).
완료 후 변경한 줄과 남은 dist/ 참조 유무를 보고하라.
```
수용 기준: 담당 파일 내 잔존 `dist/`(과거 이력 제외)·루트-SoT 서술 0건, 링크 유효.

핸드오프: 단위 커밋 `Update docs and build procedure for dev/ + build/release layout`. P4 시작.

---

## P4 — 누락 스윕 (적대적 grep)

- agentType: `Explore` · 모델: **Haiku 4.5** · effort: **low**
- 목적: P1~P3가 놓친 잔재를 싸게 전수 점검.

지시 프롬프트:
```text
다음을 전 리포(.git, build/release/old-backup, WORKLOG 과거 이력 제외)에서 점검해 위치를 보고하라. 수정 금지.
  1) 'dist/' 참조 잔재
  2) 루트 경로로 패널 소스를 가리키는 서술(예: ./index.js, 루트의 manifest)
  3) 외부 파일명/표시에 build008 등 빌드 번호 노출
  4) dev/ 내부 깨진 상대경로(require 대상 파일 실존 여부)
  5) 1.1.6 잔재
각 항목 0건이면 PASS, 아니면 파일:줄로 리스트.
```
수용 기준: 전 항목 PASS. 결함 발견 시 해당 P(주로 P3)로 재투입 후 재실행.

핸드오프: PASS 시 P5.

---

## P5 — 검증 빌드 생성 (build/release/Auto-HUB_v1.1.7)

- agentType: `general-purpose` · 모델: **Opus 4.8** · effort: **high**
- 목적: 새 구조에서 첫 릴리즈 산출물 생성. Apple Silicon `.ccx` 절차 판단 필요.
- 선행: UXP Developer Tools 앱 실행(포트 14001), Photoshop 실행.

지시 프롬프트:
```text
docs/build-release-guide.md(갱신본)와 메모리 uxp-ccx-build-apple-silicon 절차를 따라 새 구조에서 산출물을 만들어라.
1) dev/ 정적 검증: node --check dev/index.js dev/src/core/*.js dev/src/core/debug/*.js dev/src/ui/*.js
2) dev/manifest.json JSON parse 확인
3) 패키지 폴더 생성: build/release/Auto-HUB_v1.1.7/ ← dev/ 전체 복사(.DS_Store 제외, src/core/debug 포함 확인)
4) zip: build/release/Auto-HUB_v1.1.7.zip
5) .ccx: arch -x86_64 node18 + uxp CLI, .git 없는 패키지 폴더에서 packaging, 산출물을 Auto-HUB_v1.1.7.ccx로 rename
6) checksums.txt에 zip/.ccx sha256 기록(파일명은 앱버전 기준)
7) 과거 dist 산출물은 build/release/old-backup/로 정리(선택)
RELEASE_REPORT.md를 release-report-template 기준으로 작성해 패키지 폴더에 동봉.
빌드 번호 build008은 RELEASE_REPORT·index.js 내부에만, 외부 파일명엔 넣지 말 것.
각 단계 결과와 체크섬을 보고하라.
```
수용 기준: node --check 전수 통과, manifest parse, zip 내부에 src/core/debug 포함, 파일명에 buildNNN 없음, 체크섬 기록, RELEASE_REPORT 동봉.

핸드오프: 단위 커밋 `Build v1.1.7 under build/release` (zip/.ccx는 .gitignore 대상). P6 시작.

---

## P6 — 적대적 리뷰 (3 렌즈 병렬)

- agentType: `general-purpose` ×3 · 모델: **Opus 4.8** · effort: **high** · 병렬
- 목적: 전체 diff를 독립 3렌즈로 검증. 다수결로 confirmed 결함만 남긴다.

렌즈별 지시 프롬프트:
```text
[렌즈1 경로/상대참조] dev/ 이동·build/release 변경으로 깨진 require·상대경로·manifest 아이콘 경로·마크다운 링크가 있는지 반증하라. 기본값 "문제 있음"으로 의심하고, 안전하면 근거를 대라.
[렌즈2 버전 일관성] manifest/index.js(토큰·appVersion·packageBuildId)/index.html/debug-log-events/RELEASE_REPORT/파일명이 모두 v1.1.7로 정합한지, 외부에 build008 노출이 없는지 검증하라.
[렌즈3 문서 정확성] CLAUDE/AGENTS/build-release-guide/정리본 2종이 실제 새 구조와 일치하는지, 잔존 dist/·루트-SoT 서술이 없는지 검증하라.
각자 결함을 {file,line,severity,why,fix} 리스트로. 확신 없으면 refuted=false로 보수적으로.
```
수용 기준: 3렌즈 종합 confirmed 결함 0건. 있으면 해당 P 재투입.

핸드오프: 사람 실기 게이트.

---

## 사람 게이트 — 실기 확인 (수동)

- UXP Developer Tool에서 기존 루트 엔트리 제거 후 **새 `dev/` 폴더를 Add Plugin**.
- Photoshop에서 패널 리로드 후 확인: accordion 접기/펼치기, ACTION 기본 빈 slot, Action Set/Action picker, OPEN 폴더 안내, 1 test, Run, Debug UI 기본 비노출.
- `.ccx` 더블클릭 설치 → 패널 등장 + 기존 설치(같은 id `com.psautohub.panel`) 업데이트 동작.

PASS 시:
```sh
# WORKLOG 신규 엔트리 추가 후
git switch main && git merge --no-ff restructure/dev-build
git tag v1.1.7
git push origin main --tags
```

---

## 모델 배정 근거 (요약)

| 모델 | 사용 단계 | 근거 |
|---|---|---|
| **Opus 4.8** | P0, P5, P6, 오케스트레이션 | 이동 설계·`.ccx` 판단·적대적 검증 등 추론/위험 판단 중심 |
| **Sonnet 4.6** | P1, P2, P3 | 사양이 확정된 기계적 편집(git mv, 문자열 치환, 문서 일괄) |
| **Haiku 4.5** | P4 | 저비용 전수 grep 스윕, 판단 불필요 |

## 워크플로 매핑(실행 시)

```text
P0(Opus,high) → [P1→P2](Sonnet 파이프라인) → P3 parallel(Sonnet ×4)
  → P4(Haiku,low) → P5(Opus,high) → P6 parallel(Opus ×3 lens) → 사람 게이트
```
실행 승인 시 위 구조를 `Workflow` 스크립트로 구성한다. 각 P 종료마다 단위 커밋, zip/.ccx는 커밋 제외.
