# Auto-HUB Worklog Guide

작성일: 2026-06-14

## 목적

이 문서는 Auto-HUB 프로젝트에서 worklog, commit, package sync를 어떤 기준으로 구분할지 정리한다. 범용 원칙은 `/Users/kisoon/Documents/0_vibeCoding/공통/docs/WORKLOG_GUIDE.md`를 참고하되, 이 문서는 Auto-HUB의 UXP 패널, Action catalog, 설치 패키지 흐름에 맞춘 프로젝트 기준이다.

## Work 단위

Auto-HUB에서 하나의 work는 하나의 사용자-visible 목적을 가진 변경 묶음이다.

예시:

- Action catalog/picker 표시 정책 수정
- Debug Mode 이벤트 체계 추가
- RunPlan/save 경로 정책 수정
- UXP 패널 레이아웃 또는 accordion 동작 수정
- 릴리즈 패키지 동기화와 검증

다음은 같은 work에 섞지 않는다.

- 기능 변경과 릴리즈 패키징 정리
- UI 색상/레이아웃 변경과 batch 실행 로직 변경
- Debug Mode 구조 변경과 Action 실행 정책 변경
- 문서 정리와 실제 런타임 수정

## Worklog를 남길 때

다음 경우에는 `docs/WORKLOG.md`에 짧게 남긴다.

- 코드 diff만 보면 왜 그런 결정을 했는지 알기 어려운 경우
- UXP/Photoshop 런타임 제약 때문에 구현 범위를 조정한 경우
- 루트 소스와 `dist/*` 패키지의 차이가 문제 원인이 된 경우
- 수동 검증이 필요하지만 아직 완료하지 못한 경우
- Reset/Refresh, Action slot, 저장 정책처럼 UX 용어를 재정의한 경우
- 사용자 제보 기반으로 증상과 원인을 분리한 경우

남기지 않아도 되는 경우:

- 오타 수정
- 단일 파일의 명확한 스타일 수정
- 테스트 결과만으로 충분히 설명되는 작은 버그 수정

## Worklog 형식

`docs/WORKLOG.md`에는 최신 항목을 위에 둔다.

```md
## YYYY-MM-DD - 제목

- 목적:
- 변경:
- 결정:
- 검증:
- 남은 작업:
```

긴 diff 복사보다 결정, 제약, 검증 상태를 우선한다.

## Commit 기준

commit은 완료된 work를 로컬 이력으로 고정하는 단계다.

commit 전 확인:

- 현재 변경이 하나의 목적을 갖는가
- 관련 없는 파일 변경이 섞이지 않았는가
- `node --check` 등 가능한 정적 검증을 수행했는가
- UXP 수동 검증이 필요한 경우 완료/미완료 상태를 설명할 수 있는가
- `dist/*` 패키지까지 반영해야 하는 작업인지 분리했는가

## Package Sync 기준

Auto-HUB는 루트 소스와 설치 패키지 폴더가 분리되어 있다.

- 루트: 개발 source of truth
- `dist/Auto-HUB_vX.Y.Z_buildNNN`: 설치/배포용 패키지 산출물

루트에서 고친 내용을 Photoshop에서 확인하려면 현재 UXP Developer Tool이 어느 폴더를 로드 중인지 먼저 확인한다. 설치 패키지 폴더를 로드 중이라면 루트 변경은 자동 반영되지 않는다.

패키지 동기화가 필요한 경우:

- 사용자에게 설치본을 전달할 때
- Photoshop에서 `dist/*` 폴더로 테스트할 때
- 새 파일/폴더가 추가된 경우
- `manifest.json`, `index.js`, `index.html`, `styles`, `src`, `assets` 중 하나라도 릴리즈 영향이 있을 때

## Push 기준

push는 작업 브랜치 이력을 원격에 공유하는 단계다. 보호 브랜치, upstream 불명확, 검증 실패, stage 범위 불명확, force push 필요 상황에서는 자동으로 처리하지 않고 사용자에게 상태를 설명한다.
