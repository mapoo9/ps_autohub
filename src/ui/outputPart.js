'use strict';

function createOutputPart({ fs = null, isUxpRuntime = false, onChange = () => {}, onFolder2Toggle = () => {} } = {}) {
  const state = {
    saveCopy: false,
    suffix: '',
    saveFolder1: null,
    saveFolder2: null,
    folder2Expanded: false
  };

  const elements = {};
  let initialized = false;

  function setToggle(el, on) {
    if (!el) return;
    el.dataset.on = String(on);
    el.setAttribute('aria-pressed', String(on));
  }

  function previewFolderName(key) {
    return 'Preview_' + key.replace(/Folder/g, 'Folder_');
  }

  function renderFolder(displayEl, actionEl, value) {
    if (!displayEl || !actionEl) return;

    if (value && value.name) {
      displayEl.textContent = value.name;
      displayEl.classList.remove('empty');
      displayEl.title = value.name;
      actionEl.textContent = 'Reset';
      actionEl.classList.add('is-reset');
      return;
    }

    displayEl.textContent = '폴더 선택';
    displayEl.classList.add('empty');
    displayEl.title = '폴더 선택';
    actionEl.textContent = 'Browse';
    actionEl.classList.remove('is-reset');
  }

  async function selectFolder(stateKey) {
    if (!isUxpRuntime || !fs) {
      state[stateKey] = { name: previewFolderName(stateKey) };
      render();
      onChange(getState());
      return;
    }

    const folder = await fs.getFolder();
    if (!folder) return;
    state[stateKey] = folder;
    render();
    onChange(getState());
  }

  function resetFolder(stateKey) {
    state[stateKey] = null;
    render();
    onChange(getState());
  }

  function render() {
    setToggle(elements.toggleSaveCopy, state.saveCopy);
    elements.inputSuffix.value = state.suffix;

    if (elements.btnSaveFolder2Disclosure) {
      elements.btnSaveFolder2Disclosure.setAttribute('aria-expanded', String(state.folder2Expanded));
    }
    if (elements.saveFolder2Content) {
      elements.saveFolder2Content.hidden = !state.folder2Expanded;
    }

    renderFolder(elements.displaySaveFolder1, elements.btnSaveFolder1, state.saveFolder1);
    renderFolder(elements.displaySaveFolder2, elements.btnSaveFolder2, state.saveFolder2);
  }

  function bindFolder(displayEl, actionEl, stateKey) {
    if (!displayEl || !actionEl) return;
    displayEl.addEventListener('click', () => selectFolder(stateKey));
    actionEl.addEventListener('click', () => {
      if (actionEl.classList.contains('is-reset')) resetFolder(stateKey);
      else selectFolder(stateKey);
    });
  }

  function init(ids) {
    if (initialized) {
      render();
      return;
    }

    elements.toggleSaveCopy = document.getElementById(ids.toggleSaveCopy);
    elements.inputSuffix = document.getElementById(ids.inputSuffix);
    elements.displaySaveFolder1 = document.getElementById(ids.displaySaveFolder1);
    elements.displaySaveFolder2 = document.getElementById(ids.displaySaveFolder2);
    elements.btnSaveFolder1 = document.getElementById(ids.btnSaveFolder1);
    elements.btnSaveFolder2 = document.getElementById(ids.btnSaveFolder2);
    elements.btnSaveFolder2Disclosure = document.getElementById(ids.btnSaveFolder2Disclosure);
    elements.saveFolder2Content = document.getElementById(ids.saveFolder2Content);

    elements.toggleSaveCopy.addEventListener('click', () => {
      state.saveCopy = !state.saveCopy;
      render();
      onChange(getState());
    });
    elements.inputSuffix.addEventListener('input', (e) => {
      state.suffix = e.target.value.trim();
      onChange(getState());
    });
    elements.btnSaveFolder2Disclosure.addEventListener('click', () => {
      onFolder2Toggle();
    });
    elements.btnSaveFolder2Disclosure.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      onFolder2Toggle();
    });

    bindFolder(elements.displaySaveFolder1, elements.btnSaveFolder1, 'saveFolder1');
    bindFolder(elements.displaySaveFolder2, elements.btnSaveFolder2, 'saveFolder2');
    render();
    initialized = true;
  }

  function getState() {
    return {
      saveCopy: state.saveCopy,
      suffix: state.suffix,
      saveFolder1: state.saveFolder1,
      saveFolder2: state.saveFolder2
    };
  }

  return {
    init,
    getState,
    setFolder2Expanded: (expanded) => {
      state.folder2Expanded = !!expanded;
      render();
    },
    toggleSaveCopy: () => {
      state.saveCopy = !state.saveCopy;
      render();
      onChange(getState());
    },
    setSuffix: (value) => {
      state.suffix = value;
      render();
      onChange(getState());
    },
    setSaveFolder: (slot, entry) => {
      state[slot] = entry;
      render();
      onChange(getState());
    },
    resetSaveFolder: resetFolder,
    render
  };
}

module.exports = { createOutputPart };
