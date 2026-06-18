# 전체 프로젝트 공통 개선 항목

작성일: 2026-06-12

## 목적

이 문서는 Process DEV 분기에서 발견했지만, Process 전용이 아니라 Auto-HUB 메인에도 영향을 줄 수 있는 공통 개선 항목만 정리한다.

Process Editor, Script Library, Check Layer, Save As gate, Test Process 버튼처럼 DEV Process 기능에만 해당하는 항목은 제외한다.

권장 진행 방향은 다음과 같다.

- 메인 브랜치에서 공통 개선 항목을 먼저 정리한다.
- 정리된 메인 변경을 DEV worktree/Process 분기로 가져온다.
- DEV 분기에서는 Process 전용 기능 개발과 공통 변경 충돌 해결에 집중한다.

## 1. Action UI 렌더링 구조 안정화

### 현재 상태

기획 문서의 안정 기준은 Action slot UI를 `native select + flex row` 구조로 유지하는 것이다.

하지만 현재 구현은 `ActionPresetPart`에서 custom picker를 사용한다. 이 구조는 팝업 위치, 선택 라벨, 닫힌 상태 표시, 재렌더 타이밍을 직접 관리한다.

### 위험

- 과거에 확인된 `No Action` 또는 placeholder 라벨 표시 문제가 다시 발생할 수 있다.
- Photoshop UXP 렌더링 특성과 충돌할 가능성이 있다.
- Action catalog refresh와 picker open 상태가 겹칠 때 UI 상태가 흔들릴 수 있다.
- 메인 Action-only 패널에서도 직접 영향을 받는다.

### 개선 방향

- 메인에서 Action slot UI 구조를 다시 검토한다.
- 가능하면 기획 문서 기준인 `native select + flex row`로 되돌린다.
- custom picker를 유지해야 한다면, 그 이유와 검증 기준을 문서화한다.
- Photoshop UXP 실제 패널에서 초기 로드, 프리셋 복원, Action select 클릭, refresh, 다중 slot 케이스를 수동 검증한다.

## 2. Reset All 동작 정책 정리

### 현재 상태

기획 문서의 `Refresh All Actions` 또는 `Reset All` 정책은 다음과 같다.

- 저장된 Action preset 삭제
- 빈 slot 1개만 표시
- 추가 catalog reload는 하지 않음

현재 구현은 reset 후 catalog refresh를 다시 수행한다.

### 위험

- 사용자가 reset을 눌렀는데 actionTree 읽기 지연이나 빈 catalog 상태에 영향을 받을 수 있다.
- 문서화된 UX와 실제 동작이 달라진다.
- reset이 순수 초기화인지 catalog 재탐색인지 의미가 불분명해진다.

### 개선 방향

- 버튼 의미를 하나로 확정한다.
- 순수 초기화라면 reset 이후 catalog refresh를 제거한다.
- catalog refresh가 필요하다면 버튼 이름과 문서를 `Refresh Catalog` 계열로 맞춘다.
- 메인에서 정책을 확정한 뒤 DEV 분기로 가져온다.

## 3. 초기 로드와 저장 preset 복원 타이밍

### 현재 상태

문서상 정책은 저장된 preset이 있으면 먼저 복원해서 즉시 표시하고, fresh catalog 응답 전까지 현재 표시 상태를 유지하는 것이다.

현재 흐름은 `loadPreset` 이후 catalog refresh가 이어지고, 렌더링 타이밍이 catalog read 결과에 영향을 받을 수 있다.

### 위험

- Photoshop `actionTree`가 늦게 준비되거나 일시적으로 빈 배열을 반환하면 저장된 slot 표시가 흔들릴 수 있다.
- 패널을 처음 열었을 때 최소 기본 slot 1개가 즉시 보인다는 테스트 기준이 불안정해질 수 있다.
- 저장된 preset이 있는 사용자의 신뢰감이 떨어진다.

### 개선 방향

- `loadPreset` 직후 최소 slot 렌더를 보장한다.
- catalog refresh는 표시 상태를 무효화하지 않는 백그라운드 보정 단계로 분리한다.
- fresh catalog 도착 후 삭제된 Action만 해당 slot 단위로 보정한다.
- actionTree empty/transient 상태에서는 기존 표시 상태를 유지한다.

## 4. Action Managed End 로그 의미 정리

### 현재 상태

액션이 문서를 닫고 종료하는 경우는 정상 처리로 간주해야 한다.

코드에는 `ACTION_MANAGED_END` 상태가 존재하지만, 실행 흐름상 결과 문서가 없을 때 `NO_SAVE_TARGET`로 로그가 남을 여지가 있다.

### 위험

- 정상 종료와 저장 대상 없음이 같은 의미처럼 보일 수 있다.
- 사용자가 액션 내부에서 문서를 닫는 의도적 workflow를 오류나 누락으로 오해할 수 있다.
- 처리 요약 통계와 디버그 로그 해석이 어려워진다.

### 개선 방향

- `processFile` 결과가 `ACTION_MANAGED_END`인 경우 저장 단계에서 별도 로그로 남기도록 정리한다.
- `NO_SAVE_TARGET`은 예상하지 못한 저장 대상 없음에만 사용한다.
- summary count에서 managed end를 processed로 볼지 별도 카운트로 볼지 정책을 확정한다.

## 5. Preflight와 RunPlan 검증 로직 통합

### 현재 상태

`preflight.js`와 `runPlan.js`가 유사한 실행 전 검증 책임을 가진다.

현재 실행 경로는 사실상 `runPlan.js` 중심이다.

### 위험

- 같은 정책이 두 파일에서 다르게 진화할 수 있다.
- 버그 수정이 한쪽에만 반영될 수 있다.
- 메인과 DEV에서 검증 결과가 달라질 수 있다.

### 개선 방향

- 실행 전 검증의 단일 진입점을 정한다.
- 가능하면 `runPlan.js`가 file list 생성과 validation result를 모두 책임지게 한다.
- `preflight.js`를 제거하거나 `runPlan.js`를 호출하는 얇은 호환 wrapper로 축소한다.
- 문서의 validation 기준도 단일 흐름 기준으로 업데이트한다.

## 6. Debug Mode 로그 체계 정리

### 현재 상태

v1.1.1 build111 기준으로 numeric debug level, raw/display buffer 분리, redaction, raw copy 기반은 추가되었다.

UXP 패널은 일반 앱처럼 런타임 확인이 자유롭지 않기 때문에, 사용자가 로그를 복사해서 분석 요청을 할 수 있는 체계가 계속 필요하다.

공통 설계는 `docs/추가작업/debug-mode-plan.md`, Auto-HUB 이벤트 후보는 `docs/추가작업/debug-log-events.md`에 정리한다.

### 위험

- 문제 발생 시 재현 정보가 부족할 수 있다.
- 로그를 너무 많이 표시하면 사용자 UI가 복잡해지고 성능에도 영향을 줄 수 있다.
- 반대로 로그가 부족하면 UXP/Photoshop 상태 문제를 확인하기 어렵다.
- 설치 빌드에서 debug UI가 노출되면 일반 사용자에게 혼란을 줄 수 있다.

### 개선 방향

- Debug Mode level별 이벤트 목록을 실제 이슈를 보며 계속 선별한다.
- Level 3 후보는 actionTree, picker/render, modal/timing 중심으로 필요한 것만 추가한다.
- 설치/배포 빌드에서 Debug Mode UI가 기본 비노출인지 실제 UXP 패널에서 확인한다.
- raw log 보관은 2주 기본, 회귀/릴리스 추적 건만 최대 1달로 운영한다.

## 7. 루트 소스와 배포 패키지 동기화 정책

### 현재 상태

2026-06-14 설치 빌드 기준으로 루트 소스와 `merged/Auto-HUB_v1.1.1_build111` 배포 패키지는 동기화되었다.

이전에는 Debug Mode, Action slot 기본 렌더, 폴더 안내 fallback 등 추가 변경이 루트에만 있고 패키지에는 누락되어 있었다. 이후 루트 변경이 생기면 다시 패키지 동기화가 필요하다.

### 위험

- 실제 테스트 대상과 수정 대상이 달라질 수 있다.
- 메인 릴리스 기준이 루트인지 `merged` 패키지인지 불명확해질 수 있다.
- DEV에서 수정한 공통 코어가 배포 패키지에 누락될 수 있다.

### 개선 방향

- 메인 기준 source of truth를 루트 소스로 확정한다.
- `merged/*`는 빌드 산출물 또는 설치 패키지로 취급한다.
- 패키지 생성 절차는 `docs/build-release-guide.md`를 기준으로 한다.
- Photoshop UXP Developer Tool이 루트와 `merged/*` 중 어느 폴더를 로드 중인지 항상 확인한다.

## 권장 작업 순서

1. 메인에서 Action UI, Reset All, preset restore, Action Managed End, validation 통합, Debug Mode, 패키지 동기화 정책을 정리한다.
2. 메인에서 Photoshop UXP 실제 패널 수동 검증을 완료한다.
3. 정리된 메인 변경을 `codex/dev` worktree로 가져온다.
4. DEV 분기에서는 Process 전용 기능을 이어서 개발한다.
5. Process 기능이 안정화되면 메인 병합 또는 별도 앱 유지 여부를 결정한다.
