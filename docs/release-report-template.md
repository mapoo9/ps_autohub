# Auto-HUB vX.Y.Z / build NNN 릴리즈 보고서

릴리즈 날짜: YYYY-MM-DD

## 패치 범위

이번 설치본의 목적과 적용 범위를 간략히 적는다.

## 확인 가능한 작업 범위

- Git commit: `<hash>` 또는 `미커밋 작업 범위`
- Git tag: `vX.Y.Z` 또는 `vX.Y.Z-buildNNN`
- 변경 범위: `index.js`, `src/...`, `styles/...`, `docs/...`, `dist/...`
- 패키지 폴더: `dist/Auto-HUB_vX.Y.Z_buildNNN`

## 추가 기능

- 기능 흐름 또는 사용자 우선순위 순서로 작성한다.

## 수정사항

- YYYY-MM-DD: 수정 내용을 작성한다.

## 버그 수정

- YYYY-MM-DD: 버그 수정 내용을 작성한다.

## 설치/업데이트 참고사항

- UXP Developer Tool에서 추가할 폴더:
- 기존 패널을 닫고 다시 열어야 하는지:
- 기존 Action preset 유지 여부:
- 수동 제거가 필요한 이전 패키지:

## 검증 결과

- 루트 정적 검증:
- 패키지 내부 구조 확인:
- 앱 버전/빌드 번호 확인: 앱 UI에는 앱 버전만 표시하고, 빌드 번호는 내부 토큰/패키지명/보고서에서 확인한다.
- Photoshop UXP 설치 테스트:
- ACTION 기본 slot / picker 테스트:
- OPEN/SAVE 폴더 선택 테스트:
- 1 test:
- Run:
- Debug UI 기본 비노출:
- 체크섬: 최종 zip 외부 배포 메모에 기록한다. 패키지 내부 보고서에 zip 체크섬을 넣으면 순환 참조가 생긴다.
