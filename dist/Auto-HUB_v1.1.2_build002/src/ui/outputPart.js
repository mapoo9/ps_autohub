'use strict';

function createOutputPart({ fs = null, isUxpRuntime = false, onChange = () => {} } = {}) {
  const state = {
    saveCopy: false,
    suffix: '',
    suffixEditing: false,
    saveFolder1: null,
    saveFolder2: null,
    folder2Available: false,
    folder2Expanded: false
  };

  const elements = {};
  let initialized = false;

  function setToggle(el, on) {
    if (!el) return;
    el.checked = !!on;
  }

  function previewFolderName(key) {
    return 'Preview_' + key.replace(/Folder/g, 'Folder_');
  }

  function renderFolder(displayEl, actionEl, value) {
    if (!displayEl || !actionEl) return;

    if (value && value.name) {
      const fullPath = value.nativePath || value.name;
      displayEl.textContent = fullPath;
      displayEl.classList.remove('empty');
      displayEl.classList.add('has-path');
      displayEl.title = fullPath;
      actionEl.classList.add('is-reset');
      actionEl.setAttribute('aria-label', '폴더 선택 해제');
      actionEl.title = '폴더 선택 해제';
      return;
    }

    displayEl.textContent = '폴더 선택';
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

  function toggleFolder2Expanded() {
    if (!state.folder2Available) {
      state.folder2Expanded = false;
      render();
      return;
    }

    state.folder2Expanded = !state.folder2Expanded;
    render();
    onChange(getState());
  }

  function render() {
    const folder2Available = !!state.folder2Available;
    const folder2Visible = folder2Available && !!state.folder2Expanded;

    setToggle(elements.toggleSaveCopy, state.saveCopy);
    elements.inputSuffix.value = state.suffix;

    // Show input only when editing; otherwise show button proxy
    if (elements.suffixProxy && elements.inputSuffix) {
      const showInput = !!state.suffixEditing;
      elements.suffixProxy.style.display = showInput ? 'none' : 'block';
      elements.inputSuffix.style.display = showInput ? 'block' : 'none';
      elements.suffixProxy.textContent = state.suffix || '입력';
      if (state.suffix) {
        elements.suffixProxy.classList.remove('empty');
      } else {
        elements.suffixProxy.classList.add('empty');
      }
    }

    if (elements.btnSaveFolder2Disclosure) {
      elements.btnSaveFolder2Disclosure.setAttribute('aria-expanded', String(folder2Visible));
      elements.btnSaveFolder2Disclosure.setAttribute('aria-disabled', String(!folder2Available));
      elements.btnSaveFolder2Disclosure.setAttribute('tabindex', folder2Available ? '0' : '-1');
      elements.btnSaveFolder2Disclosure.classList.toggle('is-disabled', !folder2Available);
      elements.btnSaveFolder2Disclosure.title = folder2Available ? '' : 'OPEN 2Folder 선택 시 사용 가능';
    }
    if (elements.saveFolder2Content) {
      elements.saveFolder2Content.hidden = !folder2Visible;
    }
    if (elements.sectionSave) {
      elements.sectionSave.classList.toggle('is-cross-folder', folder2Visible);
    }
    if (elements.saveFolderSlotIcon1) {
      elements.saveFolderSlotIcon1.style.display = folder2Visible ? 'block' : 'none';
    }
    if (elements.saveFolderSlotIcon2) {
      elements.saveFolderSlotIcon2.style.display = folder2Visible ? 'block' : 'none';
    }

    renderFolder(elements.displaySaveFolder1, elements.btnSaveFolder1, state.saveFolder1);
    renderFolder(elements.displaySaveFolder2, elements.btnSaveFolder2, state.saveFolder2);
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

  function init(ids) {
    if (initialized) {
      render();
      return;
    }

    elements.sectionSave = document.getElementById(ids.sectionSave);
    elements.toggleSaveCopy = document.getElementById(ids.toggleSaveCopy);
    elements.inputSuffix = document.getElementById(ids.inputSuffix);

    // Create a proxy button that replaces the input visually when not editing
    if (elements.inputSuffix) {
      const proxy = document.createElement('button');
      proxy.type = 'button';
      proxy.className = 'suffix-proxy input-suffix empty';
      proxy.textContent = '입력';
      elements.inputSuffix.parentNode.insertBefore(proxy, elements.inputSuffix);
      elements.suffixProxy = proxy;

      proxy.addEventListener('click', () => {
        state.suffixEditing = true;
        render();
        elements.inputSuffix.focus();
      });

      elements.inputSuffix.addEventListener('blur', () => {
        state.suffixEditing = false;
        render();
      });
      elements.inputSuffix.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          state.suffixEditing = false;
          render();
          elements.inputSuffix.blur();
        }
      });
    }
    elements.displaySaveFolder1 = document.getElementById(ids.displaySaveFolder1);
    elements.displaySaveFolder2 = document.getElementById(ids.displaySaveFolder2);
    elements.saveFolderSlotIcon1 = document.getElementById(ids.saveFolderSlotIcon1);
    elements.saveFolderSlotIcon2 = document.getElementById(ids.saveFolderSlotIcon2);
    elements.btnSaveFolder1 = document.getElementById(ids.btnSaveFolder1);
    elements.btnSaveFolder2 = document.getElementById(ids.btnSaveFolder2);
    elements.btnSaveFolder2Disclosure = document.getElementById(ids.btnSaveFolder2Disclosure);
    elements.saveFolder2Content = document.getElementById(ids.saveFolder2Content);

    elements.toggleSaveCopy.addEventListener('change', () => {
      state.saveCopy = elements.toggleSaveCopy.checked;
      render();
      onChange(getState());
    });
    elements.inputSuffix.addEventListener('input', (e) => {
      state.suffix = e.target.value.trim();
      onChange(getState());
    });
    elements.btnSaveFolder2Disclosure.addEventListener('click', () => {
      toggleFolder2Expanded();
    });
    elements.btnSaveFolder2Disclosure.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      toggleFolder2Expanded();
    });

    bindFolder(elements.displaySaveFolder1, elements.btnSaveFolder1, 'saveFolder1');
    bindFolder(elements.displaySaveFolder2, elements.btnSaveFolder2, 'saveFolder2');
    render();
    initialized = true;
  }

  function getState() {
    const useFolder2 = !!(state.folder2Available && state.folder2Expanded);

    return {
      saveCopy: state.saveCopy,
      suffix: state.suffix,
      saveFolder1: state.saveFolder1,
      saveFolder2: useFolder2 ? state.saveFolder2 : null
    };
  }

  return {
    init,
    getState,
    setFolder2Available: (available, { expand = false } = {}) => {
      state.folder2Available = !!available;
      if (!state.folder2Available) {
        state.folder2Expanded = false;
      } else if (expand) {
        state.folder2Expanded = true;
      }
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
