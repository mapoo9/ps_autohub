/**
 * index.js — PS-autoHUB v0.2.00 / build 200
 *
 * 목적:
 * 1) Photoshop Actions 패널의 Action Set / Action 목록을 읽어 선택 UI로 제공한다.
 * 2) 사용자가 이전에 고른 선택값은 가능한 유지한다.
 * 3) Run 직전 실제 Photoshop 액션 목록과 다시 대조해 유효하지 않은 액션이면 실행을 막는다.
 * 4) 액션 실행 도중 Photoshop 오류로 중지되면 배치 전체도 함께 멈추도록 한다.
 *
 * 통합 기준:
 * - PSD 원본 덮어쓰기 / Subfolders 구조 검증 / placeholder 유지
 * - build140의 디버그 로그 / Copy all fallback
 * - v0.2.00 / build 200의 취소 레이스 / PSB fallback / 렌더링 안정화
 *
 * 간단한 동작:
 * - 패널 로드 시 actionTree를 읽어 actionCatalog 캐시 생성
 * - 각 행은 Action Set / Action select를 가진다.
 * - Refresh All Actions 또는 select 클릭 시 목록 갱신
 * - Run 직전에 다시 검증하고, 실행 불가면 경고 팝업 후 중단
 */
'use strict';

const isUxpRuntime = typeof require === 'function' && typeof window !== 'undefined' && !!window.uxp;

let fs = null;
let clipboard = null;
let app = { actionTree: [] };
let runBatch = async () => {};
let closeAllOpenDocsWithoutSaving = async () => 0;
let LOG_STATUS = {
  PROCESSED: 'PROCESSED',
  ACTION_MANAGED_END: 'ACTION_MANAGED_END',
  SAVE_ER: 'SAVE_ER',
  SKIPPED: 'SKIPPED',
  ERROR: 'ERROR',
  CANCELLED: 'CANCELLED',
  NO_SAVE_TARGET: 'NO_SAVE_TARGET'
};

if (isUxpRuntime) {
  const uxp = require('uxp');
  fs = uxp.storage.localFileSystem;
  clipboard = uxp && uxp.clipboard ? uxp.clipboard : null;
  ({ app } = require('photoshop'));
  ({ runBatch, closeAllOpenDocsWithoutSaving } = require('./src/core/batchController'));
  ({ LOG_STATUS } = require('./src/constants/logStatus'));
}

const STORAGE_KEY = 'psautohub_action_slots_v0200';
const NO_ACTION_SET = 'No Action Set';
const NO_ACTION = 'No Action';
const MAX_ACTION_ROWS = 10;

const state = {
  folder1     : null,
  folder2     : null,
  saveFolder1 : null,
  saveFolder2 : null,
  subfolders  : false,
  sortBy      : 'name_asc',
  crossOrder  : '1to2',
  saveCopy    : false,
  suffix      : '',
  actions     : [{ setName: '', actionName: '', enabled: true }],
  actionCatalog: [],
  running     : false,
  cancelFlag  : false,
  logEntries  : []
};

const PREVIEW_ACTION_CATALOG = [
  { name: 'AUTOHUB_BASIC', actions: ['Resize 1200', 'Sharpen Web', 'Export JPG'] },
  { name: 'AUTOHUB_DETAIL', actions: ['Clean BG', 'Contrast Pop', 'Save Master'] },
  { name: 'CLIENT_DELIVERY', actions: ['Watermark', 'Export PNG', 'Package Assets'] }
];

const $ = (id) => document.getElementById(id);
function setToggle(el, on) { el.dataset.on = String(on); }

function syncSelectWidth(selectEl, { min = 84, max = 170, extra = 34 } = {}) {
  if (!selectEl) return;
  const text = selectEl.options[selectEl.selectedIndex]?.textContent || '';
  const style = window.getComputedStyle(selectEl);
  const canvas = syncSelectWidth.canvas || (syncSelectWidth.canvas = document.createElement('canvas'));
  const ctx = canvas.getContext('2d');
  ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const textWidth = Math.ceil(ctx.measureText(text).width);
  const nextWidth = Math.max(min, Math.min(max, textWidth + extra));
  selectEl.style.width = nextWidth + 'px';
}

function saveActionSlots() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.actions));
  } catch (_) {}
}

function loadActionSlots() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return;
    state.actions = parsed.slice(0, MAX_ACTION_ROWS).map(a => ({
      setName   : a.setName || '',
      actionName: a.actionName || '',
      enabled   : a.enabled !== false
    }));
  } catch (_) {}
}

const EXT_ABBR = { jpeg:'JPG', tiff:'TIF', heic:'HIC', heif:'HIF', webp:'WBP', avif:'AVF' };
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

function setupFolderUI(displayId, actionId, stateKey) {
  const display   = $(displayId);
  const actionBtn = $(actionId);

  async function selectFolder() {
    if (!isUxpRuntime || !fs) {
      const previewName = 'Preview_' + stateKey.replace(/Folder/g, 'Folder_');
      state[stateKey] = { name: previewName };
      display.textContent = previewName;
      display.classList.remove('empty');
      display.title = previewName;
      actionBtn.textContent = 'Reset';
      actionBtn.classList.add('is-reset');
      return;
    }

    const f = await fs.getFolder();
    if (!f) return;
    state[stateKey] = f;
    display.textContent = f.name;
    display.classList.remove('empty');
    display.title = f.name;
    actionBtn.textContent = 'Reset';
    actionBtn.classList.add('is-reset');
  }

  function resetFolder() {
    state[stateKey] = null;
    display.textContent = '—';
    display.classList.add('empty');
    display.title = '';
    actionBtn.textContent = 'Browse';
    actionBtn.classList.remove('is-reset');
  }

  display.addEventListener('click', () => selectFolder());
  actionBtn.addEventListener('click', () => {
    if (actionBtn.classList.contains('is-reset')) resetFolder();
    else selectFolder();
  });
}

function readActionCatalog() {
  if (!isUxpRuntime) return PREVIEW_ACTION_CATALOG;
  const sets = Array.isArray(app.actionTree) ? app.actionTree : [];
  return sets.map(setItem => ({
    name: setItem.name,
    actions: Array.isArray(setItem.actions) ? setItem.actions.map(a => a.name) : []
  }));
}

function getCatalogSetNames() {
  return state.actionCatalog.map(item => item.name);
}
function getActionsBySetName(setName) {
  const found = state.actionCatalog.find(item => item.name === setName);
  return found ? found.actions : [];
}
function catalogHasSet(setName) {
  return !!state.actionCatalog.find(item => item.name === setName);
}
function catalogHasAction(setName, actionName) {
  return getActionsBySetName(setName).includes(actionName);
}

function firstAvailableSetName() {
  return state.actionCatalog[0] ? state.actionCatalog[0].name : '';
}
function firstAvailableActionName(setName) {
  const actions = getActionsBySetName(setName);
  return actions[0] || '';
}

/**
 * 현재 캐시를 기준으로 각 액션 행 선택값을 가능한 유지한다.
 * - Set과 Action이 그대로 있으면 유지
 * - Action만 사라지면 Set은 유지, Action만 첫 항목으로 복귀
 * - Set이 사라지면 Set/Action 모두 기본값으로 복귀
 */
function normalizeActionsAgainstCatalog() {
  // B-03: set + action 모두 유효하면 선택값을 교체하지 않음
  state.actions = state.actions.map(item => {
    const { setName, actionName } = item;

    // 선택값이 없는 경우 → placeholder 상태 유지 (기본값으로 채우지 않음)
    if (!setName && !actionName) {
      return { setName: '', actionName: '', enabled: item.enabled !== false };
    }

    // set은 있지만 카탈로그에 없음 → set만 초기화, action도 초기화
    if (setName && !catalogHasSet(setName)) {
      return { setName: '', actionName: '', enabled: item.enabled !== false };
    }

    // set은 유효, action이 없거나 카탈로그에 없음 → action만 초기화
    if (setName && actionName && !catalogHasAction(setName, actionName)) {
      return { setName, actionName: '', enabled: item.enabled !== false };
    }

    // 둘 다 유효 → 그대로 유지
    return { setName: setName || '', actionName: actionName || '', enabled: item.enabled !== false };
  });
}

async function refreshActionCatalog({ preserve = true, clearSelections = false } = {}) {
  try {
    const nextCatalog = readActionCatalog();
    state.actionCatalog = nextCatalog;
    if (clearSelections) {
      state.actions = [{ setName: '', actionName: '', enabled: true }];
    } else if (preserve) {
      normalizeActionsAgainstCatalog();
    } else {
      const defaultSet = firstAvailableSetName();
      const defaultAction = firstAvailableActionName(defaultSet);
      state.actions = state.actions.map(item => ({
        setName: defaultSet,
        actionName: defaultAction,
        enabled: item.enabled !== false
      }));
    }
    saveActionSlots();
    renderActions();
  } catch (e) {
    showAlert('Action List Error', 'Failed to read the Photoshop action list.\n' + e.message);
  }
}

function buildSelectOption(label, value, selected = false) {
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = label;
  opt.selected = selected;
  opt.title = label;
  return opt;
}

function renderActions() {
  const list = $('actionList');
  list.innerHTML = '';

  const setNames = getCatalogSetNames();
  const hasCatalog = setNames.length > 0;

  state.actions.forEach((a, i) => {
    const row = document.createElement('div');
    row.className = 'action-row' + (a.enabled === false ? ' disabled-row' : '');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'action-checkbox';
    cb.checked = a.enabled !== false;
    cb.addEventListener('change', () => {
      state.actions[i].enabled = cb.checked;
      row.className = 'action-row' + (cb.checked ? '' : ' disabled-row');
      saveActionSlots();
    });

    const num = document.createElement('span');
    num.className = 'action-num';
    num.textContent = i + 1;

    const setSelect = document.createElement('select');
    setSelect.className = 'action-select set-select';
    setSelect.title = a.setName || NO_ACTION_SET;

    if (!hasCatalog) {
      setSelect.appendChild(buildSelectOption(NO_ACTION_SET, ''));
      setSelect.disabled = true;
    } else {
      // B-04: placeholder — 선택값이 없으면 '선택해주세요' 표시
      if (!a.setName) {
        const ph = buildSelectOption('선택해주세요', '');
        ph.disabled = true;
        ph.selected = true;
        setSelect.appendChild(ph);
      }
      setNames.forEach(name => setSelect.appendChild(buildSelectOption(name, name, name === a.setName)));
      setSelect.disabled = false;
    }

    const actionSelect = document.createElement('select');
    actionSelect.className = 'action-select action-select-field';
    actionSelect.title = a.actionName || NO_ACTION;

    const actions = a.setName ? getActionsBySetName(a.setName) : [];
    if (!hasCatalog || actions.length === 0) {
      actionSelect.appendChild(buildSelectOption(NO_ACTION, ''));
      actionSelect.disabled = true;
    } else {
      // B-04: placeholder — 선택값이 없으면 '선택해주세요' 표시
      if (!a.actionName) {
        const ph = buildSelectOption('선택해주세요', '');
        ph.disabled = true;
        ph.selected = true;
        actionSelect.appendChild(ph);
      }
      actions.forEach(name => actionSelect.appendChild(buildSelectOption(name, name, name === a.actionName)));
      actionSelect.disabled = false;
    }

    setSelect.addEventListener('change', () => {
      const nextSet = setSelect.value || '';
      state.actions[i].setName = nextSet;
      state.actions[i].actionName = firstAvailableActionName(nextSet);
      saveActionSlots();
      renderActions();
    });

    actionSelect.addEventListener('change', () => {
      state.actions[i].actionName = actionSelect.value || '';
      saveActionSlots();
      actionSelect.title = state.actions[i].actionName || NO_ACTION;
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove-action';
    removeBtn.textContent = '✕';
    removeBtn.style.visibility = state.actions.length > 1 ? 'visible' : 'hidden';
    removeBtn.addEventListener('click', () => {
      state.actions.splice(i, 1);
      saveActionSlots();
      renderActions();
    });

    row.append(cb, num, setSelect, actionSelect, removeBtn);
    list.appendChild(row);
  });

  $('actionCount').textContent = '(' + state.actions.length + '/' + MAX_ACTION_ROWS + ')';
  $('btnAddAction').disabled = state.actions.length >= MAX_ACTION_ROWS;
}

function getEffectiveActions() {
  return state.actions.filter(a => a.enabled !== false);
}

async function validateActionsForRun() {
  if (!isUxpRuntime) {
    const enabledActions = getEffectiveActions();
    if (enabledActions.length === 0) {
      showAlert('Preview Mode', '브라우저 프리뷰에서는 최소 1개의 액션 슬롯을 켜두는 편이 디자인 확인에 좋아요.');
      return { ok: false };
    }
    return { ok: true, actions: enabledActions };
  }

  await refreshActionCatalog({ preserve: true });

  const enabledActions = getEffectiveActions();
  if (enabledActions.length === 0) {
    showAlert('Warning', 'There is no action to run. Please check your action settings.');
    return { ok: false };
  }

  const invalid = enabledActions.some(item => {
    if (!item.setName || !item.actionName) return true;
    if (!catalogHasSet(item.setName)) return true;
    if (!catalogHasAction(item.setName, item.actionName)) return true;
    return false;
  });

  if (invalid) {
    showAlert('Warning', 'There is no action to run. Please check your action settings.');
    return { ok: false };
  }

  return { ok: true, actions: enabledActions };
}

function addLogLine(entry) {
  state.logEntries.push(entry);
  const { fileName, status, detail } = entry;
  const isDebug = entry.kind === 'DEBUG' || status === 'DEBUG';
  const dotIdx = fileName.lastIndexOf('.');
  const ext    = dotIdx >= 0 ? fileName.slice(dotIdx + 1) : '';
  const base   = dotIdx >= 0 ? fileName.slice(0, dotIdx)  : fileName;

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
    [LOG_STATUS.PROCESSED]          : ['Processed',          's-processed'],
    [LOG_STATUS.ACTION_MANAGED_END] : ['Action Managed End', 's-ame'      ],
    [LOG_STATUS.SAVE_ER]            : ['SaveEr',             's-saveer'   ],
    [LOG_STATUS.SKIPPED]            : ['Skipped',            's-skipped'  ],
    [LOG_STATUS.ERROR]              : ['Error',              's-error'    ],
    [LOG_STATUS.CANCELLED]          : ['Cancelled',          's-cancelled']
  };
  statusMap[LOG_STATUS.NO_SAVE_TARGET] = ['No Save Target', 's-skipped'];
  const [label, cls] = statusMap[status] || [status, ''];
  const st = document.createElement('span');
  st.className = 'log-status ' + cls;
  st.textContent = label;

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
}

function updateProgress(current, total, fileName) {
  $('progressFile').textContent  = fileName;
  $('progressCount').textContent = current + ' / ' + total;
  $('progressFill').style.width  = Math.round((current / total) * 100) + '%';
}

function updateFooter(processed, saveEr, skipped, label) {
  $('footerSummary').textContent = '완료 ' + processed + ' · SaveEr ' + saveEr + ' · Skipped ' + skipped;
  $('footerState').textContent   = label;
}
function renderPreflightMessages(result) {
  const logBody = $('logBody');
  logBody.innerHTML = '';

  const makeBlock = (color, paddingTop) => {
    const block = document.createElement('div');
    block.style.color = color;
    block.style.fontSize = '11px';
    block.style.padding = paddingTop + ' 0';
    return block;
  };

  if (Array.isArray(result.errors) && result.errors.length) {
    const errBlock = makeBlock('#ef9a9a', '6px');
    result.errors.forEach((msg) => {
      const line = document.createElement('div');
      line.textContent = '❌ ' + msg;
      errBlock.appendChild(line);
    });
    logBody.appendChild(errBlock);
  }

  if (Array.isArray(result.warnings) && result.warnings.length) {
    const warnBlock = makeBlock('#ffd54f', '4px');
    result.warnings.forEach((msg) => {
      const line = document.createElement('div');
      line.textContent = '⚠️ ' + msg;
      warnBlock.appendChild(line);
    });
    logBody.appendChild(warnBlock);
  }
}
function buildLogText() {
  const lines = [];
  for (const e of state.logEntries) {
    if (e.kind === 'DEBUG') lines.push('[DEBUG] ' + (e.detail || ''));
    else lines.push([e.fileName, e.status, e.detail].filter(Boolean).join('  '));
  }
  return lines.join('\n');
}

async function forceRecoverAfterStop(reason = '강제 종료') {
  // BAP v1.4_test003 / build 140
  // 디버깅 단계에서는 복구 시점에 열린 파일을 모두 저장 없이 닫는다.
  // Run 재활성화는 runBatch 종료 후 handleRun finally에서 처리한다.
  try {
    addLogLine({ kind: 'DEBUG', fileName: '[DEBUG]', status: 'DEBUG', detail: `[ForceStop] ${reason} - 열린 문서 전체 닫기 시도` });
    const closedCount = await closeAllOpenDocsWithoutSaving();
    addLogLine({ kind: 'DEBUG', fileName: '[DEBUG]', status: 'DEBUG', detail: `[ForceStop] closed=${closedCount}` });
  } catch (e) {
    addLogLine({ kind: 'DEBUG', fileName: '[DEBUG]', status: 'DEBUG', detail: `[ForceStop][Error] ${e.message}` });
  } finally {
    updateFooter(0, 0, 0, '강제 종료 복구 처리 완료 (배치 정리 대기)');
  }
}

async function handleRun() {
  if (state.running) return;

  const validation = await validateActionsForRun();
  if (!validation.ok) return;

  state.logEntries = [];
  $('logBody').innerHTML = '';
  $('progressFile').textContent  = '—';
  $('progressCount').textContent = '0 / 0';
  $('progressFill').style.width  = '0%';
  updateFooter(0, 0, 0, '준비 중...');
  $('logPopup').style.display = 'block';

  state.running    = true;
  state.cancelFlag = false;
  $('btnRun').disabled = true;
  $('btnCancel').disabled = false;

  const summary = { processed: 0, saveEr: 0, skipped: 0 };

  try {
    if (!isUxpRuntime) {
      updateFooter(0, 0, 0, 'Preview simulation...');
      const previewLogs = [
        { fileName: 'lookbook_001.psd', status: LOG_STATUS.PROCESSED, detail: 'AUTOHUB_BASIC > Resize 1200' },
        { fileName: 'lookbook_002.psd', status: LOG_STATUS.ACTION_MANAGED_END, detail: 'CLIENT_DELIVERY > Watermark' },
        { fileName: 'lookbook_003.psd', status: LOG_STATUS.SAVE_ER, detail: 'Save target unavailable (preview sample)' },
        { fileName: 'lookbook_004.psd', status: LOG_STATUS.SKIPPED, detail: 'Unsupported source flagged in preview mode' }
      ];

      for (let i = 0; i < previewLogs.length; i++) {
        if (state.cancelFlag) break;
        const current = i + 1;
        const entry = previewLogs[i];
        updateProgress(current, previewLogs.length, entry.fileName);
        addLogLine(entry);
        if (entry.status === LOG_STATUS.PROCESSED) summary.processed++;
        else if (entry.status === LOG_STATUS.SAVE_ER) summary.saveEr++;
        else summary.skipped++;
        updateFooter(summary.processed, summary.saveEr, summary.skipped, 'Preview simulation...');
        await new Promise(resolve => setTimeout(resolve, 220));
      }

      if (state.cancelFlag) updateFooter(summary.processed, summary.saveEr, summary.skipped, '(preview cancelled)');
      else updateFooter(summary.processed, summary.saveEr, summary.skipped, '(preview complete)');
      $('progressFill').style.width = '100%';
      return;
    }

    await runBatch(
      {
        folder1    : state.folder1,
        folder2    : state.folder2,
        actions    : validation.actions,
        saveCopy   : state.saveCopy,
        saveFolder1: state.saveFolder1,
        saveFolder2: state.saveFolder2,
        suffix     : state.suffix,
        subfolders : state.subfolders,
        sortBy     : state.sortBy,
        crossOrder : state.crossOrder
      },
      {
        onPreflight: (result) => {
          if (!result.ok) renderPreflightMessages(result);
        },
        onProgress: (current, total, fileName) => {
          updateProgress(current, total, fileName);
          updateFooter(summary.processed, summary.saveEr, summary.skipped, '실행 중...');
        },
        onFileLog: (entry) => {
          addLogLine(entry);
          if      (entry.status === LOG_STATUS.PROCESSED) summary.processed++;
          else if (entry.status === LOG_STATUS.SAVE_ER)   summary.saveEr++;
          else if (entry.status === LOG_STATUS.SKIPPED || entry.status === LOG_STATUS.ERROR) summary.skipped++;
          updateFooter(summary.processed, summary.saveEr, summary.skipped, '실행 중...');
        },
        onComplete: (result) => {
          const label = result.cancelled ? '(중단됨)' : '(완료)';
          updateFooter(summary.processed, summary.saveEr, summary.skipped, label);
          $('progressFill').style.width = '100%';
          if (result.fatalActionStop) {
            showAlert('Action Stopped', 'An action stopped due to a Photoshop error. The batch run was stopped to prevent additional errors.');
          }
        },
        onDebugLog: (message) => {
          addLogLine({ kind: 'DEBUG', fileName: '[DEBUG]', status: 'DEBUG', detail: message });
        },
        isCancelled : () => state.cancelFlag,
        setCancelled: (v) => { state.cancelFlag = v; }
      }
    );
  } finally {
    state.running = false;
    state.cancelFlag = false;
    $('btnRun').disabled = false;
    $('btnCancel').disabled = false;
  }
}

setupFolderUI('displayFolder1',    'btnFolder1',     'folder1');
setupFolderUI('displayFolder2',    'btnFolder2',     'folder2');
setupFolderUI('displaySaveFolder1','btnSaveFolder1', 'saveFolder1');
setupFolderUI('displaySaveFolder2','btnSaveFolder2', 'saveFolder2');

$('sortBy').addEventListener('change', (e) => {
  state.sortBy = e.target.value;
  syncSelectWidth(e.target);
});
$('toggleSubfolders').addEventListener('click', () => {
  state.subfolders = !state.subfolders;
  setToggle($('toggleSubfolders'), state.subfolders);
});
$('btnCrossOrder').addEventListener('click', () => {
  state.crossOrder = state.crossOrder === '1to2' ? '2to1' : '1to2';
  const btn = $('btnCrossOrder');
  btn.textContent = state.crossOrder === '1to2' ? '1 → 2' : '2 → 1';
  btn.classList.toggle('active', state.crossOrder === '2to1');
});
$('toggleSaveCopy').addEventListener('click', () => {
  state.saveCopy = !state.saveCopy;
  setToggle($('toggleSaveCopy'), state.saveCopy);
});
$('inputSuffix').addEventListener('input', (e) => { state.suffix = e.target.value.trim(); });
$('btnAddAction').addEventListener('click', () => {
  if (state.actions.length >= MAX_ACTION_ROWS) return;
  const first = state.actions[0] || { setName: firstAvailableSetName(), actionName: firstAvailableActionName(firstAvailableSetName()) };
  state.actions.push({ setName: first.setName || '', actionName: first.actionName || '', enabled: true });
  saveActionSlots();
  renderActions();
});
$('btnRefreshActions').addEventListener('click', async () => {
  await refreshActionCatalog({ preserve: !isUxpRuntime, clearSelections: !isUxpRuntime ? false : true });
});
$('btnRun').addEventListener('click', handleRun);
$('btnCancel').addEventListener('click', async () => {
  if (!state.running) return;
  if (state.cancelFlag) return;
  state.cancelFlag = true;
  $('btnCancel').disabled = true;
  if (!isUxpRuntime) {
    updateFooter(0, 0, 0, 'Preview cancelled');
    return;
  }
  await forceRecoverAfterStop('사용자 Cancel');
});
$('btnCloseLog').addEventListener('click', () => { $('logPopup').style.display = 'none'; });
$('btnAlertOk').addEventListener('click', hideAlert);
$('alertBackdrop').addEventListener('click', (e) => { if (e.target === $('alertBackdrop')) hideAlert(); });
$('btnCopyLog').addEventListener('click', async () => {
  const text = buildLogText();
  const btn = $('btnCopyLog');

  async function tryCopy() {
    if (clipboard && typeof clipboard.copyText === 'function') {
      await clipboard.copyText(text);
      return true;
    }

    if (navigator.clipboard && typeof navigator.clipboard.setContent === 'function') {
      await navigator.clipboard.setContent({ 'text/plain': text });
      return true;
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand && document.execCommand('copy');
    document.body.removeChild(ta);
    if (!ok) throw new Error('copy failed');
    return true;
  }

  try {
    await tryCopy();
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy all'; btn.classList.remove('copied'); }, 1800);
  } catch (e) {
    btn.textContent = 'Failed';
    setTimeout(() => { btn.textContent = 'Copy all'; }, 1800);
  }
});

(async function init() {
  if (!isUxpRuntime) {
    document.body.classList.add('preview-mode');
    document.title = 'PS-autoHUB Preview';
    $('btnRun').textContent = 'Preview Run';
    $('btnCancel').textContent = 'Stop';
    $('progressFile').textContent = '브라우저 프리뷰 모드';
    $('footerState').textContent = 'Photoshop 없이 디자인 확인 가능';
  }

  $('sortBy').value = state.sortBy;
  syncSelectWidth($('sortBy'));
  loadActionSlots();
  await refreshActionCatalog({ preserve: true });
  renderActions();
})();
