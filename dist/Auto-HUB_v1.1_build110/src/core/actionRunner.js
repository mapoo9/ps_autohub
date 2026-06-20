/**
 * actionRunner.js - Auto-HUB v1.1 / build 110
 *
 * 목적:
 * - 파일을 열고 선택된 액션을 순서대로 실행한다.
 * - 액션 실행 도중 Photoshop 오류 팝업으로 중지되면
 *   현재 액션만 멈추는 것이 아니라 배치 전체를 멈출 수 있도록
 *   fatalActionStop 상태를 명확히 반환한다.
 */
'use strict';

const { action, app } = require('photoshop');
const { batchPlay }   = action;
const { LOG_STATUS }  = require('../constants/logStatus');

const USER_STOP_PATTERNS = [
  /user stop/i, /user cancelled/i, /user canceled/i,
  /stop$/i, /중지/, /사용자/
];

function isUserStop(message = '') {
  return USER_STOP_PATTERNS.some(p => p.test(message));
}

async function openFile(entry) {
  return await app.open(entry);
}

function parseBatchPlayStop(result = []) {
  const items = Array.isArray(result) ? result : [result];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const resultCode = typeof item.result === 'number' ? item.result : null;
    const message = String(item.message || item._message || '');
    if (resultCode === -128) {
      return { stopped: true, userStop: true, message: message || 'User cancelled action execution' };
    }
    if (resultCode !== null && resultCode < 0) {
      return { stopped: true, userStop: false, message: message || `batchPlay error result=${resultCode}` };
    }
    if (item._obj === 'error') {
      return {
        stopped: true,
        userStop: resultCode === -128 || isUserStop(message),
        message: message || 'batchPlay returned an error object'
      };
    }
  }
  return { stopped: false, userStop: false, message: '' };
}

async function runActions(actions) {
  for (const { setName, actionName, enabled } of actions) {
    if (enabled === false) continue;
    if (!setName || !actionName) continue;

    if (app.documents.length === 0) {
      return {
        success: true,
        managedEnd: true,
        stopBatch: false,
        userStop: false,
        fatalActionStop: false,
        error: null
      };
    }

    try {
      const batchResult = await batchPlay([{ _obj: 'play', _target: [
        { _ref: 'action', _name: actionName },
        { _ref: 'actionSet', _name: setName }
      ] }], { modalBehavior: 'execute' });
      const stopInfo = parseBatchPlayStop(batchResult);
      if (stopInfo.stopped) {
        return {
          success: false,
          managedEnd: false,
          stopBatch: true,
          userStop: stopInfo.userStop,
          fatalActionStop: true,
          error: new Error(stopInfo.message)
        };
      }
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      if (isUserStop(msg)) {
        return { success: false, managedEnd: false, stopBatch: true, userStop: true, fatalActionStop: true, error: e };
      }
      // 액션 실행 중 Photoshop 오류가 발생하면 배치 전체를 멈춰야 한다.
      return { success: false, managedEnd: false, stopBatch: true, userStop: false, fatalActionStop: true, error: e };
    }

    if (app.documents.length === 0) {
      return {
        success: true,
        managedEnd: true,
        stopBatch: false,
        userStop: false,
        fatalActionStop: false,
        error: null
      };
    }
  }

  return { success: true, managedEnd: false, stopBatch: false, userStop: false, fatalActionStop: false, error: null };
}

async function processFile(primary, secondary, actions) {
  let primaryDocId   = null;
  let secondaryDocId = null;

  try {
    const doc = await openFile(primary);
    primaryDocId = doc.id;
  } catch (e) {
    return { success: false, stopBatch: false, status: LOG_STATUS.ERROR, error: '[STEP1 open F1] ' + e.message, userStop: false, fatalActionStop: false, errorStage: 'open', docIds: { primary: null, secondary: null } };
  }

  if (secondary) {
    try {
      const doc = await openFile(secondary);
      secondaryDocId = doc.id;
    } catch (e) {
      return { success: false, stopBatch: false, status: LOG_STATUS.ERROR, error: '[STEP2 open F2] ' + e.message, userStop: false, fatalActionStop: false, errorStage: 'open', docIds: { primary: primaryDocId, secondary: null } };
    }
  }

  try {
    const result = await runActions(actions);

    if (result.userStop) {
      return { success: false, stopBatch: true, status: LOG_STATUS.ERROR, error: '[STEP3 action] 사용자 중지', userStop: true, fatalActionStop: true, errorStage: 'action', docIds: { primary: primaryDocId, secondary: secondaryDocId } };
    }
    if (result.stopBatch) {
      return {
        success: false,
        stopBatch: true,
        status: LOG_STATUS.ERROR,
        error: '[STEP3 action] ' + (result.error && result.error.message ? result.error.message : '액션 종료 후 문서 상태 확인 실패'),
        userStop: false,
        fatalActionStop: true,
        errorStage: 'action',
        docIds: { primary: primaryDocId, secondary: secondaryDocId }
      };
    }
    if (result.error) {
      return { success: false, stopBatch: !!result.fatalActionStop, status: LOG_STATUS.ERROR, error: '[STEP3 action] ' + result.error.message, userStop: false, fatalActionStop: !!result.fatalActionStop, errorStage: 'action', docIds: { primary: primaryDocId, secondary: secondaryDocId } };
    }
    if (result.managedEnd) {
      return { success: true, stopBatch: false, status: LOG_STATUS.ACTION_MANAGED_END, error: null, userStop: false, fatalActionStop: false, errorStage: null, docIds: { primary: primaryDocId, secondary: secondaryDocId } };
    }
  } catch (e) {
    return { success: false, stopBatch: true, status: LOG_STATUS.ERROR, error: '[STEP3 action] ' + e.message, userStop: false, fatalActionStop: true, errorStage: 'action', docIds: { primary: primaryDocId, secondary: secondaryDocId } };
  }

  return { success: true, stopBatch: false, status: LOG_STATUS.PROCESSED, error: null, userStop: false, fatalActionStop: false, errorStage: null, docIds: { primary: primaryDocId, secondary: secondaryDocId } };
}

module.exports = { processFile, openFile, runActions };
