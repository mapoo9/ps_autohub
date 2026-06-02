'use strict';

function createOutputPart({ fs = null, isUxpRuntime = false, onChange = () => {}, onFolder2Toggle = () => {} } = {}) {
  const state = {
    saveCopy: false,
    suffix: '',
    suffixEditing: false,
    saveFolder1: null,
    saveFolder2: null,
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

  function setPathText(el, text) {
    while (el.firstChild) el.removeChild(el.firstChild);
    const span = document.createElement('span');
    span.className = 'path-btn-text';
    span.textContent = text;
    el.appendChild(span);

    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => setTimeout(fn, 0);
    raf(() => {
      if (!span.isConnected) return;
      if (span.scrollWidth <= span.clientWidth) return;
      const sep = text.indexOf('/') >= 0 ? '/' : '\\';
      const parts = text.replace(/\\/g, '/').split('/').filter(Boolean);
      for (let keep = parts.length - 1; keep >= 1; keep--) {
        span.textContent = '…' + sep + parts.slice(-keep).join(sep);
        if (span.scrollWidth <= span.clientWidth) return;
      }
      span.textContent = '…' + sep + parts[parts.length - 1];
    });
  }

  function renderFolder(displayEl, actionEl, value) {
    if (!displayEl || !actionEl) return;

    if (value && value.name) {
      const fullPath = value.nativePath || value.name;
      setPathText(displayEl, fullPath);
      displayEl.classList.remove('empty');
      displayEl.classList.add('has-path');
      displayEl.title = fullPath;
      actionEl.textContent = 'Reset';
      actionEl.classList.add('is-reset');
      return;
    }

    displayEl.textContent = '폴더 선택';
    displayEl.classList.add('empty');
    displayEl.classList.remove('has-path');
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
