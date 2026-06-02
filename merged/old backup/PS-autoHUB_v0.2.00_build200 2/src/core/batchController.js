
/**
 * batchController.js — PS-autoHUB v0.2.00 / build 200
 *
 * 목적:
 * - preflight → scan → action → result-save 흐름을 제어한다.
 * - 패널 저장 대상은 "원본"이 아니라 액션 종료 후 이번 작업으로 남아 있는 결과 문서다.
 * - Save Copy ON이면 _Copy 이름으로 별도 저장하고, 저장 후 열려 있는 결과 문서는 닫는다.
 * - Save Copy OFF이면 _Copy 없이 최종 결과 이름으로 저장하고, 저장 후 열려 있는 결과 문서는 닫는다.
 *
 * BAP v1.4_test003 / build 140 수정:
 * - Subfolders 디버그 로그 콜백 추가
 * - 강제 종료/액션 중단 시 열린 문서 전체 닫기 복구 함수 추가
 */
'use strict';

const { core, app }      = require('photoshop');
const { executeAsModal } = core;
const { LOG_STATUS }     = require('../constants/logStatus');
const { preflight }      = require('./preflight');
const { scanFiles }      = require('./fileScanner');
const { processFile }    = require('./actionRunner');
const {
  saveAsPsdOrPsb,
  buildFileName,
  ensureRelativeFolder,
  reserveRenameForExistingFile,
  shouldOverwritePsd,
  getRelativeDir
} = require('./saveHandler');

function listCurrentDocIds() {
  const ids = [];
  for (let i = 0; i < app.documents.length; i++) ids.push(app.documents[i].id);
  return ids;
}

function findDocById(id) {
  if (id === null || id === undefined) return null;
  for (let i = 0; i < app.documents.length; i++) {
    if (app.documents[i].id === id) return app.documents[i];
  }
  return null;
}

function diffDocIds(afterIds, beforeIds) {
  const beforeSet = new Set(beforeIds);
  return afterIds.filter(id => !beforeSet.has(id));
}

function classifyTargets(job, targetDocIds, config) {
  const targets = [];
  let newIndex = 0;

  for (const docId of targetDocIds) {
    if (docId === job.docIds.primary) {
      targets.push({
        kind: 'S1',
        docId,
        sourceEntry: job.primary,
        rootSourceFolder: config.folder1,
        baseName: job.primaryBaseName,
        relativeDir: getRelativeDir(job.primary, config.folder1),
        isD2: false,
        newIndex: 0
      });
    } else if (job.secondary && docId === job.docIds.secondary) {
      const useD2 = !!(config.folder2 && config.saveFolder1 && !config.saveFolder2);
      targets.push({
        kind: 'S2',
        docId,
        sourceEntry: job.secondary,
        rootSourceFolder: config.folder2 || config.folder1,
        baseName: job.secondaryBaseName,
        relativeDir: getRelativeDir(job.secondary, config.folder2 || config.folder1),
        isD2: useD2,
        newIndex: 0
      });
    } else {
      newIndex += 1;
      targets.push({
        kind: 'NEW',
        docId,
        sourceEntry: job.primary,
        rootSourceFolder: config.folder1,
        baseName: job.primaryBaseName,
        relativeDir: getRelativeDir(job.primary, config.folder1),
        isD2: false,
        newIndex
      });
    }
  }

  return targets;
}

function resolveRootSaveFolder(target, config) {
  if (target.kind === 'S1') return config.saveFolder1 || config.folder1;
  if (target.kind === 'S2') return config.saveFolder2 || config.saveFolder1 || config.folder2 || config.folder1;
  return config.saveFolder1 || config.folder1;
}

async function closeDocsByIds(docIds = []) {
  if (!docIds.length) return;
  await executeAsModal(async () => {
    for (const id of [...docIds]) {
      const doc = findDocById(id);
      if (!doc) continue;
      await doc.closeWithoutSaving();
    }
  }, { commandName: 'BatchCloseProcessedDocs' });
}


async function closeAllOpenDocsWithoutSaving() {
  const allIds = listCurrentDocIds();
  if (!allIds.length) return 0;
  await executeAsModal(async () => {
    // BAP v1.4_test003 / build 140
    // 강제 종료 복구 시 현재 Photoshop에 열려 있는 문서를 전부 저장 없이 닫는다.
    for (const id of [...allIds]) {
      const doc = findDocById(id);
      if (!doc) continue;
      await doc.closeWithoutSaving();
    }
  }, { commandName: 'BatchForceCloseAllDocs' });
  return allIds.length;
}

async function runBatch(config = {}, callbacks = {}) {
  const {
    folder1 = null, folder2 = null, actions = [], saveCopy = false,
    saveFolder1 = null, saveFolder2 = null, suffix = '', subfolders = false,
    sortBy = 'name_asc', crossOrder = '1to2'
  } = config;

  const {
    onPreflight = () => {}, onProgress = () => {}, onFileLog = () => {},
    onComplete = () => {}, onDebugLog = () => {}, isCancelled = () => false, setCancelled = () => {}
  } = callbacks;

  const preResult = await preflight({ folder1, folder2, actions, saveCopy, saveFolder1, saveFolder2, subfolders });
  onPreflight(preResult);
  if (!preResult.ok) return;

  let fileList;
  try {
    onDebugLog(`[Subfolders][Scan] start subfolders=${subfolders} sort=${sortBy} crossOrder=${crossOrder}`);
    fileList = await scanFiles({ folder1, folder2, subfolders, sortBy, crossOrder });
    onDebugLog(`[Subfolders][Scan] result count=${fileList.length}`);
  } catch (e) {
    onPreflight({ ok: false, errors: ['파일 스캔 실패: ' + e.message], warnings: [] });
    return;
  }

  const total = fileList.length;
  if (total === 0) {
    onComplete({ total: 0, processed: 0, saveEr: 0, skipped: 0, cancelled: false, fatalActionStop: false });
    return;
  }

  const summary = { total, processed: 0, saveEr: 0, skipped: 0, cancelled: false, fatalActionStop: false };

  for (let i = 0; i < total; i++) {
    if (isCancelled()) {
      summary.cancelled = true;
      for (let j = i; j < total; j++) {
        const e = folder2 ? fileList[j].primary : fileList[j];
        onFileLog({ index: j, fileName: e.name, status: LOG_STATUS.CANCELLED, detail: '' });
      }
      break;
    }

    const isCross   = !!folder2;
    const primary   = isCross ? fileList[i].primary   : fileList[i];
    const secondary = isCross ? fileList[i].secondary : null;
    const primaryBaseName   = primary.name.replace(/\.[^.]+$/, '');
    const secondaryBaseName = secondary ? secondary.name.replace(/\.[^.]+$/, '') : '';
    const beforeDocIds = listCurrentDocIds();

    onProgress(i + 1, total, primary.name);

    let actionResult;
    try {
      await executeAsModal(async () => {
        actionResult = await processFile(primary, secondary, actions);
      }, { commandName: 'BatchProcess_' + primary.name });
    } catch (e) {
      actionResult = {
        status  : LOG_STATUS.ERROR,
        error   : e.message,
        userStop: false,
        fatalActionStop: true,
        errorStage: 'action',
        docIds  : { primary: null, secondary: null }
      };
    }

    const afterDocIds = listCurrentDocIds();
    const resultDocIds = diffDocIds(afterDocIds, beforeDocIds);
    const job = { primary, secondary, primaryBaseName, secondaryBaseName, docIds: actionResult.docIds || { primary: null, secondary: null } };

    if (actionResult.fatalActionStop) {
      summary.cancelled = true;
      summary.fatalActionStop = true;
      onFileLog({ index: i, fileName: primary.name, status: LOG_STATUS.ERROR, detail: actionResult.error || '액션 실행 중단' });
      setCancelled(true);
      onDebugLog('[ForceStop] fatalActionStop detected; close all open docs for recovery');
      try { await closeAllOpenDocsWithoutSaving(); } catch (_) {}
      for (let j = i + 1; j < total; j++) {
        const e = folder2 ? fileList[j].primary : fileList[j];
        onFileLog({ index: j, fileName: e.name, status: LOG_STATUS.CANCELLED, detail: '' });
      }
      break;
    }

    if (actionResult.status === LOG_STATUS.ERROR) {
      summary.skipped++;
      onFileLog({ index: i, fileName: primary.name, status: LOG_STATUS.ERROR, detail: actionResult.error });
      try { await closeDocsByIds(resultDocIds); } catch (_) {}
      continue;
    }

    if (resultDocIds.length === 0) {
      onFileLog({ index: i, fileName: primary.name, status: LOG_STATUS.NO_SAVE_TARGET, detail: '열려 있는 결과 문서 없음' });
      continue;
    }

    const targets = classifyTargets(job, resultDocIds, { folder1, folder2, saveFolder1, saveFolder2 });

    for (const target of targets) {
      if (isCancelled()) { summary.cancelled = true; break; }

      const doc = findDocById(target.docId);
      if (!doc) continue;

      const rootFolder = resolveRootSaveFolder(target, { folder1, folder2, saveFolder1, saveFolder2 });
      const relativeDir = subfolders ? target.relativeDir : '';
      onDebugLog(`[Subfolders][Relative] kind=${target.kind} file=${target.sourceEntry ? target.sourceEntry.name : '-'} relative=${relativeDir || '.'}`);
      const targetFolder = await ensureRelativeFolder(rootFolder, relativeDir);
      onDebugLog(`[Subfolders][SavePath] desiredRoot=${rootFolder ? rootFolder.name : '-'} relative=${relativeDir || '.'} targetFolder=${targetFolder ? targetFolder.name : '-'}`);
      const desiredPsdName = buildFileName(target.baseName, 'psd', {
        suffix,
        isD2: target.isD2,
        isCopy: !!saveCopy,
        newIndex: target.newIndex
      });
      const desiredPsbName = buildFileName(target.baseName, 'psb', {
        suffix,
        isD2: target.isD2,
        isCopy: !!saveCopy,
        newIndex: target.newIndex
      });

      // B-01: 소스 .psd + 저장폴더 미지정 케이스 덮어쓰기 여부 결정
      const overwritePsd = shouldOverwritePsd(
        target.sourceEntry,
        resolveRootSaveFolder(target, { folder1, folder2, saveFolder1, saveFolder2 }),
        target.rootSourceFolder,
        !!saveCopy
      );

      let fileEntry;
      try {
        fileEntry = await reserveRenameForExistingFile(targetFolder, desiredPsdName, { overwritePsd });
      } catch (e) {
        summary.saveEr++;
        onFileLog({ index: i, fileName: desiredPsdName, status: LOG_STATUS.ERROR, detail: '[entry 준비 실패] ' + e.message });
        continue;
      }

      let saveResult;
      try {
        await executeAsModal(async () => {
          const liveDoc = findDocById(target.docId);
          saveResult = await saveAsPsdOrPsb(liveDoc, fileEntry, !!saveCopy, {
            folder: targetFolder,
            psbName: desiredPsbName,
            overwritePsd
          });
        }, { commandName: 'BatchSave_' + desiredPsdName });
      } catch (e) {
        saveResult = { status: LOG_STATUS.ERROR, format: null, error: e.message };
      }

      const savedName = saveResult.savedFileName || desiredPsdName;
      if (saveResult.status === LOG_STATUS.PROCESSED) {
        summary.processed++;
        onFileLog({ index: i, fileName: savedName, status: LOG_STATUS.PROCESSED, detail: '→ ' + savedName });
      } else if (saveResult.status === LOG_STATUS.SAVE_ER) {
        summary.saveEr++;
        onFileLog({ index: i, fileName: savedName, status: LOG_STATUS.SAVE_ER, detail: saveResult.error || 'PSB fallback 저장' });
      } else {
        summary.saveEr++;
        onFileLog({ index: i, fileName: savedName, status: LOG_STATUS.ERROR, detail: saveResult.error || '저장 실패' });
      }
    }

    try {
      onDebugLog(`[Close] resultDocIds=${resultDocIds.join(',') || 'none'}`);
      await closeDocsByIds(resultDocIds);
    } catch (e) {
      onDebugLog('[Close][Error] ' + e.message);
    }
  }

  onComplete(summary);
}

module.exports = { runBatch, closeAllOpenDocsWithoutSaving };
