# 범용 Debug Mode 구현 작업지시서

작성일: 2026-06-12

## 목적

Debug Mode는 프로젝트 공통 진단 인프라다. 목표는 사용자 제보, 지원 분석, 개발자 추적을 같은 데이터 흐름으로 처리하되, 기본 실행에는 성능과 보안 영향을 주지 않는 것이다.

이 문서는 모든 프로젝트에 재사용할 수 있는 구조와 정책만 다룬다. 실제 이벤트 목록은 프로젝트별 `debug-log-events.md`에서 관리한다.

## Debug Level 정의

- `0 Off`: 기본 운영 모드. 로그 수집, 표시, 복사를 하지 않는다.
- `1 User Report`: 사용자가 실행 여부와 멈춘 지점을 전달할 수 있는 수준이다. 화면 표시 중심이며 파일명, 상태, 요약만 남긴다.
- `2 Support Diagnostics`: 개발자가 문제 구간을 좁힐 수 있는 수준이다. 설정 snapshot, 실행 결과, 저장/통신 결과 등 구조화 raw 데이터를 복사 로그에 포함한다.
- `3 Developer Trace`: 재현 어려운 런타임/렌더링/동기화 문제를 추적하는 수준이다. 내부 상태, timing, host/runtime probe를 raw에 남기되 화면에는 기본 표시하지 않는다.

## 기본 정책

- 기본값은 `debugLevel = 0`, `debugUiVisible = false`다.
- 배포/설치 빌드에서는 Debug UI를 기본 노출하지 않는다.
- Debug UI는 내부 API, feature flag, local setting 같은 별도 경로로만 노출한다.
- Debug Level이 `1` 이상일 때만 로그 수집을 허용한다.
- 화면 로그와 raw 로그는 항상 분리한다.
- 화면 로그는 사용자가 읽을 수 있는 요약만 표시한다.
- Copy/Export는 redaction이 적용된 raw buffer를 `header + NDJSON` 형태로 내보낸다.
- 자동 파일 저장은 기본 기능으로 두지 않는다. 복사 후 전달을 기본 경로로 삼는다.

## 공통 구성요소

- `DebugController`: level, UI visible, session, event push, copy, clear를 관리한다.
- `DebugConfig`: level 상수, schema version, buffer limit, build fingerprint 기본값을 관리한다.
- `DebugBuffer`: raw/display ring buffer와 entry/byte cap을 관리한다.
- `DebugSink`: UI나 외부 출력 대상에 display/change 이벤트를 전달한다.
- `DebugRedactor`: secrets, token, full path, 개인정보성 문자열, 대용량 payload를 제거하거나 요약한다.

## 공통 API

```js
setDebugLevel(0 | 1 | 2 | 3)
getDebugLevel()
shouldLog(level)
setDebugUiVisible(boolean)
isDebugUiVisible()
pushDebugEvent(level, event)
copyDebugLog()
clearDebugLog()
```

브라우저/데스크톱 앱에서는 내부 콘솔 API도 제공한다.

```js
window.AppDebug.setVisible(true)
window.AppDebug.setLevel(2)
window.AppDebug.copyDebugLog()
```

## Raw Event Shape

```js
{
  schemaVersion: 1,
  sessionId: "debug-...",
  seq: 1,
  timestamp: "2026-06-12T12:34:56.000Z",
  level: 2,
  source: "app",
  component: "batch",
  phase: "save",
  event: "save_result",
  severity: "info",
  correlationId: "run-...",
  display: "Saved sample_001.psd",
  buildFingerprint: {
    appVersion: "1.1.1",
    frontendBuild: "v1.1.1-build111",
    backendVersion: null,
    apiVersion: null,
    dbSchemaVersion: null,
    nativeShellVersion: "UXP",
    protocolVersion: null,
    packageBuildId: "build111",
    runtimeLoadedPath: "..."
  },
  data: {}
}
```

## Data Flow

1. 이벤트 발생 지점은 UI나 파일에 직접 쓰지 않고 `pushDebugEvent(level, event)`만 호출한다.
2. `DebugController`는 현재 level과 UI flag를 확인해 수집 여부를 결정한다.
3. 수집 대상 이벤트는 `DebugRedactor`를 먼저 통과한다.
4. redacted event는 raw buffer에 저장된다.
5. `display`가 있고 level이 `1` 또는 `2`이면 display buffer에도 저장된다.
6. UI 로그창은 display buffer만 렌더한다.
7. Copy/Export는 raw buffer를 header와 NDJSON으로 만든다.
8. frontend/backend/native/db가 나뉜 프로젝트는 같은 `sessionId`와 `correlationId`를 전달해 계층 간 이벤트를 묶는다.

## Version Handshake

프로젝트 시작 또는 Debug Level 활성화 시 version handshake 이벤트를 1회 남긴다.

- frontend-only: app version, frontend build, runtime loaded path
- Tauri/Electron/native shell: shell version, command protocol version
- backend/API: backend version, API version
- DB 포함 프로젝트: migration/schema version
- plugin/extension/UXP: host/runtime version, package build id

버전 또는 protocol mismatch가 있으면 Level 1에는 warning 요약, Level 2 raw에는 실제 비교 정보를 남긴다.

## Buffer And Retention

- Level 1/2 raw buffer: 최근 1,000 events 또는 1MB
- Level 3 raw buffer: 최근 5,000 events 또는 5MB
- display buffer: 최근 1,000 events 또는 512KB
- cap 초과 시 오래된 raw부터 제거하고 export header에 `truncated=true`를 표시한다.
- raw log는 앱 내부에 장기 보관하지 않는다.
- 이슈 대응용 raw log는 기본 2주 보관 후 삭제한다.
- 릴리스/회귀 추적 건만 최대 1달 보관한다.
- 보관 기간이 지나면 raw는 삭제하고 summary만 남긴다.

## Summary 보관 형식

raw 삭제 후 남길 summary에는 다음만 유지한다.

- 발생일, 프로젝트, build/version
- 증상 요약
- 재현 조건
- 원인 요약
- 수정 여부와 관련 커밋/파일
- raw 삭제일

## 프로젝트별 고려사항

- Frontend-only: route/state transition, API request summary, render timing 중심
- Tauri/Electron/native: frontend event와 native command event를 `correlationId`로 연결
- Backend/API: request id, route, status, duration, upstream 결과 요약 중심
- DB 포함: schema version, query name, duration, row count, transaction boundary 중심
- Plugin/extension/UXP: host runtime 상태와 clipboard copy fallback을 중점 확인
- 멀티 패키지/배포 산출물: source commit, package build id, runtime loaded path를 export header에 포함

## 검증 기준

- Level 0에서 로그가 수집되지 않고 UI가 숨겨진다.
- Level 1에서 사용자 제보용 실행 요약만 화면에 표시된다.
- Level 2에서 raw copy에 설정 snapshot과 결과 객체 요약이 포함된다.
- Level 3에서 상세 raw는 copy에 포함되지만 화면을 과도하게 채우지 않는다.
- buffer cap이 동작하고 `truncated=true`가 표시된다.
- token, password, full path, 이메일 등 민감 정보가 redaction된다.
- clipboard 실패 시 화면 로그를 선택 복사할 수 있다.
