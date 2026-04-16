'use strict';

function createActionPresetPart({
  app,
  isUxpRuntime = false,
  storage = null,
  onChange = () => {},
  onProblem = () => {}
} = {}) {
  const STORAGE_KEY = 'psautohub_action_slots_v0200';
  const NO_ACTION_SET = 'No Action Set';
  const NO_ACTION = 'No Action';
  const MAX_ACTION_ROWS = 10;
  const PREVIEW_ACTION_CATALOG = [
    { name: 'AUTOHUB_BASIC', actions: ['Resize 1200', 'Sharpen Web', 'Export JPG'] },
    { name: 'AUTOHUB_DETAIL', actions: ['Clean BG', 'Contrast Pop', 'Save Master'] },
    { name: 'CLIENT_DELIVERY', actions: ['Watermark', 'Export PNG', 'Package Assets'] }
  ];

  const state = {
    catalogCommitted: [],
    slots: [{ setName: '', actionName: '', enabled: true }],
    uiState: { refreshing: false }
  };

  const elements = {};
  let refreshPromise = null;
  let initialized = false;
  let refreshToken = 0;
  const PLACEHOLDER_VALUES = new Set([NO_ACTION_SET, NO_ACTION, '선택해주세요']);

  function notifyChange() {
    onChange(getState());
  }

  function ensureMinimumSlot() {
    state.slots = state.slots.filter(slot => slot && typeof slot === 'object');
    if (state.slots.length === 0) {
      state.slots = [{ setName: '', actionName: '', enabled: true }];
    }
  }

  function sanitizeValue(value) {
    const text = typeof value === 'string' ? value.trim() : '';
    return PLACEHOLDER_VALUES.has(text) ? '' : text;
  }

  function sanitizeSlot(slot) {
    return {
      setName: sanitizeValue(slot && slot.setName),
      actionName: sanitizeValue(slot && slot.actionName),
      enabled: slot && slot.enabled !== false
    };
  }

  function savePreset() {
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state.slots.map(sanitizeSlot)));
    } catch (_) {}
  }

  function loadPreset() {
    state.slots = [{ setName: '', actionName: '', enabled: true }];
    ensureMinimumSlot();
    if (!storage) return;
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      const normalized = parsed
        .slice(0, MAX_ACTION_ROWS)
        .filter(slot => slot && typeof slot === 'object')
        .map(sanitizeSlot);
      if (normalized.length > 0) state.slots = normalized;
    } catch (_) {}
    ensureMinimumSlot();
  }

  function clearPreset() {
    if (!storage) return;
    try {
      storage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  function readCatalog() {
    if (!isUxpRuntime) return PREVIEW_ACTION_CATALOG;

    const photoshop = typeof require === 'function' ? require('photoshop') : null;
    const liveApp = photoshop && photoshop.app ? photoshop.app : app;
    const sets = Array.isArray(liveApp && liveApp.actionTree) ? liveApp.actionTree : [];

    return sets
      .filter(setItem => setItem && typeof setItem.name === 'string' && setItem.name.trim())
      .map(setItem => {
        const names = Array.isArray(setItem.actions)
          ? setItem.actions
              .filter(action => action && typeof action.name === 'string' && action.name.trim())
              .map(action => action.name.trim())
          : [];

        return {
          name: setItem.name.trim(),
          actions: Array.from(new Set(names))
        };
      });
  }

  function getCatalog() {
    return state.catalogCommitted.slice();
  }

  function isValidCatalog(catalog) {
    return Array.isArray(catalog) && catalog.every((setItem) => {
      return setItem &&
        typeof setItem.name === 'string' &&
        Array.isArray(setItem.actions) &&
        setItem.actions.every((actionName) => typeof actionName === 'string');
    });
  }

  function getSetNames() {
    return state.catalogCommitted.map(item => item.name);
  }

  function getActionsForSet(setName) {
    const found = state.catalogCommitted.find(item => item.name === setName);
    return found ? found.actions : [];
  }

  function hasSet(setName) {
    return !!state.catalogCommitted.find(item => item.name === setName);
  }

  function hasAction(setName, actionName) {
    return getActionsForSet(setName).includes(actionName);
  }

  function getDisplaySetName(slot) {
    if (!slot || !slot.setName) return '';
    if (!state.catalogCommitted.length) return slot.setName;
    return hasSet(slot.setName) ? slot.setName : '';
  }

  function getDisplayActionName(slot) {
    if (!slot || !slot.actionName) return '';
    if (!state.catalogCommitted.length) return slot.actionName;
    return hasAction(slot.setName, slot.actionName) ? slot.actionName : '';
  }

  function buildOption(label, value, selected = false) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = selected;
    option.title = label;
    return option;
  }

  function syncNativeSelectDisplay(select, desiredValue) {
    if (!select) return;

    const options = Array.from(select.options || []);
    if (!options.length) return;

    let nextIndex = options.findIndex((option) => option.value === desiredValue);
    if (nextIndex < 0) {
      nextIndex = Math.max(0, select.selectedIndex);
    }
    if (nextIndex < 0) nextIndex = 0;

    const nextValue = options[nextIndex].value;
    select.value = nextValue;
    select.selectedIndex = nextIndex;
  }

  function render() {
    ensureMinimumSlot();
    const list = elements.actionList;
    list.innerHTML = '';

    const setNames = getSetNames();
    const hasCatalog = setNames.length > 0;

    state.slots.forEach((slot, index) => {
      const displaySetName = getDisplaySetName(slot);
      const displayActionName = getDisplayActionName(slot);
      const row = document.createElement('div');
      row.className = 'action-row' + (slot.enabled === false ? ' disabled-row' : '');

      const toggleCell = document.createElement('label');
      toggleCell.className = 'action-toggle';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'action-checkbox';
      checkbox.checked = slot.enabled !== false;
      checkbox.addEventListener('change', () => setSlotEnabled(index, checkbox.checked));

      const num = document.createElement('span');
      num.className = 'action-num';
      num.textContent = index + 1;

      toggleCell.append(checkbox, num);

      const fields = document.createElement('div');
      fields.className = 'action-fields';

      const setSelect = document.createElement('select');
      setSelect.className = 'action-select set-select';
      setSelect.title = displaySetName || NO_ACTION_SET;
      if (!hasCatalog) {
        setSelect.appendChild(buildOption(displaySetName || NO_ACTION_SET, displaySetName || ''));
        setSelect.disabled = true;
      } else {
        if (!displaySetName) {
          const placeholder = buildOption('선택해주세요', '');
          placeholder.disabled = true;
          placeholder.selected = true;
          setSelect.appendChild(placeholder);
        }
        setNames.forEach(name => setSelect.appendChild(buildOption(name, name, name === displaySetName)));
      }
      setSelect.addEventListener('mousedown', () => { requestCatalogRefresh(); });
      setSelect.addEventListener('focus', () => { requestCatalogRefresh(); });
      setSelect.addEventListener('change', () => setSlotSet(index, setSelect.value || ''));
      syncNativeSelectDisplay(setSelect, displaySetName);

      const actionSelect = document.createElement('select');
      actionSelect.className = 'action-select action-select-field';
      actionSelect.title = displayActionName || NO_ACTION;
      const actions = displaySetName ? getActionsForSet(displaySetName) : [];
      if (!hasCatalog || actions.length === 0) {
        actionSelect.appendChild(buildOption(displayActionName || NO_ACTION, displayActionName || ''));
        actionSelect.disabled = true;
      } else {
        if (!displayActionName) {
          const placeholder = buildOption('선택해주세요', '');
          placeholder.disabled = true;
          placeholder.selected = true;
          actionSelect.appendChild(placeholder);
        }
        actions.forEach(name => actionSelect.appendChild(buildOption(name, name, name === displayActionName)));
      }
      actionSelect.addEventListener('mousedown', () => { requestCatalogRefresh(); });
      actionSelect.addEventListener('focus', () => { requestCatalogRefresh(); });
      actionSelect.addEventListener('change', () => setSlotAction(index, actionSelect.value || ''));
      syncNativeSelectDisplay(actionSelect, displayActionName);

      fields.append(setSelect, actionSelect);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn-icon btn-remove-action';
      removeBtn.setAttribute('aria-label', (index + 1) + '번 액션 제거');
      removeBtn.innerHTML = '<span class="icon-mask icon-close" aria-hidden="true"></span>';
      removeBtn.style.visibility = state.slots.length > 1 ? 'visible' : 'hidden';
      removeBtn.addEventListener('click', () => removeSlot(index));

      row.append(toggleCell, fields, removeBtn);
      list.appendChild(row);
    });

    elements.actionCount.textContent = '(' + state.slots.length + '/' + MAX_ACTION_ROWS + ')';
    elements.btnAddAction.disabled = state.slots.length >= MAX_ACTION_ROWS;
  }

  async function refreshCatalog({ allowEmpty = true } = {}) {
    const token = ++refreshToken;
    try {
      state.uiState.refreshing = true;
      const nextCatalog = readCatalog();

      if (token !== refreshToken) return;

      if (!isValidCatalog(nextCatalog)) {
        return;
      }

      if ((!Array.isArray(nextCatalog) || nextCatalog.length === 0) && !allowEmpty && state.catalogCommitted.length > 0) {
        return;
      }

      state.catalogCommitted = Array.isArray(nextCatalog) ? nextCatalog : [];
      ensureMinimumSlot();
      render();
      notifyChange();
    } catch (error) {
      onProblem(error);
    } finally {
      state.uiState.refreshing = false;
    }
  }

  async function requestCatalogRefresh() {
    if (!isUxpRuntime) return;
    if (!refreshPromise) {
      refreshPromise = refreshCatalog({ allowEmpty: false }).finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  }

  function getSlots() {
    ensureMinimumSlot();
    return state.slots.map(slot => ({ ...slot }));
  }

  function getEffectiveActions() {
    return state.slots
      .filter(slot => slot.enabled !== false)
      .map(slot => ({ ...slot }));
  }

  function validateForRun() {
    const enabled = getEffectiveActions();
    if (enabled.length === 0) {
      return { ok: false, message: 'There is no action to run. Please check your action settings.' };
    }

    const invalid = enabled.some(slot => {
      if (!slot.setName || !slot.actionName) return true;
      if (!hasSet(slot.setName)) return true;
      if (!hasAction(slot.setName, slot.actionName)) return true;
      return false;
    });

    if (invalid) {
      return { ok: false, message: 'There is no action to run. Please check your action settings.' };
    }

    return { ok: true, actions: enabled };
  }

  function setSlotSet(index, setName) {
    state.slots[index].setName = setName;
    state.slots[index].actionName = setName ? (getActionsForSet(setName)[0] || '') : '';
    savePreset();
    render();
    notifyChange();
  }

  function setSlotAction(index, actionName) {
    state.slots[index].actionName = actionName;
    savePreset();
    render();
    notifyChange();
  }

  function setSlotEnabled(index, enabled) {
    state.slots[index].enabled = enabled;
    savePreset();
    render();
    notifyChange();
  }

  function addEmptySlot() {
    ensureMinimumSlot();
    if (state.slots.length >= MAX_ACTION_ROWS) return;
    state.slots.push({ setName: '', actionName: '', enabled: true });
    savePreset();
    render();
    notifyChange();
  }

  function removeSlot(index) {
    state.slots.splice(index, 1);
    ensureMinimumSlot();
    savePreset();
    render();
    notifyChange();
  }

  async function resetToInitialState() {
    refreshToken += 1;
    refreshPromise = null;
    state.uiState.refreshing = false;
    state.slots = [{ setName: '', actionName: '', enabled: true }];
    render();
    notifyChange();

    clearPreset();
  }

  function getState() {
    return {
      catalog: getCatalog(),
      slots: getSlots(),
      uiState: { ...state.uiState },
      storageKey: STORAGE_KEY,
      debug: {
        catalogCount: state.catalogCommitted.length,
        slotCount: state.slots.length,
        refreshing: state.uiState.refreshing,
        pending: !!refreshPromise,
        firstSet: state.catalogCommitted[0] ? state.catalogCommitted[0].name : ''
      }
    };
  }

  async function init(ids) {
    if (initialized) {
      restoreView();
      return;
    }

    elements.actionList = document.getElementById(ids.actionList);
    elements.btnRefreshActions = document.getElementById(ids.btnRefreshActions);
    elements.btnAddAction = document.getElementById(ids.btnAddAction);
    elements.actionCount = document.getElementById(ids.actionCount);

    loadPreset();
    state.catalogCommitted = [];
    ensureMinimumSlot();
    render();

    elements.btnAddAction.addEventListener('click', addEmptySlot);
    elements.btnRefreshActions.addEventListener('click', () => {
      if (state.uiState.refreshing) return;
      resetToInitialState();
    });
    initialized = true;
    requestCatalogRefresh();
  }

  function restoreView() {
    loadPreset();
    state.catalogCommitted = [];
    ensureMinimumSlot();
    render();
    notifyChange();
    requestCatalogRefresh();
  }

  return {
    init,
    loadPreset,
    savePreset,
    clearPreset,
    refreshCatalog,
    requestCatalogRefresh,
    getCatalog,
    getSlots,
    getEffectiveActions,
    validateForRun,
    addEmptySlot,
    removeSlot,
    setSlotSet,
    setSlotAction,
    setSlotEnabled,
    ensureMinimumSlot,
    resetToInitialState,
    render,
    restoreView,
    getState
  };
}

module.exports = { createActionPresetPart };
