'use strict';

function createInputPart({ fs = null, isUxpRuntime = false, syncSelectWidth = () => {}, onChange = () => {} } = {}) {
  const SORT_OPTIONS = [
    { value: 'name_asc', label: 'name ↑' },
    { value: 'name_desc', label: 'name ↓' },
    { value: 'date_modified', label: 'date modified' }
  ];

  const state = {
    folder1: null,
    folder2: null,
    sortBy: 'name_asc',
    subfolders: false,
    crossOrder: '1to2',
    sameFolderX2: false,
    folder2Expanded: false
  };

  const elements = {};
  let initialized = false;
  let sortSyncFrame = null;

  function getEffectiveMode() {
    if (state.folder2Expanded) return 'crossFolder';
    return state.sameFolderX2 ? 'sameFolderPair' : 'single';
  }

  function emitChange() {
    onChange(getState());
  }

  function setToggle(el, on) {
    if (!el) return;
    el.checked = !!on;
  }

  function previewFolderName(key) {
    return 'Preview_' + key.replace(/Folder/g, 'Folder_');
  }

  function getPathLabel(entry) {
    if (!entry) return '폴더 선택';
    return entry.nativePath || entry.name || String(entry);
  }

  function parsePathText(text) {
    const sep = String(text).indexOf('/') >= 0 ? '/' : '\\';
    const parts = String(text).replace(/\\/g, '/').split('/').filter(Boolean);
    return { sep, parts };
  }

  function makeTailPathLabel(parts, sep, keep) {
    if (!parts.length) return '';
    const safeKeep = Math.max(1, Math.min(keep, parts.length));
    const tail = parts.slice(-safeKeep).join(sep);
    return parts.length > safeKeep ? '…' + sep + tail : tail;
  }

  function setPathText(el, text) {
    while (el.firstChild) el.removeChild(el.firstChild);
    const span = document.createElement('span');
    span.className = 'path-btn-text';
    const parsed = parsePathText(text);
    span.textContent = parsed.parts.length > 1
      ? makeTailPathLabel(parsed.parts, parsed.sep, 2)
      : text;
    el.appendChild(span);
  }

  function renderFolder(displayEl, actionEl, value) {
    if (!displayEl || !actionEl) return;

    if (value && value.name) {
      const fullPath = getPathLabel(value);
      setPathText(displayEl, fullPath);
      displayEl.classList.remove('empty');
      displayEl.classList.add('has-path');
      displayEl.title = fullPath;
      actionEl.classList.add('is-reset');
      actionEl.setAttribute('aria-label', '폴더 선택 해제');
      actionEl.title = '폴더 선택 해제';
      return;
    }

    setPathText(displayEl, '폴더 선택');
    displayEl.classList.add('empty');
    displayEl.classList.remove('has-path');
    displayEl.title = '폴더 선택';
    actionEl.classList.remove('is-reset');
    actionEl.setAttribute('aria-label', '폴더 선택');
    actionEl.title = '폴더 선택';
  }

  async function selectFolder(stateKey) {
    if (!isUxpRuntime || !fs) {
      state[stateKey] = { name: previewFolderName(stateKey) };
      render();
      emitChange();
      return;
    }

    const folder = await fs.getFolder();
    if (!folder) return;
    state[stateKey] = folder;
    render();
    emitChange();
  }

  function resetFolder(stateKey) {
    state[stateKey] = null;
    render();
    emitChange();
  }

  function ensureSortOptions() {
    const select = elements.sortBy;
    if (!select) return;

    const current = Array.from(select.options || []).map((option) => ({
      value: option.value,
      label: option.textContent
    }));

    const valid =
      current.length === SORT_OPTIONS.length &&
      current.every((item, index) => item.value === SORT_OPTIONS[index].value && item.label === SORT_OPTIONS[index].label);

    if (valid) return;

    select.innerHTML = '';
    SORT_OPTIONS.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.value;
      option.textContent = item.label;
      select.appendChild(option);
    });
  }

  function applyNativeSelectDisplay(select, desiredValue) {
    if (!select) return;

    const options = Array.from(select.options || []);
    if (!options.length) return;

    let nextIndex = options.findIndex((option) => option.value === desiredValue);
    if (nextIndex < 0) nextIndex = 0;

    const nextValue = options[nextIndex].value;
    select.value = nextValue;
    select.selectedIndex = nextIndex;

    void select.offsetWidth;
    select.selectedIndex = -1;
    select.selectedIndex = nextIndex;
    select.value = nextValue;
  }

  function syncNativeSelectDisplay(select, desiredValue) {
    if (sortSyncFrame !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(sortSyncFrame);
      sortSyncFrame = null;
    }

    const run = () => applyNativeSelectDisplay(select, desiredValue);

    if (typeof requestAnimationFrame === 'function') {
      sortSyncFrame = requestAnimationFrame(() => {
        sortSyncFrame = null;
        run();
      });
      return;
    }

    run();
  }

  function render() {
    const mode = getEffectiveMode();
    const isDualMode = mode !== 'single';

    ensureSortOptions();
    syncNativeSelectDisplay(elements.sortBy, state.sortBy);
    syncSelectWidth(elements.sortBy);
    setToggle(elements.toggleSubfolders, state.subfolders);
    setToggle(elements.toggleSameFolderX2, state.sameFolderX2);

    if (elements.sameFolderX2Wrap) {
      elements.sameFolderX2Wrap.classList.remove('is-disabled');
    }
    if (elements.toggleSameFolderX2) {
      elements.toggleSameFolderX2.disabled = false;
    }

    const crossOrderButtons = [elements.btnCrossOrder, elements.btnCrossOrderCross].filter(Boolean);
    crossOrderButtons.forEach((button) => {
      button.textContent = state.crossOrder === '1to2' ? '1>2' : '2>1';
      button.disabled = !isDualMode;
      button.classList.toggle('active', isDualMode && state.crossOrder === '2to1');
    });
    if (elements.orderWrap) {
      elements.orderWrap.style.visibility = 'visible';
      elements.orderWrap.style.display = state.sameFolderX2 ? 'flex' : 'none';
    }
    if (elements.orderWrapCross) {
      elements.orderWrapCross.style.visibility = 'visible';
      elements.orderWrapCross.style.display = state.folder2Expanded ? 'flex' : 'none';
    }
    if (elements.sectionOpen) {
      elements.sectionOpen.classList.toggle('is-cross-folder', state.folder2Expanded);
    }

    if (elements.btnFolder2Disclosure) {
      elements.btnFolder2Disclosure.setAttribute('aria-expanded', String(state.folder2Expanded));
    }
    if (elements.openFolder2Content) {
      elements.openFolder2Content.hidden = !state.folder2Expanded;
    }

    renderFolder(elements.displayFolder1, elements.btnFolder1, state.folder1);
    renderFolder(elements.displayFolder2, elements.btnFolder2, state.folder2);
  }

  function bindFolder(displayEl, actionEl, stateKey) {
    if (!displayEl || !actionEl) return;
    displayEl.addEventListener('click', () => selectFolder(stateKey));
    const activateAction = () => {
      if (actionEl.classList.contains('is-reset')) resetFolder(stateKey);
      else selectFolder(stateKey);
    };
    actionEl.addEventListener('click', activateAction);
    actionEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      activateAction();
    });
  }

  function setFolder2Expanded(expanded, { emit = true } = {}) {
    const nextValue = !!expanded;
    let changed = state.folder2Expanded !== nextValue;

    state.folder2Expanded = nextValue;
    if (nextValue && state.sameFolderX2) {
      state.sameFolderX2 = false;
      changed = true;
    }

    render();
    if (emit && changed) emitChange();
  }

  function init(ids) {
    if (initialized) {
      render();
      return;
    }

    elements.sectionOpen = document.getElementById(ids.sectionOpen);
    elements.sortBy = document.getElementById(ids.sortBy);
    elements.toggleSubfolders = document.getElementById(ids.toggleSubfolders);
    elements.orderWrap = document.getElementById(ids.orderWrap);
    elements.orderWrapCross = document.getElementById(ids.orderWrapCross);
    elements.sameFolderX2Wrap = document.getElementById(ids.sameFolderX2Wrap);
    elements.toggleSameFolderX2 = document.getElementById(ids.toggleSameFolderX2);
    elements.btnCrossOrder = document.getElementById(ids.btnCrossOrder);
    elements.btnCrossOrderCross = document.getElementById(ids.btnCrossOrderCross);
    elements.btnFolder2Disclosure = document.getElementById(ids.btnFolder2Disclosure);
    elements.openFolder2Content = document.getElementById(ids.openFolder2Content);
    elements.displayFolder1 = document.getElementById(ids.displayFolder1);
    elements.displayFolder2 = document.getElementById(ids.displayFolder2);
    elements.btnFolder1 = document.getElementById(ids.btnFolder1);
    elements.btnFolder2 = document.getElementById(ids.btnFolder2);

    elements.sortBy.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      syncSelectWidth(e.target);
      emitChange();
    });
    elements.toggleSubfolders.addEventListener('change', () => {
      state.subfolders = elements.toggleSubfolders.checked;
      render();
      emitChange();
    });
    elements.toggleSameFolderX2.addEventListener('change', () => {
      state.sameFolderX2 = elements.toggleSameFolderX2.checked;
      if (state.sameFolderX2 && state.folder2Expanded) {
        state.folder2Expanded = false;
      }
      render();
      emitChange();
    });
    const toggleCrossOrder = () => {
      state.crossOrder = state.crossOrder === '1to2' ? '2to1' : '1to2';
      render();
      emitChange();
    };
    if (elements.btnCrossOrder) elements.btnCrossOrder.addEventListener('click', toggleCrossOrder);
    if (elements.btnCrossOrderCross) elements.btnCrossOrderCross.addEventListener('click', toggleCrossOrder);
    elements.btnFolder2Disclosure.addEventListener('click', () => {
      setFolder2Expanded(!state.folder2Expanded);
    });
    elements.btnFolder2Disclosure.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      setFolder2Expanded(!state.folder2Expanded);
    });

    bindFolder(elements.displayFolder1, elements.btnFolder1, 'folder1');
    bindFolder(elements.displayFolder2, elements.btnFolder2, 'folder2');
    render();
    initialized = true;
  }

  function getState() {
    return {
      folder1: state.folder1,
      folder2: state.folder2,
      sortBy: state.sortBy,
      subfolders: state.subfolders,
      crossOrder: state.crossOrder,
      sameFolderX2: state.sameFolderX2,
      folder2Expanded: state.folder2Expanded,
      mode: getEffectiveMode()
    };
  }

  return {
    init,
    getState,
    setFolder: (slot, entry) => {
      state[slot] = entry;
      render();
      emitChange();
    },
    resetFolder,
    setSortBy: (value) => {
      state.sortBy = value;
      render();
      emitChange();
    },
    toggleSubfolders: () => {
      state.subfolders = !state.subfolders;
      render();
      emitChange();
    },
    toggleCrossOrder: () => {
      state.crossOrder = state.crossOrder === '1to2' ? '2to1' : '1to2';
      render();
      emitChange();
    },
    toggleSameFolderX2: () => {
      state.sameFolderX2 = !state.sameFolderX2;
      if (state.sameFolderX2 && state.folder2Expanded) {
        state.folder2Expanded = false;
      }
      render();
      emitChange();
    },
    setFolder2Expanded,
    render
  };
}

module.exports = { createInputPart };
