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
  const MAX_ACTION_ROWS = 15;
  // Photoshop 27's "Essentials" tab is a fixed list of Adobe-provided curated
  // sets (Basic Adjustments / Subject & Background / Creative Effects / Guides
  // / Resize / Export). They are not realistic batch-automation targets — if a
  // user actually wants one, they can copy it into a "Yours" set. We exclude
  // them here so the catalog stays small (faster reads, faster renders).
  const ESSENTIALS_SET_NAMES = new Set([
    'Basic Adjustments',
    'Subject & Background',
    'Creative Effects',
    'Guides',
    'Resize',
    'Export'
  ]);

  const PREVIEW_ACTION_CATALOG = [
    { name: 'AUTOHUB_BASIC', actions: ['Resize 1200', 'Sharpen Web', 'Export JPG'] },
    { name: 'AUTOHUB_DETAIL', actions: ['Clean BG', 'Contrast Pop', 'Save Master'] },
    { name: 'CLIENT_DELIVERY', actions: ['Watermark', 'Export PNG', 'Package Assets'] }
  ];

  const REFRESH_DEBOUNCE_MS = 1500;

  const state = {
    catalogCommitted: [],
    slots: [{ setName: '', actionName: '', enabled: false, enabledOrder: 0 }],
    uiState: { refreshing: false, moreActionsExpanded: false },
    enableSeq: 0,
    lastReadDiag: null,
    lastRefreshAt: 0,
    actionSetProbed: false
  };

  const elements = {};
  let initialized = false;
  const PLACEHOLDER_VALUES = new Set([NO_ACTION_SET, NO_ACTION, '선택해주세요']);

  function notifyChange() {
    onChange(getState());
  }

  function ensureMinimumSlot() {
    state.slots = state.slots.filter(slot => slot && typeof slot === 'object');
    if (state.slots.length === 0) {
      state.slots = [{ setName: '', actionName: '', enabled: false, enabledOrder: 0 }];
    }
  }

  function sanitizeValue(value) {
    const text = typeof value === 'string' ? value.trim() : '';
    return PLACEHOLDER_VALUES.has(text) ? '' : text;
  }

  function sanitizeSlot(slot) {
    const enabled = slot && slot.enabled !== false;
    const rawOrder = slot && Number(slot.enabledOrder);
    const enabledOrder = enabled && Number.isFinite(rawOrder) && rawOrder > 0 ? rawOrder : 0;
    return {
      setName: sanitizeValue(slot && slot.setName),
      actionName: sanitizeValue(slot && slot.actionName),
      enabled,
      enabledOrder
    };
  }

  function savePreset() {
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state.slots.map(sanitizeSlot)));
    } catch (_) {}
  }

  function reseedEnableSeq() {
    state.enableSeq = state.slots.reduce((max, slot) => {
      const order = slot && Number(slot.enabledOrder);
      return Number.isFinite(order) && order > max ? order : max;
    }, 0);
  }

  function loadPreset() {
    state.slots = [{ setName: '', actionName: '', enabled: false, enabledOrder: 0 }];
    state.enableSeq = 0;
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
    reseedEnableSeq();
  }

  function clearPreset() {
    if (!storage) return;
    try {
      storage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  function toSafeArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.slice();
    try {
      const fromArray = Array.from(value);
      if (fromArray.length > 0) return fromArray;
    } catch (_) {
    }

    const length = Number(value && value.length);
    if (Number.isFinite(length) && length >= 0) {
      const next = [];
      for (let i = 0; i < length; i += 1) {
        next.push(value[i]);
      }
      if (next.length > 0) return next;
    }

    try {
      if (typeof value.forEach === 'function') {
        const next = [];
        value.forEach((item) => next.push(item));
        if (next.length > 0) return next;
      }
    } catch (_) {}

    try {
      const keys = Object.keys(value).filter((key) => /^\d+$/.test(key)).sort((a, b) => Number(a) - Number(b));
      if (keys.length > 0) {
        return keys.map((key) => value[key]);
      }
    } catch (_) {}

    try {
      const values = Object.values(value).filter((item) => item && typeof item === 'object');
      if (values.length > 0) return values;
    } catch (_) {}

    return [];
  }

  function describeCollection(value) {
    if (value == null) return String(value);
    const t = typeof value;
    if (t !== 'object') return t;
    const arr = Array.isArray(value);
    const len = (() => {
      try { return Number(value.length); } catch (_) { return NaN; }
    })();
    const keys = (() => {
      try { return Object.keys(value).slice(0, 6); } catch (_) { return []; }
    })();
    return `arr=${arr} len=${Number.isFinite(len) ? len : '?'} keys=[${keys.join(',')}]`;
  }

  function readCatalog() {
    if (!isUxpRuntime) return PREVIEW_ACTION_CATALOG;

    const photoshop = typeof require === 'function' ? require('photoshop') : null;
    const fallbackApp = photoshop && photoshop.app ? photoshop.app : null;
    const treeFromApp = app && app.actionTree;
    const treeFromReq = fallbackApp && fallbackApp.actionTree;

    let sets = toSafeArray(treeFromApp);
    if (sets.length === 0) sets = toSafeArray(treeFromReq);

    // Only build the (relatively expensive) diagnostic when the read failed,
    // so the happy-path stays cheap.
    if (sets.length === 0) {
      state.lastReadDiag = {
        treeFromApp: describeCollection(treeFromApp),
        treeFromReq: describeCollection(treeFromReq),
        decodedSets: 0,
        firstSetSample: null
      };
      if (typeof console !== 'undefined' && console.log) {
        try { console.log('[PS-autoHUB] readCatalog empty:', state.lastReadDiag); } catch (_) {}
      }
    } else {
      state.lastReadDiag = { decodedSets: sets.length };
      if (typeof console !== 'undefined' && console.log) {
        try {
          const firstName = typeof sets[0].name === 'string' ? sets[0].name : '(non-string)';
          console.log('[PS-autoHUB] readCatalog sets=' + sets.length + ' first=' + firstName);
          // One-time probe: dump enumerable keys + a few primitive values from
          // the first ActionSet, so we can see if Photoshop exposes anything
          // (parent/category/tab/kind/...) that lets us tell Essentials apart
          // from Yours. Public docs only mention name/id/index/actions/typename.
          if (!state.actionSetProbed) {
            state.actionSetProbed = true;
            const item = sets[0];
            const keys = (() => { try { return Object.keys(item).slice(0, 20); } catch (_) { return []; } })();
            const probe = { keys: keys };
            keys.forEach(k => {
              try {
                const v = item[k];
                const t = typeof v;
                if (t === 'string' || t === 'number' || t === 'boolean') probe[k] = v;
                else probe[k] = '(' + t + ')';
              } catch (_) { probe[k] = '(throw)'; }
            });
            console.log('[PS-autoHUB] ActionSet probe:', probe);
          }
        } catch (_) {}
      }
    }

    // Read each Proxy property exactly once. Proxy field access is the slow
    // path (every read crosses the native bridge); naive filter+map can hit
    // each `.name` 3x per item, multiplying the cost on large catalogs.
    const result = [];
    for (let i = 0; i < sets.length; i += 1) {
      const setItem = sets[i];
      if (!setItem) continue;
      const setName = typeof setItem.name === 'string' ? setItem.name.trim() : '';
      if (!setName) continue;
      // Essentials tab is excluded entirely from this plugin's catalog.
      if (ESSENTIALS_SET_NAMES.has(setName)) continue;

      const actionItems = toSafeArray(setItem.actions);
      const seen = new Set();
      const actionNames = [];
      for (let j = 0; j < actionItems.length; j += 1) {
        const action = actionItems[j];
        if (!action) continue;
        const actionName = typeof action.name === 'string' ? action.name.trim() : '';
        if (!actionName || seen.has(actionName)) continue;
        seen.add(actionName);
        actionNames.push(actionName);
      }

      result.push({ name: setName, actions: actionNames });
    }
    return result;
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

  function firstAvailableSetName() {
    return state.catalogCommitted[0] ? state.catalogCommitted[0].name : '';
  }

  function firstAvailableActionName(setName) {
    const actions = getActionsForSet(setName);
    return actions[0] || '';
  }

  function normalizeSlotsAgainstCatalog() {
    // catalog가 비어 있으면 user의 setName/actionName을 그대로 유지한다.
    // (Photoshop actionTree가 아직 초기화되지 않은 전이 상태에서 사용자의 선택을 보호)
    if (!Array.isArray(state.catalogCommitted) || state.catalogCommitted.length === 0) {
      reseedEnableSeq();
      return;
    }

    state.slots = state.slots.map((slot) => {
      const setName = sanitizeValue(slot && slot.setName);
      const actionName = sanitizeValue(slot && slot.actionName);
      const enabled = slot && slot.enabled !== false;
      const rawOrder = slot && Number(slot.enabledOrder);
      const enabledOrder = enabled && Number.isFinite(rawOrder) && rawOrder > 0 ? rawOrder : 0;

      if (!setName && !actionName) {
        return { setName: '', actionName: '', enabled, enabledOrder };
      }

      if (setName && !hasSet(setName)) {
        return { setName: '', actionName: '', enabled, enabledOrder };
      }

      if (setName && actionName && !hasAction(setName, actionName)) {
        return { setName, actionName: '', enabled, enabledOrder };
      }

      return { setName: setName || '', actionName: actionName || '', enabled, enabledOrder };
    });
    reseedEnableSeq();
  }

  function esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Custom picker (replaces sp-picker to allow full control over popup position/size)
  const ITEM_HEIGHT = 24; // px
  const POPUP_MAX_HEIGHT = 280; // px
  let openPicker = null; // currently open picker element
  let globalClickHandler = null;

  function closeOpenPicker() {
    if (openPicker) {
      const popup = openPicker.querySelector('.cp-popup');
      if (popup) {
        // Keep in render tree but hide off-screen
        popup.style.visibility = 'hidden';
        popup.style.top = '-9999px';
      }
      openPicker.classList.remove('cp-open');
      // Remove stacking-context class from ancestors
      let node = openPicker.parentElement;
      while (node && node !== document.body) {
        node.classList.remove('cp-parent-open');
        node = node.parentElement;
      }
      openPicker = null;
    }
    if (globalClickHandler) {
      document.removeEventListener('mousedown', globalClickHandler, true);
      globalClickHandler = null;
    }
  }

  // Render only real items — no blank DOM padding.
  // Selected position is handled in positionPopup by placing popup so selected aligns with picker center.
  function computeSlots(items, selectedValue) {
    const selectedIndex = items.indexOf(selectedValue);
    const idx = selectedIndex >= 0 ? selectedIndex : 0;
    return {
      slots: items.map((name, i) => ({ name: name, index: i, isBlank: false, selected: i === idx }))
    };
  }

  function buildPickerHTML(cls, placeholder, items, selectedValue, disabled) {
    const val = selectedValue || '';
    const labelText = val || placeholder;
    const dis = disabled ? ' cp-disabled' : '';
    const parts = [];
    parts.push('<div class="custom-picker ' + cls + dis + '" data-value="' + esc(val) + '" tabindex="0">');
    parts.push('<div class="cp-trigger" role="button" tabindex="0"' + (disabled ? ' aria-disabled="true"' : '') + '>');
    parts.push('<span class="cp-label' + (val ? '' : ' cp-placeholder') + '">' + esc(labelText) + '</span>');
    parts.push('<svg class="cp-chevron accordion-chevron" aria-hidden="true" viewBox="0 0 10 10" focusable="false"><path class="accordion-chevron-shape" d="M1.75 3L5 6.5L8.25 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>');
    parts.push('</div>');
    // Popup stays in render tree at all times (off-screen when closed) to avoid first-click layout race
    parts.push('<div class="cp-popup" style="visibility:hidden;top:-9999px;">');
    const { slots } = computeSlots(items || [], selectedValue);
    slots.forEach(function (slot) {
      if (slot.isBlank) {
        parts.push('<div class="cp-item cp-blank" aria-hidden="true">&nbsp;</div>');
      } else {
        const sel = slot.selected ? ' cp-selected' : '';
        parts.push('<div class="cp-item' + sel + '" data-value="' + esc(slot.name) + '" title="' + esc(slot.name) + '">' + esc(slot.name) + '</div>');
      }
    });
    parts.push('</div>');
    parts.push('</div>');
    return parts.join('');
  }

  function positionPopup(picker, popup) {
    const items = Array.from(popup.querySelectorAll('.cp-item'));
    const MARGIN = 4;

    // Find selected (real) item — blanks are skipped
    let selectedEl = popup.querySelector('.cp-item.cp-selected');
    if (!selectedEl) selectedEl = items[0] || null;

    // Setup dimensions
    popup.style.right = '';
    popup.style.bottom = '';

    // Popup width adjustments based on picker type
    const isSetPicker = picker.classList.contains('set-select');
    const isActionPicker = picker.classList.contains('action-select-field');

    if (isSetPicker) {
      // Set picker popup: 10% wider than the picker button
      popup.style.width = Math.round(picker.offsetWidth * 1.1) + 'px';
      popup.style.left = '0';
    } else if (isActionPicker) {
      // Action picker popup: start 5% earlier (left), extend right to X button
      const row = picker.closest('.action-row');
      const removeBtn = row ? row.querySelector('.btn-remove-action') : null;
      const pickerRectForW = picker.getBoundingClientRect();
      const shiftLeft = Math.round(picker.offsetWidth * 0.05);
      let targetWidth = picker.offsetWidth + shiftLeft; // base: picker width + shift amount
      if (removeBtn) {
        const removeRect = removeBtn.getBoundingClientRect();
        const desiredWidth = (removeRect.left - pickerRectForW.left) + shiftLeft;
        if (desiredWidth > targetWidth) targetWidth = desiredWidth;
      }
      popup.style.width = Math.round(targetWidth) + 'px';
      popup.style.left = (-shiftLeft) + 'px';
    } else {
      popup.style.width = picker.offsetWidth + 'px';
      popup.style.left = '0';
    }

    // max-height is set in CSS; popup height is constrained, content scrolls if too tall
    const pickerRect = picker.getBoundingClientRect();
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const popupH = popup.getBoundingClientRect().height;
    const pickerCenter = pickerRect.top + pickerRect.height / 2;
    const selectedOffset = selectedEl ? (selectedEl.offsetTop + selectedEl.offsetHeight / 2) : popupH / 2;

    // Target: selected item's center aligns with picker center
    // Ideal popup top in viewport = pickerCenter - selectedOffset
    let popupTopAbs = pickerCenter - selectedOffset;

    // Clamp popup within viewport
    const minTop = MARGIN;
    const maxTop = viewportH - MARGIN - popupH;
    if (popupTopAbs < minTop) popupTopAbs = minTop;
    if (popupTopAbs > maxTop && maxTop >= minTop) popupTopAbs = maxTop;

    popup.style.top = (popupTopAbs - pickerRect.top) + 'px';

    // Scroll so selected's visible position stays at picker center after clamp
    // selected viewport Y = popupTopAbs + selectedOffset - scrollTop → want = pickerCenter
    // scrollTop = popupTopAbs + selectedOffset - pickerCenter
    const targetScroll = popupTopAbs + selectedOffset - pickerCenter;
    const maxScroll = popup.scrollHeight - popup.clientHeight;
    popup.scrollTop = Math.max(0, Math.min(targetScroll, maxScroll));
  }

  async function openPickerWithRefresh(picker) {
    // Open immediately with the cached catalog so the user is never blocked.
    // Then run only the narrowest refresh that could possibly be affected by
    // what the user just clicked:
    //   - set picker    → refresh just the set NAME list (cheap; one .name
    //                     access per set, no action enumeration)
    //   - action picker → refresh just the chosen set's actions
    // The full readCatalog is reserved for the initial panel load and the
    // explicit Reset All button.
    openPickerPopup(picker);

    if (!isUxpRuntime || state.uiState.refreshing) return;
    const now = Date.now();
    if (now - (state.lastRefreshAt || 0) < REFRESH_DEBOUNCE_MS) return;
    state.lastRefreshAt = now;

    const pickerType = picker.dataset.pickerType;
    const slotIndexRaw = picker.dataset.slotIndex;
    if (pickerType === 'action' && slotIndexRaw !== undefined) {
      const slot = state.slots[Number(slotIndexRaw)];
      if (slot && slot.setName) {
        Promise.resolve().then(() => refreshActionsForSet(slot.setName)).catch(() => {});
        return;
      }
    }
    // set picker (or action picker without a chosen set yet)
    Promise.resolve().then(() => refreshSetList()).catch(() => {});
  }

  function openPickerPopup(picker) {
    if (picker.classList.contains('cp-disabled')) return;

    // Close any other open picker first
    if (openPicker && openPicker !== picker) closeOpenPicker();

    const popup = picker.querySelector('.cp-popup');
    if (!popup) return;

    picker.classList.add('cp-open');
    // Add stacking-context class to ancestors so popup can escape panel sections
    let node = picker.parentElement;
    while (node && node !== document.body) {
      node.classList.add('cp-parent-open');
      node = node.parentElement;
    }
    openPicker = picker;

    // Popup is always in render tree (off-screen) — positioning is immediate and consistent
    positionPopup(picker, popup);
    popup.style.visibility = 'visible';

    // Global click-outside to close
    globalClickHandler = (e) => {
      if (!picker.contains(e.target)) closeOpenPicker();
    };
    setTimeout(() => {
      document.addEventListener('mousedown', globalClickHandler, true);
    }, 0);
  }

  function attachCustomPickerEvents(picker, onChangeValue) {
    if (!picker) return;
    const trigger = picker.querySelector('.cp-trigger');
    const popup = picker.querySelector('.cp-popup');
    if (!trigger || !popup) return;

    trigger.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (openPicker === picker) {
        closeOpenPicker();
        return;
      }
      await openPickerWithRefresh(picker);
    });

    popup.addEventListener('click', (e) => {
      const item = e.target.closest('.cp-item');
      if (!item || item.classList.contains('cp-blank')) return;
      const value = item.dataset.value || '';
      picker.dataset.value = value;
      closeOpenPicker();
      if (typeof onChangeValue === 'function') onChangeValue(value);
    });

    picker.addEventListener('keydown', (e) => {
      const isOpen = openPicker === picker;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!isOpen) openPickerWithRefresh(picker);
      } else if (e.key === 'Escape') {
        closeOpenPicker();
      } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && isOpen) {
        e.preventDefault();
        const items = Array.from(popup.querySelectorAll('.cp-item'));
        let idx = items.findIndex((it) => it.classList.contains('cp-focus'));
        if (idx < 0) idx = items.findIndex((it) => it.classList.contains('cp-selected'));
        if (idx < 0) idx = 0;
        idx = e.key === 'ArrowDown' ? Math.min(items.length - 1, idx + 1) : Math.max(0, idx - 1);
        items.forEach((it) => it.classList.remove('cp-focus'));
        if (items[idx]) {
          items[idx].classList.add('cp-focus');
          items[idx].scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === 'Enter' && isOpen) {
        const focused = popup.querySelector('.cp-item.cp-focus');
        if (focused) {
          const value = focused.dataset.value || '';
          picker.dataset.value = value;
          closeOpenPicker();
          if (typeof onChangeValue === 'function') onChangeValue(value);
        }
      }
    });
  }

  function buildSlotRow(slot, index) {
    const setNames = getSetNames();
    const hasCatalog = setNames.length > 0;
    const displaySetName = getDisplaySetName(slot);
    const displayActionName = getDisplayActionName(slot);
    const actions = displaySetName ? getActionsForSet(displaySetName) : [];

    const row = document.createElement('div');
    row.className = 'action-row' + (slot.enabled === false ? ' disabled-row' : '');

    const toggleCell = document.createElement('label');
    toggleCell.className = 'action-toggle';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'action-checkbox';
    checkbox.checked = slot.enabled !== false;
    checkbox.addEventListener('change', () => setSlotEnabled(index, checkbox.checked));
    toggleCell.append(checkbox);

    const fields = document.createElement('div');
    fields.className = 'action-fields';
    fields.innerHTML =
      buildPickerHTML(
        'set-select',
        '선택해주세요',
        hasCatalog ? setNames : [],
        displaySetName,
        !hasCatalog
      ) +
      buildPickerHTML(
        'action-select-field',
        '선택해주세요',
        actions,
        displayActionName,
        !hasCatalog || actions.length === 0
      );

    const setPicker = fields.querySelector('.set-select');
    const actPicker = fields.querySelector('.action-select-field');
    if (setPicker) {
      setPicker.dataset.slotIndex = String(index);
      setPicker.dataset.pickerType = 'set';
      attachCustomPickerEvents(setPicker, (val) => setSlotSet(index, val));
    }
    if (actPicker) {
      actPicker.dataset.slotIndex = String(index);
      actPicker.dataset.pickerType = 'action';
      attachCustomPickerEvents(actPicker, (val) => setSlotAction(index, val));
    }

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-icon btn-remove-action';
    removeBtn.setAttribute('aria-label', (index + 1) + '번 액션 제거');
    removeBtn.title = '액션 제거';
    removeBtn.addEventListener('click', () => removeSlot(index));

    row.append(toggleCell, fields, removeBtn);
    return row;
  }

  function buildMoreActionsAccordion(disabledEntries) {
    const expanded = !!state.uiState.moreActionsExpanded;

    const wrapper = document.createElement('div');
    wrapper.className = 'more-actions' + (expanded ? ' is-expanded' : '');

    const header = document.createElement('div');
    header.className = 'btn-disclosure more-actions-header';
    header.setAttribute('role', 'button');
    header.setAttribute('tabindex', '0');
    header.setAttribute('aria-expanded', String(expanded));
    header.setAttribute('aria-controls', 'moreActionsContent');

    const icon = document.createElement('span');
    icon.className = 'accordion-icon';
    icon.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'accordion-label';
    label.textContent = 'more Actions';

    const count = document.createElement('span');
    count.className = 'more-actions-count';
    count.textContent = '(' + disabledEntries.length + ')';

    header.append(icon, label, count);

    const content = document.createElement('div');
    content.className = 'disclosure-content more-actions-content';
    content.id = 'moreActionsContent';
    content.hidden = !expanded;
    disabledEntries.forEach(({ slot, index }) => {
      content.appendChild(buildSlotRow(slot, index));
    });

    const toggle = () => {
      state.uiState.moreActionsExpanded = !state.uiState.moreActionsExpanded;
      render();
    };

    header.addEventListener('click', toggle);
    header.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      toggle();
    });

    wrapper.append(header, content);
    return wrapper;
  }

  function render() {
    ensureMinimumSlot();
    const list = elements.actionList;
    list.innerHTML = '';

    const enabledEntries = [];
    const disabledEntries = [];
    state.slots.forEach((slot, index) => {
      if (slot.enabled !== false) enabledEntries.push({ slot, index });
      else disabledEntries.push({ slot, index });
    });

    enabledEntries.sort((a, b) => {
      const ao = Number(a.slot.enabledOrder) || 0;
      const bo = Number(b.slot.enabledOrder) || 0;
      if (ao !== bo) return ao - bo;
      return a.index - b.index;
    });

    enabledEntries.forEach(({ slot, index }) => {
      list.appendChild(buildSlotRow(slot, index));
    });

    if (disabledEntries.length > 0) {
      list.appendChild(buildMoreActionsAccordion(disabledEntries));
    }

    elements.actionCount.textContent = '(' + state.slots.length + '/' + MAX_ACTION_ROWS + ')';
    elements.btnAddAction.disabled = state.slots.length >= MAX_ACTION_ROWS;
  }

  function reopenInfoFromOpenPicker() {
    return openPicker ? {
      slotIndex: openPicker.dataset.slotIndex,
      pickerType: openPicker.dataset.pickerType
    } : null;
  }

  function reopenPickerByInfo(info) {
    if (!info || info.slotIndex === undefined || info.slotIndex === null) return;
    const sel = info.pickerType === 'set' ? '.set-select' : '.action-select-field';
    const newPicker = elements.actionList.querySelector(
      '[data-slot-index="' + info.slotIndex + '"]' + sel
    );
    if (newPicker) openPickerPopup(newPicker);
  }

  // Partial refresh — read only the set NAMES from Photoshop and reconcile
  // them with state.catalogCommitted. Used when the user opens a set-picker:
  // we just need to know which sets exist; the actions inside each set are
  // not required until the user opens an action-picker. This avoids reading
  // every action of every set (which is what made dropdown opens slow).
  async function refreshSetList() {
    if (!isUxpRuntime) return;
    try {
      state.uiState.refreshing = true;
      const photoshop = typeof require === 'function' ? require('photoshop') : null;
      const liveApp = (photoshop && photoshop.app) || app;
      const sets = toSafeArray(liveApp && liveApp.actionTree);

      const newNames = [];
      for (let i = 0; i < sets.length; i += 1) {
        const item = sets[i];
        if (!item) continue;
        const name = typeof item.name === 'string' ? item.name.trim() : '';
        if (!name) continue;
        if (ESSENTIALS_SET_NAMES.has(name)) continue;
        newNames.push(name);
      }

      const current = state.catalogCommitted;
      const currentNames = current.map(s => s.name);
      let unchanged = currentNames.length === newNames.length;
      if (unchanged) {
        for (let k = 0; k < currentNames.length; k += 1) {
          if (currentNames[k] !== newNames[k]) { unchanged = false; break; }
        }
      }
      if (unchanged) return;

      // Preserve cached actions for sets that still exist; new sets get an
      // empty actions list which will be filled lazily when their action
      // picker is opened.
      const cachedActions = new Map();
      current.forEach(s => cachedActions.set(s.name, s.actions || []));
      const next = newNames.map(name => ({
        name: name,
        actions: cachedActions.has(name) ? cachedActions.get(name) : []
      }));

      const reopen = reopenInfoFromOpenPicker();
      state.catalogCommitted = next;

      normalizeSlotsAgainstCatalog();
      ensureMinimumSlot();
      savePreset();
      render();
      notifyChange();
      reopenPickerByInfo(reopen);

      if (typeof console !== 'undefined' && console.log) {
        try { console.log('[PS-autoHUB] set list refresh, count=' + next.length); } catch (_) {}
      }
    } catch (error) {
      onProblem(error);
    } finally {
      state.uiState.refreshing = false;
    }
  }

  // Partial refresh — read only one set's actions from Photoshop and patch
  // state.catalogCommitted. Used when the user opens an action-picker, since
  // they cannot have changed sets they aren't looking at; reading the entire
  // actionTree (every set × every action) just to refresh one slot is wasteful.
  async function refreshActionsForSet(setName) {
    if (!isUxpRuntime || !setName) return;
    try {
      state.uiState.refreshing = true;
      const photoshop = typeof require === 'function' ? require('photoshop') : null;
      const liveApp = (photoshop && photoshop.app) || app;
      const sets = toSafeArray(liveApp && liveApp.actionTree);

      let foundSet = null;
      for (let i = 0; i < sets.length; i += 1) {
        const item = sets[i];
        if (item && typeof item.name === 'string' && item.name.trim() === setName) {
          foundSet = item;
          break;
        }
      }
      if (!foundSet) return;

      const actionItems = toSafeArray(foundSet.actions);
      const seen = new Set();
      const actionNames = [];
      for (let j = 0; j < actionItems.length; j += 1) {
        const action = actionItems[j];
        if (!action) continue;
        const name = typeof action.name === 'string' ? action.name.trim() : '';
        if (!name || seen.has(name)) continue;
        seen.add(name);
        actionNames.push(name);
      }

      const idx = state.catalogCommitted.findIndex(s => s && s.name === setName);
      if (idx === -1) return;

      if (typeof console !== 'undefined' && console.log) {
        try { console.log('[PS-autoHUB] partial refresh set=' + setName + ' actions=' + actionNames.length); } catch (_) {}
      }

      const current = state.catalogCommitted[idx].actions || [];
      let unchanged = current.length === actionNames.length;
      if (unchanged) {
        for (let k = 0; k < current.length; k += 1) {
          if (current[k] !== actionNames[k]) { unchanged = false; break; }
        }
      }
      if (unchanged) return;

      const reopen = reopenInfoFromOpenPicker();
      const next = state.catalogCommitted.slice();
      next[idx] = { ...next[idx], actions: actionNames };
      state.catalogCommitted = next;

      normalizeSlotsAgainstCatalog();
      ensureMinimumSlot();
      savePreset();
      render();
      notifyChange();
      reopenPickerByInfo(reopen);
    } catch (error) {
      onProblem(error);
    } finally {
      state.uiState.refreshing = false;
    }
  }

  function catalogsEqual(a, b) {
    if (a === b) return true;
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      const sa = a[i];
      const sb = b[i];
      if (!sa || !sb) return false;
      if (sa.name !== sb.name) return false;
      const aa = sa.actions;
      const ba = sb.actions;
      if (!Array.isArray(aa) || !Array.isArray(ba)) return false;
      if (aa.length !== ba.length) return false;
      for (let j = 0; j < aa.length; j += 1) {
        if (aa[j] !== ba[j]) return false;
      }
    }
    return true;
  }

  async function refreshCatalog({ preserve = true, clearSelections = false, allowEmpty = false } = {}) {
    try {
      state.uiState.refreshing = true;
      const nextCatalog = readCatalog();

      if (!isValidCatalog(nextCatalog)) {
        return;
      }
      // Guard: don't overwrite an existing non-empty catalog with an empty one
      // (app.actionTree can transiently return [] during reads). Only allow empty
      // commit when caller explicitly opts in (e.g. initial load, reset).
      const incoming = Array.isArray(nextCatalog) ? nextCatalog : [];
      if (incoming.length === 0 && state.catalogCommitted.length > 0 && !allowEmpty) {
        return;
      }

      // If the catalog content is unchanged and we're not also resetting slots,
      // skip the render entirely. This is the common case on a dropdown click
      // (user didn't edit Photoshop actions) and keeping render off the path
      // means the open popup's DOM survives the background refresh.
      const contentUnchanged = !clearSelections && preserve
        && catalogsEqual(state.catalogCommitted, incoming);
      if (contentUnchanged) {
        state.catalogCommitted = incoming;
        return;
      }

      // Catalog actually changed (or slot reset requested). Remember which
      // picker (if any) is open so we can re-open it on the freshly rendered
      // DOM — render() wipes actionList.innerHTML.
      const reopen = reopenInfoFromOpenPicker();

      state.catalogCommitted = incoming;

      if (clearSelections) {
        state.slots = [{ setName: '', actionName: '', enabled: false, enabledOrder: 0 }];
        state.enableSeq = 0;
      } else if (preserve) {
        normalizeSlotsAgainstCatalog();
      } else {
        const defaultSet = firstAvailableSetName();
        const defaultAction = firstAvailableActionName(defaultSet);
        state.slots = state.slots.map((slot) => ({
          setName: defaultSet,
          actionName: defaultAction,
          enabled: slot.enabled !== false,
          enabledOrder: Number(slot && slot.enabledOrder) > 0 ? Number(slot.enabledOrder) : 0
        }));
        reseedEnableSeq();
      }

      ensureMinimumSlot();
      savePreset();
      render();
      notifyChange();

      reopenPickerByInfo(reopen);
    } catch (error) {
      onProblem(error);
    } finally {
      state.uiState.refreshing = false;
    }
  }

  function requestCatalogRefresh() {
    if (!isUxpRuntime) return Promise.resolve();
    return refreshCatalog({ preserve: true });
  }

  function getSlots() {
    ensureMinimumSlot();
    return state.slots.map(slot => ({ ...slot }));
  }

  function getEffectiveActions() {
    return state.slots
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => slot.enabled !== false)
      .sort((a, b) => {
        const ao = Number(a.slot.enabledOrder) || 0;
        const bo = Number(b.slot.enabledOrder) || 0;
        if (ao !== bo) return ao - bo;
        return a.index - b.index;
      })
      .map(({ slot }) => ({ ...slot }));
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
    state.slots[index].actionName = firstAvailableActionName(setName);
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
    if (enabled) {
      state.slots[index].enabledOrder = ++state.enableSeq;
    } else {
      state.slots[index].enabledOrder = 0;
    }
    savePreset();
    render();
    notifyChange();
  }

  function addEmptySlot() {
    ensureMinimumSlot();
    if (state.slots.length >= MAX_ACTION_ROWS) return;
    state.slots.push({ setName: '', actionName: '', enabled: false, enabledOrder: 0 });
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
    state.uiState.refreshing = false;
    state.slots = [{ setName: '', actionName: '', enabled: false, enabledOrder: 0 }];
    state.enableSeq = 0;
    state.catalogCommitted = [];
    clearPreset();
    await refreshCatalog({ preserve: true, clearSelections: true, allowEmpty: true });
    if (state.catalogCommitted.length === 0) {
      showCatalogDiag('Reset All 후에도 actionTree에서 세트를 읽지 못했습니다.');
    }
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
        firstSet: state.catalogCommitted[0] ? state.catalogCommitted[0].name : ''
      }
    };
  }

  function showCatalogDiag(reason) {
    if (!isUxpRuntime) return;
    const diag = state.lastReadDiag || {};
    const lines = [
      reason,
      'app.actionTree: ' + (diag.treeFromApp || 'n/a'),
      "require('photoshop').app.actionTree: " + (diag.treeFromReq || 'n/a'),
      '디코딩된 세트 수: ' + (typeof diag.decodedSets === 'number' ? diag.decodedSets : 'n/a')
    ];
    onProblem(new Error(lines.join('\n')));
  }

  async function init(ids) {
    if (initialized) {
      await restoreView();
      return;
    }

    elements.actionList = document.getElementById(ids.actionList);
    elements.btnRefreshActions = document.getElementById(ids.btnRefreshActions);
    elements.btnAddAction = document.getElementById(ids.btnAddAction);
    elements.actionCount = document.getElementById(ids.actionCount);

    loadPreset();
    state.catalogCommitted = [];
    state.uiState.moreActionsExpanded = false;
    ensureMinimumSlot();

    elements.btnAddAction.addEventListener('click', addEmptySlot);
    elements.btnRefreshActions.addEventListener('click', () => {
      if (state.uiState.refreshing) return;
      resetToInitialState();
    });
    initialized = true;

    state.lastRefreshAt = Date.now();
    await refreshCatalog({ preserve: true });
    if (typeof console !== 'undefined' && console.log) {
      try { console.log('[PS-autoHUB] init done, catalog sets =', state.catalogCommitted.length); } catch (_) {}
    }
    if (isUxpRuntime && state.catalogCommitted.length === 0) {
      // Photoshop sometimes hasn't populated actionTree yet at panel-load time.
      // Retry once after a short delay before alerting the user.
      setTimeout(async () => {
        if (state.catalogCommitted.length > 0) return;
        await refreshCatalog({ preserve: true, allowEmpty: true });
        if (typeof console !== 'undefined' && console.log) {
          try { console.log('[PS-autoHUB] retry catalog sets =', state.catalogCommitted.length); } catch (_) {}
        }
        if (state.catalogCommitted.length === 0) {
          showCatalogDiag('Photoshop actionTree가 비어 있습니다. Photoshop의 Actions 패널을 한 번 열어 활성화한 뒤 Reset All을 눌러보세요.');
        }
      }, 1500);
    }
  }

  async function restoreView() {
    loadPreset();
    state.catalogCommitted = [];
    state.uiState.moreActionsExpanded = false;
    ensureMinimumSlot();
    state.lastRefreshAt = Date.now();
    await refreshCatalog({ preserve: true });
    if (typeof console !== 'undefined' && console.log) {
      try { console.log('[PS-autoHUB] restoreView done, catalog sets =', state.catalogCommitted.length); } catch (_) {}
    }
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
