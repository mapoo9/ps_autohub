# Auto-HUB Debug Event 후보 목록

작성일: 2026-06-12
대상 빌드: Auto-HUB `v1.1.3-build003`

이 문서는 Auto-HUB에서 실제로 수집할 이벤트 후보를 관리한다. 공통 Debug Mode 구조와 운영 정책은 `debug-mode-plan.md`를 기준으로 한다.

## Level 1: User Report

- `panel/init/version_handshake`: build, runtime, session 확인
- `batch/run/run_start`: Run 시작
- `batch/run/test_start`: 1 test 시작
- `runPlan/preflight/run_plan_ready`: 실행 대상 파일 수 확인
- `batch/file/file_result`: 파일별 처리 결과
- `batch/run/run_complete`: 완료 summary
- `batch/run/run_cancelled`: 취소 또는 중단 summary
- `batch/run/cancel_requested`: 사용자가 cancel을 누른 시점

## Level 2: Support Diagnostics

- `batch/run/run_config_snapshot`: mode, subfolders, crossOrder, save option, action count
- `runPlan/preflight/run_plan_result`: errors, warnings, rawCounts, output folder 사용 여부
- `batch/runPlan/test_file_list_truncated`: 1 test에서 file list가 줄어든 경우
- `batch/action/action_result`: action 성공/실패, fatal/userStop, 문서 수 변화
- `batch/action/force_stop`: 액션 단계에서 배치 중단
- `batch/save/relative_path_resolved`: subfolder relative path 결정
- `batch/save/save_path_resolved`: 저장 루트와 target folder 결정
- `batch/save/save_result`: PSD/PSB 저장 결과, fallback, 오류 요약
- `batch/close/close_error`: close 단계 오류
- `debug/clipboard/copy_success`: raw log 복사 성공
- `debug/clipboard/copy_failed`: raw log 복사 실패

## Level 3: Developer Trace 후보

아래 이벤트는 재현 어려운 문제를 만났을 때 단계적으로 추가한다. 현재 build003에서는 기존 ActionPresetPart 진단이 `actionCatalog/debug/message` raw 이벤트로 연결되어 있다.

- `actionCatalog/debug/message`: 기존 action catalog/picker console 진단
- `actionCatalog/read/empty_probe`: `app.actionTree` shape, decoded count
- `actionCatalog/read/set_probe`: ActionSet key/sample
- `actionPicker/render/open`: custom picker open/close transition
- `actionPicker/render/normalize_slots`: slot normalize 전후
- `batch/modal/execute_start`: action/save/close modal 진입
- `batch/modal/execute_end`: action/save/close modal 종료
- `batch/timing/phase_duration`: scan, runPlan, action, save, close duration
- `document/state/doc_id_diff`: before/after document id diff

## 필드 관리 원칙

- full path는 저장하지 않고 `name` 또는 `hasNativePath`만 남긴다.
- action set/action name은 필요한 경우 Level 2 raw에만 넣고 화면 표시에는 요약한다.
- Photoshop/UXP 객체 원문은 직접 저장하지 않고 count, name, status 위주로 요약한다.
- 대용량 array/object는 Level 3에서도 요약 또는 cap을 적용한다.
- 이벤트 이름은 `component/phase/event` 형태로 유지한다.
