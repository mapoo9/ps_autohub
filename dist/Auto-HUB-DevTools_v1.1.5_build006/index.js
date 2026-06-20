/**
 * index.js - Auto-HUB v1.1.5 / build 006
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
const BUILD_TOKEN = 'v1.1.5-build006';

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
const { DebugController, DebugSink, DEBUG_LEVELS } = require('./src/core/debug/index');

const state = {
  running: false,
  cancelRequested: false,
  logExpanded: false,
  hubInitialized: false,
  hubInitPromise: null,
  lastRunPlan: null,
  testPassed: false,
  debugHandshakeLogged: false,
  currentRunCorrelationId: null,
  sectionExpanded: {
    action: true,
    open: true,
    save: false
  }
};

const $ = (id) => document.getElementById(id);

let outputPart = null;
let lastOpenFolder2Expanded = false;

function syncSaveFolder2Availability(inputState, { forceExpand = false } = {}) {
  if (!outputPart || typeof outputPart.setFolder2Available !== 'function') return;

  const openFolder2Expanded = !!(inputState && inputState.folder2Expanded);
  const shouldAutoExpand = openFolder2Expanded && (forceExpand || !lastOpenFolder2Expanded);

  outputPart.setFolder2Available(openFolder2Expanded, { expand: shouldAutoExpand });
  lastOpenFolder2Expanded = openFolder2Expanded;
}

function getRuntimeLoadedPath() {
  try {
    return typeof location !== 'undefined' ? String(location.href || '') : '';
  } catch (_) {
    return '';
  }
}

const BUILD_FINGERPRINT = {
  appVersion: '1.1.5',
  frontendBuild: BUILD_TOKEN,
  backendVersion: null,
  apiVersion: null,
  dbSchemaVersion: null,
  nativeShellVersion: isUxpRuntime ? 'UXP' : 'browser-preview',
  protocolVersion: null,
  packageBuildId: 'build006',
  runtimeLoadedPath: getRuntimeLoadedPath()
};

const debugController = new DebugController({
  source: 'auto-hub-panel',
  buildFingerprint: BUILD_FINGERPRINT,
  sink: new DebugSink({
    onDisplay: renderDisplayLog,
    onChange: syncDebugUiState
  })
});

function isDebugEnabled() {
  return debugController.getDebugLevel() > DEBUG_LEVELS.OFF;
}

function getDebugLevel() {
  return debugController.getDebugLevel();
}

function shouldLog(level = DEBUG_LEVELS.USER_REPORT) {
  return debugController.shouldLog(level);
}

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
    syncSaveFolder2Availability(nextState);
    updateDebugPanel();
  }
});

const actionPresetPart = createActionPresetPart({
  app: isUxpRuntime ? require('photoshop').app : { actionTree: [] },
  isUxpRuntime,
  storage: typeof localStorage !== 'undefined' ? localStorage : null,
  isDebugEnabled: () => shouldLog(DEBUG_LEVELS.DEVELOPER_TRACE),
  onDebugEvent: (event) => debugController.pushDebugEvent(DEBUG_LEVELS.DEVELOPER_TRACE, event),
  onChange: () => {
    invalidateRunPlan();
    updateDebugPanel();
  },
  onProblem: (error) => showAlert('Action List Error', 'Failed to read the Photoshop action list.\n' + error.message)
});

outputPart = createOutputPart({
  fs,
  isUxpRuntime,
  onChange: () => {
    invalidateRunPlan();
    updateDebugPanel();
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
  state.testPassed = false;
  updateRunButtonState();
}

function isRunConfigReady() {
  try {
    const inputState = inputPart.getState ? inputPart.getState() : {};
    if (!inputState.folder1) return false;
    if (inputState.mode === 'crossFolder' && !inputState.folder2) return false;

    const validation = actionPresetPart.validateForRun();
    return !!(validation && validation.ok);
  } catch (_) {
    return false;
  }
}

function updateRunButtonState() {
  const btnRun = $('btnRun');
  const btnTest = $('btnTest');
  if (!btnRun || !btnTest) return;

  const ready = isRunConfigReady();
  const tested = ready && !!state.testPassed;

  btnTest.classList.toggle('is-ready', ready);
  btnRun.classList.toggle('is-ready', ready && !tested);
  btnRun.classList.toggle('is-test-passed', tested);
}

function clearLogBuffers() {
  debugController.clearDebugLog();
  const logBody = $('logBody');
  if (logBody) logBody.innerHTML = '';
  resetCopyLogButton();
  syncCopyLogButton();
}

function syncDebugUiState() {
  const shouldShow = debugController.isDebugUiVisible() && isDebugEnabled();
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.toggle('show-log-panel', shouldShow);
  }

  const levelSelect = $('debugLevelSelect');
  if (levelSelect && levelSelect.value !== String(getDebugLevel())) {
    levelSelect.value = String(getDebugLevel());
  }

  if (!shouldShow) {
    setLogExpanded(false);
  }
  syncCopyLogButton();
}

function emitVersionHandshake() {
  if (state.debugHandshakeLogged || !shouldLog(DEBUG_LEVELS.USER_REPORT)) return;
  state.debugHandshakeLogged = true;
  debugController.pushDebugEvent(DEBUG_LEVELS.USER_REPORT, {
    component: 'panel',
    phase: 'init',
    event: 'version_handshake',
    severity: 'info',
    display: `Debug ready: ${BUILD_TOKEN}`,
    data: {
      buildFingerprint: BUILD_FINGERPRINT,
      uxpRuntime: isUxpRuntime
    }
  });
}

function setDebugLevel(level, { showUi = false } = {}) {
  const nextLevel = debugController.setDebugLevel(level);
  if (showUi && nextLevel > DEBUG_LEVELS.OFF) {
    debugController.setDebugUiVisible(true);
  }

  if (nextLevel > DEBUG_LEVELS.OFF) {
    emitVersionHandshake();
    setLogExpanded(true);
    updateDebugPanel();
    syncCopyLogButton();
  } else {
    debugController.setDebugUiVisible(false);
    state.debugHandshakeLogged = false;
    setLogExpanded(false);
    clearLogBuffers();
  }

  syncDebugUiState();
  return nextLevel;
}

function setDebugUiVisible(visible) {
  const nextVisible = debugController.setDebugUiVisible(visible);
  if (nextVisible && isDebugEnabled()) setLogExpanded(true);
  syncDebugUiState();
  return nextVisible;
}

function setDebugMode(enabled) {
  if (enabled) {
    setDebugUiVisible(true);
    return setDebugLevel(Math.max(getDebugLevel(), DEBUG_LEVELS.USER_REPORT), { showUi: true }) > DEBUG_LEVELS.OFF;
  }
  setDebugLevel(DEBUG_LEVELS.OFF);
  return false;
}

function setSectionExpanded(sectionName, expanded) {
  state.sectionExpanded[sectionName] = !!expanded;

  const section = $('section-' + sectionName);
  const toggle = $('toggle' + sectionName.charAt(0).toUpperCase() + sectionName.slice(1) + 'Section');
  const body = $(sectionName + 'SectionBody');
  if (!section || !toggle || !body) return;

  section.classList.toggle('is-expanded', state.sectionExpanded[sectionName]);
  toggle.setAttribute('aria-expanded', String(state.sectionExpanded[sectionName]));
  body.hidden = !state.sectionExpanded[sectionName];

  if (sectionName === 'save') {
    invalidateRunPlan();
  }
}

function bindSectionAccordion(sectionName) {
  const toggle = $('toggle' + sectionName.charAt(0).toUpperCase() + sectionName.slice(1) + 'Section');
  if (!toggle) return;

  const toggleSection = () => {
    setSectionExpanded(sectionName, !state.sectionExpanded[sectionName]);
  };

  toggle.addEventListener('click', toggleSection);
  toggle.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    toggleSection();
  });
  setSectionExpanded(sectionName, state.sectionExpanded[sectionName]);
}

function installDebugApi() {
  if (typeof window === 'undefined') return;
  const api = {
    setEnabled: setDebugMode,
    setLevel: (level) => setDebugLevel(level),
    getLevel: getDebugLevel,
    shouldLog,
    setVisible: setDebugUiVisible,
    isVisible: () => debugController.isDebugUiVisible(),
    enable: () => setDebugMode(true),
    disable: () => setDebugMode(false),
    isEnabled: isDebugEnabled,
    push: (level, event) => debugController.pushDebugEvent(level, event),
    clear: clearLogBuffers,
    copy: buildLogText,
    copyDebugLog: buildLogText,
    getLogText: buildLogText,
    getRawEntries: () => debugController.getRawEntries(),
    getDisplayEntries: () => debugController.getDisplayEntries(),
    getSessionId: () => debugController.getSnapshot().sessionId
  };
  window.AutoHUBDebug = api;
  window.AppDebug = api;
}

function setFooterState(label) {
  $('footerState').textContent = label;
  $('logStateInline').textContent = label;
}

function syncCopyLogButton() {
  const btn = $('btnCopyLog');
  if (!btn) return;

  btn.disabled = !debugController.hasRawEntries();
}

function resetCopyLogButton() {
  const btn = $('btnCopyLog');
  if (!btn) return;
  btn.textContent = 'Copy all';
  btn.classList.remove('copied');
}

function statusSeverity(status) {
  if (status === LOG_STATUS.ERROR || status === LOG_STATUS.SAVE_ER) return 'error';
  if (status === LOG_STATUS.SKIPPED || status === LOG_STATUS.CANCELLED || status === LOG_STATUS.NO_SAVE_TARGET) return 'warning';
  return 'info';
}

function formatFileDisplay(entry) {
  return [entry.fileName, entry.status, entry.detail].filter(Boolean).join('  ');
}

function pushFileLogEvent(entry) {
  if (!shouldLog(DEBUG_LEVELS.USER_REPORT)) return;
  debugController.pushDebugEvent(DEBUG_LEVELS.USER_REPORT, {
    component: 'batch',
    phase: 'file',
    event: 'file_result',
    severity: statusSeverity(entry.status),
    correlationId: state.currentRunCorrelationId,
    display: formatFileDisplay(entry),
    fileName: entry.fileName,
    status: entry.status,
    detail: entry.detail || '',
    data: entry
  });
}

function pushDebugMessage(payload, defaultLevel = DEBUG_LEVELS.SUPPORT_DIAGNOSTICS) {
  const isObject = payload && typeof payload === 'object';
  const level = isObject && payload.level !== undefined ? payload.level : defaultLevel;
  const display = isObject ? (payload.display || payload.message || payload.event || 'Debug event') : String(payload || '');
  debugController.pushDebugEvent(level, {
    component: isObject && payload.component ? payload.component : 'batch',
    phase: isObject && payload.phase ? payload.phase : 'debug',
    event: isObject && payload.event ? payload.event : 'message',
    severity: isObject && payload.severity ? payload.severity : 'debug',
    correlationId: isObject && payload.correlationId ? payload.correlationId : state.currentRunCorrelationId,
    display,
    detail: display,
    data: isObject ? payload.data || payload : { message: display }
  });
}

function renderDisplayLog(entry) {
  const { fileName = '', status = '', detail = '' } = entry;
  const isDebug = !fileName || entry.event === 'message' || status === 'DEBUG';
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
  fname.title = isDebug ? (entry.display || detail || fileName) : fileName;

  const statusMap = {
    [LOG_STATUS.PROCESSED]: ['Processed', 's-processed'],
    [LOG_STATUS.ACTION_MANAGED_END]: ['Action Managed End', 's-ame'],
    [LOG_STATUS.SAVE_ER]: ['SaveEr', 's-saveer'],
    [LOG_STATUS.SKIPPED]: ['Skipped', 's-skipped'],
    [LOG_STATUS.ERROR]: ['Error', 's-error'],
    [LOG_STATUS.CANCELLED]: ['Cancelled', 's-cancelled']
  };
  statusMap[LOG_STATUS.NO_SAVE_TARGET] = ['No Save Target', 's-skipped'];
  const mapped = isDebug ? ['Debug', ''] : (statusMap[status] || [status, '']);

  const st = document.createElement('span');
  st.className = 'log-status ' + mapped[1];
  st.textContent = mapped[0];

  line.append(badge, fname, st);
  const displayDetail = detail || (isDebug ? entry.display : '');
  if (displayDetail) {
    const dt = document.createElement('span');
    dt.className = 'log-detail';
    dt.textContent = displayDetail;
    line.appendChild(dt);
  }
  line.dataset.copyText = entry.display || (isDebug ? `[DEBUG] ${displayDetail || ''}` : [fileName, status, detail].filter(Boolean).join('  '));

  const logBody = $('logBody');
  if (!logBody) return;
  logBody.appendChild(line);
  logBody.scrollTop = logBody.scrollHeight;
  syncCopyLogButton();
}

function updateProgress(current, total, fileName) {
  if (!isDebugEnabled()) return;
  $('progressFile').textContent = fileName;
  $('progressCount').textContent = current + ' / ' + total;
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  $('progressFill').style.width = percent + '%';
}

function updateFooter(processed, saveEr, skipped, label) {
  if (!isDebugEnabled()) return;
  const summaryText = '완료 ' + processed + ' · SaveEr ' + saveEr + ' · Skipped ' + skipped;
  $('footerSummary').textContent = summaryText;
  $('logSummaryInline').textContent = summaryText;
  setFooterState(label);
}

function renderPreflightMessages(result) {
  if (!shouldLog(DEBUG_LEVELS.SUPPORT_DIAGNOSTICS)) return;

  if (Array.isArray(result.errors) && result.errors.length) {
    result.errors.forEach((msg) => {
      debugController.pushDebugEvent(DEBUG_LEVELS.SUPPORT_DIAGNOSTICS, {
        component: 'runPlan',
        phase: 'preflight',
        event: 'preflight_error',
        severity: 'error',
        display: msg,
        detail: msg,
        data: { message: msg }
      });
    });
  }

  if (Array.isArray(result.warnings) && result.warnings.length) {
    result.warnings.forEach((msg) => {
      debugController.pushDebugEvent(DEBUG_LEVELS.SUPPORT_DIAGNOSTICS, {
        component: 'runPlan',
        phase: 'preflight',
        event: 'preflight_warning',
        severity: 'warning',
        display: msg,
        detail: msg,
        data: { message: msg }
      });
    });
  }

  syncCopyLogButton();
}

function buildLogText() {
  return debugController.buildDebugLogText();
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
  const outputState = state.sectionExpanded.save
    ? outputPart.getState()
    : {
      saveCopy: false,
      suffix: '',
      saveFolder1: null,
      saveFolder2: null
    };

  return {
    ...inputPart.getState(),
    ...outputState,
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

function summarizeFolderEntry(entry) {
  if (!entry) return null;
  return {
    name: entry.name || '',
    hasNativePath: !!entry.nativePath
  };
}

function summarizeRunConfig(config = {}) {
  return {
    mode: config.mode || 'single',
    subfolders: !!config.subfolders,
    crossOrder: config.crossOrder || '1to2',
    sortBy: config.sortBy || 'name_asc',
    saveCopy: !!config.saveCopy,
    hasSuffix: !!String(config.suffix || '').trim(),
    folder1: summarizeFolderEntry(config.folder1),
    folder2: summarizeFolderEntry(config.folder2),
    saveFolder1: summarizeFolderEntry(config.saveFolder1),
    saveFolder2: summarizeFolderEntry(config.saveFolder2),
    actionCount: Array.isArray(config.actions) ? config.actions.length : 0
  };
}

function summarizeRunPlan(result = {}) {
  return {
    ok: !!result.ok,
    total: result.total || (Array.isArray(result.fileList) ? result.fileList.length : 0),
    errors: Array.isArray(result.errors) ? result.errors.slice(0, 10) : [],
    warnings: Array.isArray(result.warnings) ? result.warnings.slice(0, 10) : [],
    usesTimestampOutput: !!result.usesTimestampOutput,
    rawCounts: result.rawCounts || null,
    timestampToken: result.timestampToken || ''
  };
}

function createCorrelationId(kind) {
  return `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeRunCallbacks(summary) {
  return {
    onPreflight: (result) => {
      const planSummary = summarizeRunPlan(result);
      if (result.ok) {
        debugController.pushDebugEvent(DEBUG_LEVELS.USER_REPORT, {
          component: 'runPlan',
          phase: 'preflight',
          event: 'run_plan_ready',
          severity: 'info',
          correlationId: state.currentRunCorrelationId,
          display: `RunPlan ready: ${planSummary.total} files`,
          data: planSummary
        });
      }
      debugController.pushDebugEvent(DEBUG_LEVELS.SUPPORT_DIAGNOSTICS, {
        component: 'runPlan',
        phase: 'preflight',
        event: 'run_plan_result',
        severity: result.ok ? 'info' : 'error',
        correlationId: state.currentRunCorrelationId,
        display: result.ok ? '' : 'RunPlan failed',
        data: planSummary
      });
      if (!result.ok) {
        renderPreflightMessages(result);
        if (Array.isArray(result.errors) && result.errors.length) {
          showAlert('Warning', result.errors.join('\n'));
        }
      }
    },
    onProgress: (current, total, fileName) => {
      if (!shouldLog(DEBUG_LEVELS.USER_REPORT)) return;
      updateProgress(current, total, fileName);
      updateFooter(summary.processed, summary.saveEr, summary.skipped, '실행 중...');
    },
    onFileLog: (entry) => {
      if (entry.status === LOG_STATUS.PROCESSED) summary.processed++;
      else if (entry.status === LOG_STATUS.SAVE_ER) summary.saveEr++;
      else if (entry.status === LOG_STATUS.SKIPPED || entry.status === LOG_STATUS.ERROR) summary.skipped++;
      if (!shouldLog(DEBUG_LEVELS.USER_REPORT)) return;
      pushFileLogEvent(entry);
      updateFooter(summary.processed, summary.saveEr, summary.skipped, '실행 중...');
    },
    onComplete: (result) => {
      const finalResult = result || {};
      debugController.pushDebugEvent(DEBUG_LEVELS.USER_REPORT, {
        component: 'batch',
        phase: 'run',
        event: finalResult.cancelled ? 'run_cancelled' : 'run_complete',
        severity: finalResult.fatalActionStop ? 'error' : (finalResult.cancelled ? 'warning' : 'info'),
        correlationId: state.currentRunCorrelationId,
        display: finalResult.cancelled ? 'Run cancelled' : 'Run complete',
        data: finalResult
      });
      if (shouldLog(DEBUG_LEVELS.USER_REPORT)) {
        const finalSummary = finalResult || summary;
        updateFooter(finalSummary.processed || 0, finalSummary.saveEr || 0, finalSummary.skipped || 0, finalResult.cancelled ? '(중단됨)' : '(완료)');
        $('progressFill').style.width = '100%';
      }
      if (finalResult.fatalActionStop) {
        showAlert('Action Stopped', 'An action stopped due to a Photoshop error. The batch run was stopped to prevent additional errors.');
      }
    },
    onDebugLog: (message) => {
      pushDebugMessage(message);
    },
    shouldCollectLogs: shouldLog,
    isCancelled: () => state.cancelRequested,
    setCancelled: (value) => { state.cancelRequested = value; }
  };
}

function prepareRunUI() {
  clearLogBuffers();
  if (isDebugEnabled()) {
    $('progressFile').textContent = '—';
    $('progressCount').textContent = '0 / 0';
    $('progressFill').style.width = '0%';
    updateFooter(0, 0, 0, '준비 중...');
  }

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
  state.currentRunCorrelationId = createCorrelationId('run');

  try {
    if (!isUxpRuntime) {
      debugController.pushDebugEvent(DEBUG_LEVELS.USER_REPORT, {
        component: 'batch',
        phase: 'run',
        event: 'preview_run_start',
        severity: 'info',
        correlationId: state.currentRunCorrelationId,
        display: 'Preview run started',
        data: { executionMode: 'preview' }
      });
      updateFooter(0, 0, 0, 'Preview simulation...');
      return;
    }

    const runConfig = composeRunPayload(validation.actions);
    debugController.pushDebugEvent(DEBUG_LEVELS.USER_REPORT, {
      component: 'batch',
      phase: 'run',
      event: 'run_start',
      severity: 'info',
      correlationId: state.currentRunCorrelationId,
      display: 'Run started',
      data: { executionMode: 'run' }
    });
    debugController.pushDebugEvent(DEBUG_LEVELS.SUPPORT_DIAGNOSTICS, {
      component: 'batch',
      phase: 'run',
      event: 'run_config_snapshot',
      severity: 'debug',
      correlationId: state.currentRunCorrelationId,
      data: summarizeRunConfig(runConfig)
    });
    const reusablePlan = getReusableRunPlan(runConfig);
    await runBatch({ ...runConfig, runPlan: reusablePlan, executionMode: 'run' }, makeRunCallbacks(summary));
  } finally {
    teardownRunUI();
    updateRunButtonState();
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
  state.currentRunCorrelationId = createCorrelationId('test');

  try {
    if (!isUxpRuntime) {
      debugController.pushDebugEvent(DEBUG_LEVELS.USER_REPORT, {
        component: 'batch',
        phase: 'run',
        event: 'preview_test_start',
        severity: 'info',
        correlationId: state.currentRunCorrelationId,
        display: 'Preview 1 test started',
        data: { executionMode: 'preview-test' }
      });
      updateFooter(0, 0, 0, 'Preview test simulation...');
      return;
    }

    const runConfig = composeRunPayload(validation.actions);
    debugController.pushDebugEvent(DEBUG_LEVELS.USER_REPORT, {
      component: 'batch',
      phase: 'run',
      event: 'test_start',
      severity: 'info',
      correlationId: state.currentRunCorrelationId,
      display: '1 test started',
      data: { executionMode: 'test' }
    });
    debugController.pushDebugEvent(DEBUG_LEVELS.SUPPORT_DIAGNOSTICS, {
      component: 'batch',
      phase: 'run',
      event: 'run_config_snapshot',
      severity: 'debug',
      correlationId: state.currentRunCorrelationId,
      data: summarizeRunConfig(runConfig)
    });
    const plan = await buildRunPlan(runConfig);
    state.lastRunPlan = plan && plan.ok ? plan : null;
    let testResult = null;
    const callbacks = makeRunCallbacks(summary);
    const onComplete = callbacks.onComplete;
    callbacks.onComplete = (result) => {
      testResult = result || null;
      onComplete(result);
    };

    await runBatch({ ...runConfig, runPlan: plan, executionMode: 'test', testLimit: 1 }, callbacks);
    state.testPassed = !!(
      testResult &&
      testResult.total > 0 &&
      !testResult.cancelled &&
      !testResult.fatalActionStop &&
      (testResult.saveEr || 0) === 0 &&
      (testResult.skipped || 0) === 0
    );
  } finally {
    teardownRunUI();
    updateRunButtonState();
  }
}

function handleCancel() {
  if (!state.running || state.cancelRequested) return;
  state.cancelRequested = true;
  $('btnCancel').disabled = true;
  if (!isUxpRuntime) {
    if (isDebugEnabled()) setFooterState('Preview cancelled');
    return;
  }
  if (isDebugEnabled()) {
    debugController.pushDebugEvent(DEBUG_LEVELS.USER_REPORT, {
      component: 'batch',
      phase: 'run',
      event: 'cancel_requested',
      severity: 'warning',
      correlationId: state.currentRunCorrelationId,
      display: 'Cancel requested',
      data: {
        keepCurrentDocumentState: true,
        stopFollowingBatchItems: true
      }
    });
    setFooterState('중단 요청됨...');
  }
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
    document.title = 'Auto-HUB Preview';
    $('btnRun').textContent = 'Preview Run';
    $('btnTest').textContent = '1 test (preview)';
    $('btnCancel').textContent = 'Stop';
    if (isDebugEnabled()) {
      $('progressFile').textContent = '브라우저 프리뷰 모드';
      setFooterState('Photoshop 없이 디자인 확인 가능');
    }
  }

  inputPart.init({
    sectionOpen: 'section-open',
    sortBy: 'sortBy',
    toggleSubfolders: 'toggleSubfolders',
    orderWrap: 'orderWrap',
    orderWrapCross: 'orderWrapCross',
    sameFolderX2Wrap: 'sameFolderX2Wrap',
    toggleSameFolderX2: 'toggleSameFolderX2',
    btnCrossOrder: 'btnCrossOrder',
    btnCrossOrderCross: 'btnCrossOrderCross',
    btnFolder2Disclosure: 'btnFolder2Disclosure',
    openFolder2Content: 'openFolder2Content',
    displayFolder1: 'displayFolder1',
    displayFolder2: 'displayFolder2',
    btnFolder1: 'btnFolder1',
    btnFolder2: 'btnFolder2'
  });

  outputPart.init({
    sectionSave: 'section-save',
    toggleSaveCopy: 'toggleSaveCopy',
    inputSuffix: 'inputSuffix',
    btnSaveFolder2Disclosure: 'btnSaveFolder2Disclosure',
    saveFolder2Content: 'saveFolder2Content',
    displaySaveFolder1: 'displaySaveFolder1',
    displaySaveFolder2: 'displaySaveFolder2',
    saveFolderSlotIcon1: 'saveFolderSlotIcon1',
    saveFolderSlotIcon2: 'saveFolderSlotIcon2',
    btnSaveFolder1: 'btnSaveFolder1',
    btnSaveFolder2: 'btnSaveFolder2'
  });

  syncSaveFolder2Availability(inputPart.getState && inputPart.getState(), { forceExpand: true });

  await actionPresetPart.init({
    actionList: 'actionList',
    btnRefreshActions: 'btnRefreshActions',
    btnAddAction: 'btnAddAction',
    actionCount: 'actionCount'
  });

  bindSectionAccordion('action');
  bindSectionAccordion('open');
  bindSectionAccordion('save');

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
  const debugLevelSelect = $('debugLevelSelect');
  if (debugLevelSelect) {
    debugLevelSelect.addEventListener('change', (e) => {
      setDebugLevel(e.target.value, { showUi: true });
    });
  }
  $('btnAlertOk').addEventListener('click', hideAlert);
  $('alertBackdrop').addEventListener('click', (e) => {
    if (e.target === $('alertBackdrop')) hideAlert();
  });
  $('btnCopyLog').addEventListener('click', async () => {
    const text = buildLogText();
    const btn = $('btnCopyLog');
    try {
      if (!text) throw new Error('copy empty');
      if (clipboard && typeof clipboard.copyText === 'function') await clipboard.copyText(text);
      else if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') await navigator.clipboard.writeText(text);
      else throw new Error('copy unavailable');
      debugController.pushDebugEvent(DEBUG_LEVELS.SUPPORT_DIAGNOSTICS, {
        component: 'debug',
        phase: 'clipboard',
        event: 'copy_success',
        severity: 'info',
        display: 'Debug log copied',
        data: { bytes: text.length }
      });
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Copy all'; btn.classList.remove('copied'); }, 1800);
    } catch (error) {
      debugController.pushDebugEvent(DEBUG_LEVELS.SUPPORT_DIAGNOSTICS, {
        component: 'debug',
        phase: 'clipboard',
        event: 'copy_failed',
        severity: 'warning',
        display: 'Debug log copy failed',
        data: { message: error && error.message ? error.message : String(error) }
      });
      btn.textContent = 'Failed';
      setTimeout(() => { btn.textContent = 'Copy all'; }, 1800);
    }
  });

  installDebugApi();
  setDebugMode(false);
  updateDebugPanel();
  updateRunButtonState();

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
