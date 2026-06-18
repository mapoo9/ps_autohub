# Action Catalog / Picker UX 재정의 작업 플랜

## Summary

- 현재 이슈의 본질은 커스텀 피커 자체보다 `Photoshop actionTree`를 언제 읽고, 언제까지 최신으로 간주하며, 열린 리스트와 사용자 선택값을 어떻게 보호할지에 있다.
- 기존 슬롯 모델은 유지한다. 선택한 Action은 슬롯 순서대로 실행되고, 비활성 슬롯은 `more Actions`로 이동하며, 슬롯별 Set/Action 선택값은 preset으로 저장된다.
- Action 목록 UI는 캐시 기반으로 동작하되, 실행 직전 검증을 최종 기준으로 삼는다.
- `Reset All`은 개념이 섞여 있으므로 `Reset Slots`와 `Refresh Actions`로 분리하는 방향을 기본안으로 한다.

## Current Conclusion

- 현재 구조에서 정리된 부분:
  - Action slot은 선택 순서가 곧 실행 순서다.
  - 각 slot은 `setName`, `actionName`, `enabled` 상태를 가진다.
  - disabled slot은 삭제가 아니라 실행 제외 상태이며 `more Actions` 영역으로 이동한다.
  - preset 저장/복구는 slot 선택 상황을 유지하는 역할이다.
  - catalog refresh는 사용자 선택을 지우기 위한 동작이 아니라, 현재 Photoshop Action 목록과의 존재 여부를 확인하기 위한 동작이다.
- 아직 정책으로 고정해야 하는 부분:
  - 리스트를 열 때 최신 catalog를 기다릴지, 캐시를 먼저 보여줄지.
  - 리스트가 열린 상태에서 refresh 결과가 도착하면 즉시 반영할지, pending으로 보관할지.
  - catalog에 없는 저장된 선택값을 삭제할지, `missing/stale` 상태로 표시할지.
  - Reset과 Refresh의 사용자 의미를 어떻게 나눌지.
  - Run 시작 직전 Action 존재 여부 검증을 어느 레이어에서 확정할지.

## Terms

- `Action Catalog`: Photoshop `actionTree`에서 읽은 Action Set / Action 이름 목록.
- `Committed Catalog`: 현재 UI와 preset 검증에 사용 중인 확정 catalog.
- `Pending Catalog`: 리스트가 열린 상태 등 즉시 반영하면 UX가 흔들릴 수 있어 보류 중인 refresh 결과.
- `Picker Snapshot`: 사용자가 피커를 여는 순간에 화면에 표시되는 목록 사본.
- `Slot Selection`: 사용자가 저장한 `setName/actionName` 문자열. Catalog refresh만으로 삭제하지 않는다.
- `Missing Selection`: Slot Selection이 현재 Committed Catalog에 존재하지 않는 상태.
- `Stale Catalog`: 마지막 refresh 이후 오래되었거나 refresh 실패 가능성이 있는 catalog 상태.

## Design Principles

- UI catalog는 편의용 캐시이고, 최종 실행 가능 여부의 진실은 Run 직전 검증이다.
- 사용자 선택값은 refresh 실패나 일시적인 빈 `actionTree` 때문에 삭제하지 않는다.
- 열린 리스트는 하나의 snapshot으로 취급한다. 사용자가 보고 있는 동안 refresh 결과를 즉시 끼워 넣지 않는다.
- Refresh는 목록 최신화이고 Reset은 사용자 slot 초기화다. 두 동작을 섞지 않는다.
- Photoshop Action 목록이 순간적으로 비어 보이는 경우를 정상적인 빈 목록과 구분한다.

## Proposed User Flow

### 1. Panel Start / Restore

- 저장된 preset을 먼저 복구한다.
- Slot Selection을 화면에 표시한다.
- Action Catalog는 background에서 refresh한다.
- refresh 성공 시 Committed Catalog를 갱신하고 각 slot의 존재 여부만 다시 판정한다.
- refresh 실패 또는 빈 catalog 의심 상황에서는 기존 Slot Selection을 유지하고 catalog 상태를 `stale/failed`로 표시한다.

### 2. Open Action Set Picker

- catalog가 준비되어 있으면 현재 Committed Catalog의 set 목록으로 즉시 연다.
- 동시에 set 목록 refresh를 요청할 수 있다.
- 피커가 열려 있는 동안 refresh 결과는 `Pending Catalog`로 보관한다.
- 사용자가 선택하거나 피커를 닫은 뒤 Pending Catalog를 commit한다.
- 다음에 피커를 열 때 갱신된 목록을 보여준다.

### 3. Open Action Picker

- 선택된 Set의 현재 action 목록을 snapshot으로 표시한다.
- 동시에 해당 Set의 action만 부분 refresh한다.
- 피커가 열린 상태에서는 결과를 즉시 options에 반영하지 않는다.
- 피커가 닫힌 뒤 해당 Set의 action 목록을 commit한다.
- 선택한 Action이 최신 catalog에 없으면 삭제하지 않고 `missing/stale`로 표시한다.

### 4. Change Set

- 사용자가 특정 slot의 Set을 변경하면 그 slot의 Action 선택은 초기화한다.
- 다른 slot의 선택값은 변경하지 않는다.
- 새 Set의 action 목록이 없으면 해당 Set만 refresh 대상으로 삼는다.

### 5. Refresh Actions

- `Refresh Actions`는 Photoshop actionTree를 명시적으로 다시 읽는 버튼이다.
- 기존 slot 선택값은 보존한다.
- refresh 후 존재하지 않는 선택값은 삭제하지 않고 상태만 표시한다.
- actionTree가 빈 값으로 읽히면 기존 catalog를 즉시 비우지 않고 실패/의심 상태로 처리한다.

### 6. Reset Slots

- `Reset Slots`는 사용자 slot 구성을 초기화하는 버튼이다.
- catalog refresh를 수행하지 않는다.
- 최소 1개 빈 slot만 남긴다.
- Action 목록이 이상할 때 누르는 복구 버튼이 아니어야 한다.

### 7. Run Start Validation

- Run 시작 직전에 선택된 각 `setName/actionName`이 현재 Photoshop actionTree에 존재하는지 확인한다.
- 존재하지 않는 선택이 있으면 실행을 막고 어떤 slot이 문제인지 표시한다.
- 검증 중 actionTree를 읽을 수 없으면 retry 가능한 오류로 처리한다.

## Conflict Handling

- refresh가 피커 open 중 완료됨:
  - 열린 피커에는 즉시 반영하지 않는다.
  - 결과는 Pending Catalog로 보관한다.
  - 피커 close/select 이후 commit한다.
- 저장된 Action이 Photoshop에서 삭제/이름 변경됨:
  - Slot Selection은 유지한다.
  - UI에는 `missing` 상태를 표시한다.
  - Run은 해당 slot을 오류로 막는다.
- actionTree가 일시적으로 빈 값으로 읽힘:
  - 기존 Committed Catalog가 있으면 덮어쓰지 않는다.
  - 상태를 `stale/failed`로 표시하고 재시도 안내를 제공한다.
- 여러 slot이 같은 Set을 참조함:
  - catalog는 공유하되 각 slot selection은 독립적으로 유지한다.
- 사용자가 refresh 중 Set/Action을 선택함:
  - 사용자 선택을 우선한다.
  - refresh 결과는 선택 직후 commit하되, 선택값을 지우지 않는다.

## UI Direction

- 기존 `Reset All` 표기는 제거하거나 의미를 바꾼다.
- 기본 버튼 후보:
  - `Reset Slots`: slot 선택 초기화
  - `Refresh Actions`: Photoshop Action 목록 다시 읽기
- 상태 표시 후보:
  - `Actions ready`
  - `Refreshing actions...`
  - `Action list may be outdated`
  - `Some saved actions are missing`
- `Diagnose Actions`는 일반 버튼보다 debug/support 영역에 두는 것이 적합하다.

## Picker Implementation Direction

- 피커가 기본 리스트든 커스텀 피커든 catalog 정책은 동일해야 한다.
- 기본 리스트로 전환하려면 다음 조건을 먼저 만족해야 한다.
  - open 중 options를 즉시 바꾸지 않는 snapshot/pending 정책.
  - 긴 Set/Action 이름 표시 방식.
  - UXP panel 안에서 popup clipping/position 문제가 없는지 검증.
  - keyboard 동작이 실제 UXP에서 안정적인지 검증.
- 커스텀 피커 유지 시 우선 수정 후보:
  - Enter/Space/Arrow/Escape 키 처리 정리.
  - refresh 완료 후 render/reopen 방식 대신 pending commit 방식으로 변경.
  - 커스텀 피커를 사용하는 이유를 코드와 문서에 명시.

## Implementation Steps

1. `Reset All` 개념을 `Reset Slots`와 `Refresh Actions`로 분리한다.
2. Action catalog 상태를 명시한다.
   - `ready`
   - `refreshing`
   - `stale`
   - `failed`
3. `Pending Catalog` 정책을 추가한다.
   - 피커 open 중 refresh 결과는 즉시 commit하지 않는다.
   - close/select 이후 commit한다.
4. Slot Selection 보존 정책을 고정한다.
   - refresh만으로 selection을 삭제하지 않는다.
   - catalog에 없으면 `missing` 상태로 표시한다.
5. Run 시작 직전 Action 존재 여부 검증을 추가한다.
6. 명시적 `Refresh Actions` 버튼을 추가한다.
7. 이후 기본 리스트 전환 가능성을 UXP에서 별도 검증한다.

## Test Plan

- Action Set이 많은 환경에서 피커 open 반응을 확인한다.
- 한 Set에 Action이 많은 환경에서 action picker open, scroll, 선택을 확인한다.
- 피커 open 중 Photoshop Action을 추가/삭제/이름 변경한 뒤 UI가 즉시 흔들리지 않는지 확인한다.
- 피커를 닫고 다시 열었을 때 갱신된 목록이 반영되는지 확인한다.
- 저장된 preset의 Action이 사라진 경우 selection이 삭제되지 않고 `missing`으로 표시되는지 확인한다.
- `Reset Slots`가 catalog를 refresh하지 않고 slot만 초기화하는지 확인한다.
- `Refresh Actions`가 slot 선택값을 유지한 채 catalog 상태만 갱신하는지 확인한다.
- Run 시작 직전 missing action이 있으면 실행이 막히는지 확인한다.
- actionTree가 일시적으로 빈 값일 때 기존 catalog가 사라지지 않는지 확인한다.

## Out Of Scope

- 배치 처리할 파일 수가 많을 때의 실행 성능 문제.
- Debug Mode 이벤트 목록 확장.
- 저장 결과 경로 정책.
- Action 실행 중 Photoshop document 상태 변화 처리.

## Priority

- P0: Reset/Refresh 개념 분리.
- P0: Slot Selection 보존 정책 확정.
- P1: 피커 open 중 refresh 결과 pending 처리.
- P1: Run 직전 Action 존재 여부 검증.
- P2: `Refresh Actions` 버튼과 catalog 상태 표시.
- P2: 기본 리스트 전환 가능성 검증.
