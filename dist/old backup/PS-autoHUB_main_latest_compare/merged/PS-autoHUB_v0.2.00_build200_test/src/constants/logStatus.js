/**
 * logStatus.js
 * 로그 상태 상수 — 패널 전체에서 공통으로 사용
 */

'use strict';

const LOG_STATUS = {
  PROCESSED          : 'Processed',           // 정상 처리 + 저장 완료
  ACTION_MANAGED_END : 'Action Managed End',  // 액션 내부에서 문서가 닫힘
  NO_SAVE_TARGET     : 'No Save Target',      // 저장 대상 없음 (문서 없음)
  SAVE_ER            : 'SaveEr',              // 저장 실패 → _SaveEr.psd fallback
  SKIPPED            : 'Skipped',             // 지원하지 않는 포맷 등 건너뜀
  ERROR              : 'Error',               // 예외 발생
  CANCELLED          : 'Cancelled'            // 사용자 취소
};

module.exports = { LOG_STATUS };
