
/**
 * batchController.js - Auto-HUB v1.1.1 / build 111
 *
 * 목적:
 * - runPlan → action → result-save/close 흐름을 제어한다.
 * - 기본 실행은 원본 문서를 저장하고, 복제/출력 옵션이 있을 때 새 결과 파일을 저장한다.
 * - Save Folder / Save Copy 옵션은 numbered 실행 폴더로 분리한다.
 * - 저장 후 열려 있는 결과 문서는 같은 post-action modal에서 닫는다.
 *
 * BAP v1.4_test003 / build 140 수정:
 * - Subfolders 디버그 로그 콜백 추가
 * - 강제 종료/액션 중단 시 열린 문서 전체 닫기 복구 함수 추가
 */
'use strict';

const { core, app }      = require('photoshop');
const { executeAsModal } = core;
const { LOG_STATUS }     = require('../constants/logStatus');
const { processFile }    = require('./actionRunner');
const { buildRunPlan, makeRunPlanKey, shouldUseTimestampOutput } = require('./runPlan');
const {
  saveAsPsdOrPsb,
  buildFileName,
  ensureRelativeFolder,
  reserveNumberedFile,
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
  const isCrossFolder = config.mode === 'crossFolder';
  const primaryRootFolder = isCrossFolder && config.crossOrder === '2to1'
    ? (config.folder2 || config.folder1)
    : config.folder1;
  const secondaryRootFolder = isCrossFolder
    ? (config.crossOrder === '2to1' ? config.folder1 : (config.folder2 || config.folder1))
    : config.folder1;

  for (const docId of targetDocIds) {
    if (docId === job.docIds.primary) {
      targets.push({
        kind: 'S1',
        docId,
        sourceEntry: job.primary,
        rootSourceFolder: primaryRootFolder,
        baseName: job.primaryBaseName,
        relativeDir: getRelativeDir(job.primary, primaryRootFolder),
        isD2: false,
        newIndex: 0
      });
    } else if (job.secondary && docId === job.docIds.secondary) {
      const useD2 = !!(isCrossFolder && config.folder2 && config.saveFolder1 && !config.saveFolder2);
      targets.push({
        kind: 'S2',
        docId,
        sourceEntry: job.secondary,
        rootSourceFolder: secondaryRootFolder,
        baseName: job.secondaryBaseName,
        relativeDir: getRelativeDir(job.secondary, secondaryRootFolder),
        isD2: useD2,
        newIndex: 0
      });
    } else {
      newIndex += 1;
      targets.push({
        kind: 'NEW',
        docId,
        sourceEntry: job.primary,
        rootSourceFolder: primaryRootFolder,
        baseName: job.primaryBaseName,
        relativeDir: getRelativeDir(job.primary, primaryRootFolder),
        isD2: false,
        newIndex
      });
    }
  }

  return targets;
}

function resolveRootSaveFolder(target, config) {
  if (target.kind === 'S1') return config.saveFolder1 || config.folder1;
  if (target.kind === 'S2') {
    if (config.mode === 'crossFolder') {
      return config.saveFolder2 || config.saveFolder1 || config.folder2 || config.folder1;
    }
    return config.saveFolder1 || config.folder1;
  }
  return config.saveFolder1 || config.folder1;
}

function hasText(value) {
  return String(value || '').trim().length > 0;
}

function shouldSaveInPlace(target, config, executionMode) {
  if (executionMode !== 'run') return false;
  if (target.kind !== 'S1' && target.kind !== 'S2') return false;
  if (config.saveCopy || config.saveFolder1 || config.saveFolder2) return false;
  if (hasText(config.suffix)) return false;
  return true;
}

function folderCacheKey(folder) {
  if (!folder) return '';
  return folder.nativePath || folder.name || String(folder);
}

async function ensureNamedFolder(parent, name) {
  let existing = null;
  try {
    existing = await parent.getEntry(name);
  } catch (_) {
    existing = null;
  }
  if (existing) {
    if (existing.isFolder) return existing;
    throw new Error(`"${name}"는 이미 파일로 존재합니다.`);
  }
  return await parent.createFolder(name);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getNumberedFolderIndex(name, baseName) {
  const match = String(name || '').match(new RegExp('^' + escapeRegExp(baseName) + '_(\\d+)$', 'i'));
  if (!match) return 0;

  const index = Number(match[1]);
  return Number.isSafeInteger(index) && index > 0 ? index : 0;
}

async function getNextNumberedFolderIndex(parent, baseName) {
  let maxIndex = 0;
  try {
    const entries = await parent.getEntries();
    for (const entry of entries) {
      maxIndex = Math.max(maxIndex, getNumberedFolderIndex(entry.name, baseName));
    }
  } catch (_) {
    maxIndex = 0;
  }
  return maxIndex + 1;
}

async function ensureNextNumberedFolder(parent, baseName) {
  let index = await getNextNumberedFolderIndex(parent, baseName);
  while (true) {
    const candidate = `${baseName}_${index}`;
    let existing = null;
    try {
      existing = await parent.getEntry(candidate);
    } catch (_) {
      existing = null;
    }

    if (!existing) return await parent.createFolder(candidate);
    index += 1;
  }
}

function getUsedNamesForFolder(context, folder) {
  const key = folderCacheKey(folder);
  if (!context.usedNamesByFolder.has(key)) context.usedNamesByFolder.set(key, new Set());
  return context.usedNamesByFolder.get(key);
}

async function saveInPlaceOrFallback(doc, task) {
  try {
    if (typeof doc.save !== 'function') {
      throw new Error('document.save API를 사용할 수 없습니다.');
    }
    await doc.save();
    return {
      status: LOG_STATUS.PROCESSED,
      format: 'source',
      error: null,
      savedFileName: task.sourceFileName,
      detail: '원본 저장'
    };
  } catch (saveErr) {
    let fileEntry;
    try {
      fileEntry = await reserveNumberedFile(task.targetFolder, task.desiredPsdName, {
        usedNames: task.usedNames
      });
    } catch (entryErr) {
      return {
        status: LOG_STATUS.ERROR,
        format: null,
        error: `[원본 저장 실패 후 entry 준비 실패] ${saveErr.message} / ${entryErr.message}`
      };
    }

    const fallback = await saveAsPsdOrPsb(doc, fileEntry, false, {
      folder: task.targetFolder,
      psbName: task.desiredPsbName,
      usedNames: task.usedNames
    });
    if (fallback.status === LOG_STATUS.PROCESSED) {
      fallback.detail = `원본 저장 실패 후 새 파일 저장 → ${fallback.savedFileName || fileEntry.name}`;
    } else if (fallback.status === LOG_STATUS.SAVE_ER) {
      fallback.error = `[원본 저장 실패 후 PSB 저장] ${saveErr.message} / ${fallback.error || ''}`;
    } else {
      fallback.error = `[원본 저장 실패 후 새 파일 저장 실패] ${saveErr.message} / ${fallback.error || ''}`;
    }
    return fallback;
  }
}

async function ensureRelativeFolderCached(rootFolder, relativeDir, context) {
  const key = folderCacheKey(rootFolder) + '|' + (relativeDir || '.');
  if (context.relativeFolderCache.has(key)) return context.relativeFolderCache.get(key);
  const folder = await ensureRelativeFolder(rootFolder, relativeDir);
  context.relativeFolderCache.set(key, folder);
  return folder;
}

async function resolveExecutionRootFolder(target, config, plan, executionMode, context) {
  const useGeneratedOutputFolder = shouldUseTimestampOutput(config, executionMode);
  const baseRoot = executionMode === 'test'
    ? (target.rootSourceFolder || config.folder1)
    : resolveRootSaveFolder(target, config);

  if (!useGeneratedOutputFolder) return baseRoot;

  const cacheKey = folderCacheKey(baseRoot) + '|' + executionMode;
  if (context.outputRootCache.has(cacheKey)) return context.outputRootCache.get(cacheKey);

  let parent = baseRoot;
  let baseName = 'Run';
  if (executionMode === 'test') {
    parent = await ensureNamedFolder(baseRoot, '1test');
    baseName = '1test';
  }

  const folder = await ensureNextNumberedFolder(parent, baseName);
  context.outputRootCache.set(cacheKey, folder);
  return folder;
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
    sortBy = 'name_asc', crossOrder = '1to2', mode = 'single',
    testLimit = 0, executionMode = 'run', runPlan = null
  } = config;

  const {
    onPreflight = () => {}, onProgress = () => {}, onFileLog = () => {},
    onComplete = () => {}, onDebugLog = () => {}, shouldCollectLogs = () => true,
    isCancelled = () => false, setCancelled = () => {}
  } = callbacks;

  const canCollectLogs = (level = 1) => {
    try { return !!shouldCollectLogs(level); } catch (_) { return false; }
  };
  const emitFileLog = (factory, level = 1) => {
    if (!canCollectLogs(level)) return;
    onFileLog(typeof factory === 'function' ? factory() : factory);
  };
  const emitDebugLog = (factory, level = 2) => {
    if (!canCollectLogs(level)) return;
    onDebugLog(typeof factory === 'function' ? factory() : factory);
  };
  const emitProgress = (current, total, fileName, level = 1) => {
    if (!canCollectLogs(level)) return;
    onProgress(current, total, fileName);
  };

  let plan;
  try {
    const key = makeRunPlanKey(config);
    plan = runPlan && runPlan.key === key ? runPlan : await buildRunPlan(config);
  } catch (e) {
    onPreflight({ ok: false, errors: ['RunPlan 생성 실패: ' + e.message], warnings: [] });
    return;
  }
  onPreflight(plan);
  if (!plan.ok) return;

  let fileList = plan.fileList.slice();
  if (testLimit > 0 && fileList.length > testLimit) {
    fileList = fileList.slice(0, testLimit);
    emitDebugLog(() => ({
      component: 'batch',
      phase: 'runPlan',
      event: 'test_file_list_truncated',
      severity: 'debug',
      display: `Test file list truncated: ${fileList.length}`,
      data: { testLimit, fileListLength: fileList.length }
    }));
  }

  const total = fileList.length;
  if (total === 0) {
    onComplete({ total: 0, processed: 0, saveEr: 0, skipped: 0, cancelled: false, fatalActionStop: false });
    return;
  }

  const summary = { total, processed: 0, saveEr: 0, skipped: 0, cancelled: false, fatalActionStop: false };
  const isPairedMode = mode !== 'single';
  const runContext = {
    outputRootCache: new Map(),
    relativeFolderCache: new Map(),
    usedNamesByFolder: new Map()
  };

  for (let i = 0; i < total; i++) {
    if (isCancelled()) {
    summary.cancelled = true;
      for (let j = i; j < total; j++) {
        const e = isPairedMode ? fileList[j].primary : fileList[j];
        emitFileLog(() => ({ index: j, fileName: e.name, status: LOG_STATUS.CANCELLED, detail: '' }));
      }
      break;
    }

    const primary = isPairedMode ? fileList[i].primary : fileList[i];
    const secondary = isPairedMode ? fileList[i].secondary : null;
    const primaryBaseName   = primary.name.replace(/\.[^.]+$/, '');
    const secondaryBaseName = secondary ? secondary.name.replace(/\.[^.]+$/, '') : '';
    const beforeDocIds = listCurrentDocIds();

    emitProgress(i + 1, total, primary.name);

    let actionResult;
    try {
      await executeAsModal(async () => {
        actionResult = await processFile(primary, secondary, actions);
      }, { commandName: 'BatchProcess_' + primary.name });
    } catch (e) {
      actionResult = {
        success : false,
        stopBatch: true,
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
    emitDebugLog(() => ({
      component: 'batch',
      phase: 'action',
      event: 'action_result',
      severity: actionResult.status === LOG_STATUS.ERROR ? 'error' : 'debug',
      display: `Action result: ${actionResult.status}`,
      data: {
        fileName: primary.name,
        success: actionResult.success === true,
        stopBatch: !!actionResult.stopBatch,
        status: actionResult.status,
        errorStage: actionResult.errorStage || '',
        fatalActionStop: !!actionResult.fatalActionStop,
        userStop: !!actionResult.userStop,
        docsBefore: beforeDocIds.length,
        docsAfter: afterDocIds.length,
        resultDocCount: resultDocIds.length
      }
    }));

    const shouldStopBatchAfterAction =
      actionResult.success !== true ||
      !!actionResult.stopBatch ||
      !!actionResult.fatalActionStop ||
      (actionResult.status === LOG_STATUS.ERROR && actionResult.errorStage === 'action');

    if (shouldStopBatchAfterAction) {
      summary.cancelled = true;
      summary.fatalActionStop = !!actionResult.fatalActionStop || actionResult.errorStage === 'action';
      emitFileLog(() => ({ index: i, fileName: primary.name, status: LOG_STATUS.ERROR, detail: actionResult.error || '액션 실행 중단' }));
      setCancelled(true);
      emitDebugLog({
        component: 'batch',
        phase: 'action',
        event: 'force_stop',
        severity: 'error',
        display: 'Action-stage stop detected',
        data: {
          keepCurrentDocumentState: true,
          stopFollowingBatchItems: true,
          error: actionResult.error || ''
        }
      });
      for (let j = i + 1; j < total; j++) {
        const e = isPairedMode ? fileList[j].primary : fileList[j];
        emitFileLog(() => ({ index: j, fileName: e.name, status: LOG_STATUS.CANCELLED, detail: '' }));
      }
      break;
    }

    if (actionResult.status === LOG_STATUS.ERROR) {
      summary.skipped++;
      emitFileLog(() => ({ index: i, fileName: primary.name, status: LOG_STATUS.ERROR, detail: actionResult.error }));
      try { await closeDocsByIds(resultDocIds); } catch (_) {}
      continue;
    }

    if (resultDocIds.length === 0) {
      emitFileLog(() => ({ index: i, fileName: primary.name, status: LOG_STATUS.NO_SAVE_TARGET, detail: '열려 있는 결과 문서 없음' }));
      continue;
    }

    const targets = classifyTargets(job, resultDocIds, { folder1, folder2, saveFolder1, saveFolder2, mode, crossOrder });
    const useTimestampNames = shouldUseTimestampOutput(config, executionMode);
    const saveTasks = [];

    for (const target of targets) {
      if (isCancelled()) { summary.cancelled = true; break; }

      const doc = findDocById(target.docId);
      if (!doc) continue;

      const rootFolder = await resolveExecutionRootFolder(target, { folder1, folder2, saveFolder1, saveFolder2, mode, saveCopy }, plan, executionMode, runContext);
      const relativeDir = subfolders ? target.relativeDir : '';
      emitDebugLog(() => ({
        component: 'batch',
        phase: 'save',
        event: 'relative_path_resolved',
        severity: 'debug',
        data: {
          kind: target.kind,
          fileName: target.sourceEntry ? target.sourceEntry.name : '',
          relativeDir: relativeDir || '.'
        }
      }));
      const targetFolder = await ensureRelativeFolderCached(rootFolder, relativeDir, runContext);
      emitDebugLog(() => ({
        component: 'batch',
        phase: 'save',
        event: 'save_path_resolved',
        severity: 'debug',
        data: {
          desiredRootName: rootFolder ? rootFolder.name : '',
          relativeDir: relativeDir || '.',
          targetFolderName: targetFolder ? targetFolder.name : ''
        }
      }));
      const desiredPsdName = buildFileName(target.baseName, 'psd', {
        suffix,
        isD2: target.isD2,
        isCopy: !!saveCopy && !useTimestampNames,
        newIndex: target.newIndex
      });
      const desiredPsbName = buildFileName(target.baseName, 'psb', {
        suffix,
        isD2: target.isD2,
        isCopy: !!saveCopy && !useTimestampNames,
        newIndex: target.newIndex
      });

      const usedNames = getUsedNamesForFolder(runContext, targetFolder);

      if (shouldSaveInPlace(target, { saveCopy, saveFolder1, saveFolder2, suffix }, executionMode)) {
        saveTasks.push({
          mode: 'inPlace',
          target,
          targetFolder,
          desiredPsdName,
          desiredPsbName,
          usedNames,
          sourceFileName: target.sourceEntry ? target.sourceEntry.name : desiredPsdName
        });
        continue;
      }

      let fileEntry;
      try {
        fileEntry = await reserveNumberedFile(targetFolder, desiredPsdName, { usedNames });
      } catch (e) {
        summary.saveEr++;
        emitFileLog(() => ({ index: i, fileName: desiredPsdName, status: LOG_STATUS.ERROR, detail: '[entry 준비 실패] ' + e.message }));
        continue;
      }

      saveTasks.push({ mode: 'newFile', target, targetFolder, fileEntry, desiredPsdName, desiredPsbName, usedNames });
    }

    const saveOutputs = [];
    if (saveTasks.length > 0) {
      try {
        await executeAsModal(async () => {
          for (const task of saveTasks) {
            const liveDoc = findDocById(task.target.docId);
            if (!liveDoc) {
              saveOutputs.push({ task, saveResult: { status: LOG_STATUS.ERROR, format: null, error: '저장 대상 문서가 닫혔습니다.' } });
              continue;
            }
            const saveResult = task.mode === 'inPlace'
              ? await saveInPlaceOrFallback(liveDoc, task)
              : await saveAsPsdOrPsb(liveDoc, task.fileEntry, !!saveCopy, {
                folder: task.targetFolder,
                psbName: task.desiredPsbName,
                usedNames: task.usedNames
              });
            saveOutputs.push({ task, saveResult });
          }

          for (const id of resultDocIds) {
            const doc = findDocById(id);
            if (!doc) continue;
            await doc.closeWithoutSaving();
          }
        }, { commandName: 'BatchSaveClose_' + primary.name });
      } catch (e) {
        const completed = new Set(saveOutputs.map(item => item.task));
        for (const task of saveTasks) {
          if (completed.has(task)) continue;
          saveOutputs.push({ task, saveResult: { status: LOG_STATUS.ERROR, format: null, error: e.message } });
        }
      }
    } else {
      try {
        await closeDocsByIds(resultDocIds);
      } catch (e) {
        emitDebugLog(() => ({
          component: 'batch',
          phase: 'close',
          event: 'close_error',
          severity: 'warning',
          display: 'Close error',
          data: { message: e.message }
        }));
      }
    }

    for (const { task, saveResult } of saveOutputs) {
      const desiredPsdName = task.desiredPsdName;
      const savedName = saveResult.savedFileName || desiredPsdName;
      emitDebugLog(() => ({
        component: 'batch',
        phase: 'save',
        event: 'save_result',
        severity: saveResult.status === LOG_STATUS.PROCESSED ? 'debug' : 'warning',
        data: {
          desiredPsdName,
          savedName,
          status: saveResult.status,
          format: saveResult.format || '',
          targetKind: task.target ? task.target.kind : '',
          targetFolderName: task.targetFolder ? task.targetFolder.name : '',
          error: saveResult.error || ''
        }
      }));
      if (saveResult.status === LOG_STATUS.PROCESSED) {
        summary.processed++;
        emitFileLog(() => ({ index: i, fileName: savedName, status: LOG_STATUS.PROCESSED, detail: saveResult.detail || ('→ ' + savedName) }));
      } else if (saveResult.status === LOG_STATUS.SAVE_ER) {
        summary.saveEr++;
        emitFileLog(() => ({ index: i, fileName: savedName, status: LOG_STATUS.SAVE_ER, detail: saveResult.error || 'PSB fallback 저장' }));
      } else {
        summary.saveEr++;
        emitFileLog(() => ({ index: i, fileName: savedName, status: LOG_STATUS.ERROR, detail: saveResult.error || '저장 실패' }));
      }
    }
  }

  onComplete(summary);
}

module.exports = { runBatch, closeAllOpenDocsWithoutSaving, buildRunPlan, makeRunPlanKey };
