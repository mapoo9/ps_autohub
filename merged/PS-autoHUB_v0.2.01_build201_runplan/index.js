/**
 * index.js — PS-autoHUB v0.2.01 / build 201
 *
 * Hub controller:
 * - initialize feature parts
 * - compose run payload
 * - handle run/cancel
 * - manage logs, progress, and alerts
 */
'use strict';

let isUxpRuntime = false;
let fs = null;
let clipboard = null;
let uxpModule = null;
let runBatch = async () => {};
let buildRunPlan = async () => ({ ok: false, errors: ['RunPlan unavailable'], warnings: [], fileList: [] });
let makeRunPlanKey = () => '';
let LOG_STATUS = {
  PROCESSED: 'PROCESSED',
  ACTION_MANAGED_END: 'ACTION_MANAGED_END',
  SAVE_ER: 'SAVE_ER',
  SKIPPED: 'SKIPPED',
  ERROR: 'ERROR',
  CANCELLED: 'CANCELLED',
  NO_SAVE_TARGET: 'NO_SAVE_TARGET'
};
const BUILD_TOKEN = 'v0.2.01-build201-runplan';
if (typeof console !== 'undefined' && console.log) {
  try { console.log('[PS-autoHUB] booting build', BUILD_TOKEN); } catch (_) {}
}

if (typeof require === 'function') {
  try {
    const uxp = require('uxp');
    if (uxp && uxp.storage && uxp.storage.localFileSystem) {
      uxpModule = uxp;
      isUxpRuntime = true;
      fs = uxp.storage.localFileSystem;
      clipboard = uxp && uxp.clipboard ? uxp.clipboard : null;
      ({ runBatch, buildRunPlan, makeRunPlanKey } = require('./src/core/batchController'));
      ({ LOG_STATUS } = require('./src/constants/logStatus'));
    }
  } catch (_) {
    isUxpRuntime = false;
  }
}

const { createInputPart } = require('./src/ui/inputPart');
const { createActionPresetPart } = require('./src/ui/actionPresetPart');
const { createOutputPart } = require('./src/ui/outputPart');

const state = {
  running: false,
  cancelRequested: false,
  logEntries: [],
  logExpanded: false,
  hubInitialized: false,
  hubInitPromise: null,
  lastRunPlan: null,
  debugMode: false
};

const $ = (id) => document.getElementById(id);

function syncSelectWidth(selectEl, { min = 84, max = 170, extra = 34 } = {}) {
  if (!selectEl) return;
  const text = selectEl.options[selectEl.selectedIndex]?.textContent || '';
  let nextWidth = min;

  try {
    const style = window.getComputedStyle(selectEl);
    const canvas = syncSelectWidth.canvas || (syncSelectWidth.canvas = document.createElement('canvas'));
    const ctx = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;

    if (ctx && typeof ctx.measureText === 'function') {
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const textWidth = Math.ceil(ctx.measureText(text).width);
      nextWidth = Math.max(min, Math.min(max, textWidth + extra));
    } else {
      nextWidth = Math.max(min, Math.min(max, text.length * 9 + extra));
    }
  } catch (_) {
    nextWidth = Math.max(min, Math.min(max, text.length * 9 + extra));
  }

  selectEl.style.width = nextWidth + 'px';
}

const inputPart = createInputPart({
  fs,
  isUxpRuntime,
  syncSelectWidth,
  onChange: (nextState) => {
    invalidateRunPlan();
    if (outputPart && typeof outputPart.setFolder2Expanded === 'function') {
      outputPart.setFolder2Expanded(!!(nextState && nextState.folder2Expanded));
    }
    updateDebugPanel();
  }
});

const actionPresetPart = createActionPresetPart({
  app: isUxpRuntime ? require('photoshop').app : { actionTree: [] },
  isUxpRuntime,
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  onChange: () => {
    invalidateRunPlan();
    updateDebugPanel();
  },
  onProblem: (error) => showAlert('Action List Error', 'Failed to read the Photoshop action list.\n' + error.message)
});

const outputPart = createOutputPart({
  fs,
  isUxpRuntime,
  onChange: () => {
    invalidateRunPlan();
    updateDebugPanel();
  },
  onFolder2Toggle: () => {
    if (!inputPart || typeof inputPart.setFolder2Expanded !== 'function') return;
    const current = inputPart.getState ? inputPart.getState() : null;
    inputPart.setFolder2Expanded(!(current && current.folder2Expanded));
  }
});

const EXT_ABBR = { jpeg: 'JPG', tiff: 'TIF', heic: 'HIC', heif: 'HIF', webp: 'WBP', avif: 'AVF' };

function extBadge(ext) {
  const upper = ext.toUpperCase();
  return EXT_ABBR[ext.toLowerCase()] || (upper.length > 3 ? upper.slice(0, 3) : upper);
}

function truncateBase(base, max = 16) {
  return base.length <= max ? base : base.slice(0, max - 1) + '…';
}

function showAlert(title, message) {
  $('alertTitle').textContent = title;
  $('alertMessage').textContent = message;
  $('alertBackdrop').style.display = 'flex';
}

function hideAlert() {
  $('alertBackdrop').style.display = 'none';
}

function setLogExpanded(expanded) {
  state.logExpanded = !!expanded;
  const toggle = $('btnToggleLog');
  const content = $('logContent');
  const section = $('section-log');
  if (!toggle || !content || !section) return;

  toggle.setAttribute('aria-expanded', String(state.logExpanded));
  content.hidden = !state.logExpanded;
  section.classList.toggle('is-expanded', state.logExpanded);
}

function invalidateRunPlan() {
  state.lastRunPlan = null;
}

function setFooterState(label) {
  $('footerState').textContent = label;
  $('logStateInline').textContent = label;
}

function syncCopyLogButton() {
  const btn = $('btnCopyLog');
  const logBody = $('logBody');
  if (!btn || !logBody) return;

  const hasContent = !!logBody.textContent.trim();
  btn.disabled = !hasContent;
}

function resetCopyLogButton() {
  const btn = $('btnCopyLog');
  if (!btn) return;
  btn.textContent = 'Copy all';
  btn.classList.remove('copied');
}

function updateLogUI(entry) {
  state.logEntries.push(entry);
  const { fileName, status, detail } = entry;
  const isDebug = entry.kind === 'DEBUG' || status === 'DEBUG';
  const dotIdx = fileName.lastIndexOf('.');
  const ext = dotIdx >= 0 ? fileName.slice(dotIdx + 1) : '';
  const base = dotIdx >= 0 ? fileName.slice(0, dotIdx) : fileName;

  const line = document.createElement('div');
  line.className = 'log-line';

  const badge = document.createElement('span');
  badge.className = 'ext-badge';
  badge.textContent = isDebug ? 'DBG' : extBadge(ext);

  const fname = document.createElement('span');
  fname.className = 'log-fname';
  fname.textContent = isDebug ? '[DEBUG]' : truncateBase(base);
  fname.title = isDebug ? (detail || fileName) : fileName;

  const statusMap = {
    [LOG_STATUS.PROCESSED]: ['Processed', 's-processed'],
    [LOG_STATUS.ACTION_MANAGED_END]: ['Action Managed End', 's-ame'],
    [LOG_STATUS.SAVE_ER]: ['SaveEr', 's-saveer'],
    [LOG_STATUS.SKIPPED]: ['Skipped', 's-skipped'],
    [LOG_STATUS.ERROR]: ['Error', 's-error'],
    [LOG_STATUS.CANCELLED]: ['Cancelled', 's-cancelled']
  };
  statusMap[LOG_STATUS.NO_SAVE_TARGET] = ['No Save Target', 's-skipped'];
  const mapped = statusMap[status] || [status, ''];

  const st = document.createElement('span');
  st.className = 'log-status ' + mapped[1];
  st.textContent = mapped[0];

  line.append(badge, fname, st);
  if (detail) {
    const dt = document.createElement('span');
    dt.className = 'log-detail';
    dt.textContent = detail;
    line.appendChild(dt);
  }
  line.dataset.copyText = isDebug ? `[DEBUG] ${detail || ''}` : [fileName, status, detail].filter(Boolean).join('  ');

  const logBody = $('logBody');
  logBody.appendChild(line);
  logBody.scrollTop = logBody.scrollHeight;
  syncCopyLogButton();
}

function updateProgress(current, total, fileName) {
  $('progressFile').textContent = fileName;
  $('progressCount').textContent = current + ' / ' + total;
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  $('progressFill').style.width = percent + '%';
}

function updateFooter(processed, saveEr, skipped, label) {
  const summaryText = '완료 ' + processed + ' · SaveEr ' + saveEr + ' · Skipped ' + skipped;
  $('footerSummary').textContent = summaryText;
  $('logSummaryInline').textContent = summaryText;
  setFooterState(label);
}

function renderPreflightMessages(result) {
  const logBody = $('logBody');
  logBody.innerHTML = '';
  state.logEntries = [];

  if (Array.isArray(result.errors) && result.errors.length) {
    const errBlock = document.createElement('div');
    errBlock.className = 'log-preflight log-preflight-error';
    result.errors.forEach((msg) => {
      const line = document.createElement('div');
      line.className = 'log-preflight-line';
      line.textContent = msg;
      errBlock.appendChild(line);
      state.logEntries.push({ kind: 'PRECHECK', level: 'error', detail: msg });
    });
    logBody.appendChild(errBlock);
  }

  if (Array.isArray(result.warnings) && result.warnings.length) {
    const warnBlock = document.createElement('div');
    warnBlock.className = 'log-preflight log-preflight-warning';
    result.warnings.forEach((msg) => {
      const line = document.createElement('div');
      line.className = 'log-preflight-line';
      line.textContent = msg;
      warnBlock.appendChild(line);
      state.logEntries.push({ kind: 'PRECHECK', level: 'warning', detail: msg });
    });
    logBody.appendChild(warnBlock);
  }

  syncCopyLogButton();
}

function buildLogText() {
  return state.logEntries.map((entry) => {
    if (entry.kind === 'DEBUG') return '[DEBUG] ' + (entry.detail || '');
    if (entry.kind === 'PRECHECK') return '[' + String(entry.level || 'info').toUpperCase() + '] ' + (entry.detail || '');
    return [entry.fileName, entry.status, entry.detail].filter(Boolean).join('  ');
  }).join('\n');
}

function updateDebugPanel() {
  const debugBuild = $('debugBuild');
  const debugSort = $('debugSort');
  const debugActions = $('debugActions');
  if (!debugBuild || !debugSort || !debugActions) return;

  const inputState = inputPart.getState ? inputPart.getState() : null;
  const sortEl = $('sortBy');
  const actionState = actionPresetPart.getState ? actionPresetPart.getState() : null;
  const sortValue = sortEl ? sortEl.value : '?';
  const sortLabel = sortEl && sortEl.options && sortEl.selectedIndex >= 0
    ? (sortEl.options[sortEl.selectedIndex]?.textContent || '?')
    : '?';
  const sortCount = sortEl && sortEl.options ? sortEl.options.length : 0;

  debugBuild.textContent = `build=${BUILD_TOKEN} uxp=${isUxpRuntime ? 'Y' : 'N'}`;
  debugSort.textContent = `mode=${inputState ? inputState.mode : '?'} sort=${sortValue}|${sortLabel}|opts=${sortCount}`;
  debugActions.textContent = actionState
    ? `slots=${actionState.debug.slotCount} catalog=${actionState.debug.catalogCount} pending=${actionState.debug.pending ? 'Y' : 'N'} first=${actionState.debug.firstSet || '-'}`
    : 'actions=?';
}

function composeRunPayload(actions) {
  return {
    ...inputPart.getState(),
    ...outputPart.getState(),
    actions
  };
}

function getReusableRunPlan(config) {
  if (!state.lastRunPlan || !state.lastRunPlan.ok) return null;
  try {
    return state.lastRunPlan.key === makeRunPlanKey(config) ? state.lastRunPlan : null;
  } catch (_) {
    return null;
  }
}

function makeRunCallbacks(summary) {
  return {
    onPreflight: (result) => {
      if (!result.ok) {
        renderPreflightMessages(result);
        if (Array.isArray(result.errors) && result.errors.length) {
          showAlert('Warning', result.errors.join('\n'));
        }
      }
    },
    onProgress: (current, total, fileName) => {
      updateProgress(current, total, fileName);
      updateFooter(summary.processed, summary.saveEr, summary.skipped, '실행 중...');
    },
    onFileLog: (entry) => {
      updateLogUI(entry);
      if (entry.status === LOG_STATUS.PROCESSED) summary.processed++;
      else if (entry.status === LOG_STATUS.SAVE_ER) summary.saveEr++;
      else if (entry.status === LOG_STATUS.SKIPPED || entry.status === LOG_STATUS.ERROR) summary.skipped++;
      updateFooter(summary.processed, summary.saveEr, summary.skipped, '실행 중...');
    },
    onComplete: (result) => {
      updateFooter(summary.processed, summary.saveEr, summary.skipped, result.cancelled ? '(중단됨)' : '(완료)');
      $('progressFill').style.width = '100%';
      if (result.fatalActionStop) {
        showAlert('Action Stopped', 'An action stopped due to a Photoshop error. The batch run was stopped to prevent additional errors.');
      }
    },
    onDebugLog: (message) => {
      if (state.debugMode) updateLogUI({ kind: 'DEBUG', fileName: '[DEBUG]', status: 'DEBUG', detail: message });
    },
    isCancelled: () => state.cancelRequested,
    setCancelled: (value) => { state.cancelRequested = value; }
  };
}

function prepareRunUI() {
  state.logEntries = [];
  $('logBody').innerHTML = '';
  $('progressFile').textContent = '—';
  $('progressCount').textContent = '0 / 0';
  $('progressFill').style.width = '0%';
  resetCopyLogButton();
  updateFooter(0, 0, 0, '준비 중...');
  syncCopyLogButton();

  state.running = true;
  state.cancelRequested = false;
  $('btnRun').disabled = true;
  $('btnTest').disabled = true;
  $('btnCancel').disabled = false;
}

function teardownRunUI() {
  state.running = false;
  state.cancelRequested = false;
  $('btnRun').disabled = false;
  $('btnTest').disabled = false;
  $('btnCancel').disabled = false;
}

async function handleRun() {
  if (state.running) return;

  const validation = actionPresetPart.validateForRun();
  if (!validation.ok) {
    showAlert('Warning', validation.message);
    return;
  }

  prepareRunUI();
  const summary = { processed: 0, saveEr: 0, skipped: 0 };

  try {
    if (!isUxpRuntime) {
      updateFooter(0, 0, 0, 'Preview simulation...');
      return;
    }

    const runConfig = composeRunPayload(validation.actions);
    const reusablePlan = getReusableRunPlan(runConfig);
    await runBatch({ ...runConfig, runPlan: reusablePlan, executionMode: 'run' }, makeRunCallbacks(summary));
  } finally {
    teardownRunUI();
  }
}

async function handleTestRun() {
  if (state.running) return;

  const inputState = inputPart.getState();
  if (!inputState.folder1) {
    showAlert('Warning', 'Folder 1이 지정되지 않았습니다.');
    return;
  }

  if (inputState.mode === 'crossFolder' && !inputState.folder2) {
    showAlert('Warning', 'Folder 2가 지정되지 않았습니다.');
    return;
  }

  const validation = actionPresetPart.validateForRun();
  if (!validation.ok) {
    showAlert('Warning', validation.message);
    return;
  }

  prepareRunUI();
  const summary = { processed: 0, saveEr: 0, skipped: 0 };

  try {
    if (!isUxpRuntime) {
      updateFooter(0, 0, 0, 'Preview test simulation...');
      return;
    }

    const runConfig = composeRunPayload(validation.actions);
    const plan = await buildRunPlan(runConfig);
    state.lastRunPlan = plan && plan.ok ? plan : null;
    await runBatch({ ...runConfig, runPlan: plan, executionMode: 'test', testLimit: 1 }, makeRunCallbacks(summary));
  } finally {
    teardownRunUI();
  }
}

function handleCancel() {
  if (!state.running || state.cancelRequested) return;
  state.cancelRequested = true;
  $('btnCancel').disabled = true;
  if (!isUxpRuntime) {
    setFooterState('Preview cancelled');
    return;
  }
  if (state.debugMode) {
    updateLogUI({ kind: 'DEBUG', fileName: '[DEBUG]', status: 'DEBUG', detail: '[ForceStop] 사용자 Cancel - 현재 문서 상태 유지, 후속 배치만 중단' });
  }
  setFooterState('중단 요청됨...');
}

async function initHub() {
  if (state.hubInitPromise) {
    return state.hubInitPromise;
  }

  state.hubInitPromise = (async () => {
  if (state.hubInitialized) {
    inputPart.render();
    outputPart.render();
    actionPresetPart.restoreView();
    return;
  }

  if (!isUxpRuntime) {
    document.body.classList.add('preview-mode');
    document.title = 'PS-autoHUB Preview';
    $('btnRun').textContent = 'Preview Run';
    $('btnTest').textContent = '1 test (preview)';
    $('btnCancel').textContent = 'Stop';
    $('progressFile').textContent = '브라우저 프리뷰 모드';
    setFooterState('Photoshop 없이 디자인 확인 가능');
  }

  inputPart.init({
    sortBy: 'sortBy',
    toggleSubfolders: 'toggleSubfolders',
    sameFolderX2Wrap: 'sameFolderX2Wrap',
    toggleSameFolderX2: 'toggleSameFolderX2',
    btnCrossOrder: 'btnCrossOrder',
    btnFolder2Disclosure: 'btnFolder2Disclosure',
    openFolder2Content: 'openFolder2Content',
    displayFolder1: 'displayFolder1',
    displayFolder2: 'displayFolder2',
    btnFolder1: 'btnFolder1',
    btnFolder2: 'btnFolder2'
  });

  outputPart.init({
    toggleSaveCopy: 'toggleSaveCopy',
    inputSuffix: 'inputSuffix',
    btnSaveFolder2Disclosure: 'btnSaveFolder2Disclosure',
    saveFolder2Content: 'saveFolder2Content',
    displaySaveFolder1: 'displaySaveFolder1',
    displaySaveFolder2: 'displaySaveFolder2',
    btnSaveFolder1: 'btnSaveFolder1',
    btnSaveFolder2: 'btnSaveFolder2'
  });

  outputPart.setFolder2Expanded(!!(inputPart.getState && inputPart.getState().folder2Expanded));

  await actionPresetPart.init({
    actionList: 'actionList',
    btnRefreshActions: 'btnRefreshActions',
    btnAddAction: 'btnAddAction',
    actionCount: 'actionCount'
  });

  $('btnRun').addEventListener('click', handleRun);
  $('btnTest').addEventListener('click', handleTestRun);
  $('btnCancel').addEventListener('click', handleCancel);
  $('btnToggleLog').addEventListener('click', () => {
    setLogExpanded(!state.logExpanded);
  });
  $('btnToggleLog').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    setLogExpanded(!state.logExpanded);
  });
  $('btnAlertOk').addEventListener('click', hideAlert);
  $('alertBackdrop').addEventListener('click', (e) => {
    if (e.target === $('alertBackdrop')) hideAlert();
  });
  $('btnCopyLog').addEventListener('click', async () => {
    const text = buildLogText();
    const btn = $('btnCopyLog');
    try {
      if (clipboard && typeof clipboard.copyText === 'function') await clipboard.copyText(text);
      else if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') await navigator.clipboard.writeText(text);
      else throw new Error('copy unavailable');
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Copy all'; btn.classList.remove('copied'); }, 1800);
    } catch (_) {
      btn.textContent = 'Failed';
      setTimeout(() => { btn.textContent = 'Copy all'; }, 1800);
    }
  });

  setLogExpanded(false);
  syncCopyLogButton();
  updateDebugPanel();

  state.hubInitialized = true;
  })();

  try {
    await state.hubInitPromise;
  } finally {
    state.hubInitPromise = null;
  }
}

function registerPanelLifecycle() {
  Promise.resolve(initHub()).catch((error) => {
    console.error(error);
    showAlert('Panel Init Error', error && error.message ? error.message : String(error));
  });

  if (!isUxpRuntime || !uxpModule || !uxpModule.entrypoints || typeof uxpModule.entrypoints.setup !== 'function') return;

  try {
    uxpModule.entrypoints.setup({
      panels: {
        batchPanel: {
          async show() {
            await initHub();
          },
          hide() {},
          destroy() {}
        }
      }
    });
  } catch (_) {}
}

registerPanelLifecycle();
