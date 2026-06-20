'use strict';

const {
  scanFolder,
  sortFiles,
  sortFilesByRelDirGroup,
  buildCrossPairs,
  buildSameFolderPairs
} = require('./fileScanner');

const FILE_COUNT_MISMATCH_MESSAGE = '파일개수가 일치 하지 않습니다. 확인하세요';

function normalizePath(p = '') {
  return String(p || '').replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
}

function entryKey(entry) {
  if (!entry) return '';
  return normalizePath(entry.nativePath || entry.name || '');
}

function actionKey(actions = []) {
  return (Array.isArray(actions) ? actions : []).map((item) => ({
    setName: item && item.setName ? String(item.setName) : '',
    actionName: item && item.actionName ? String(item.actionName) : '',
    enabled: item && item.enabled === false ? false : true
  }));
}

function makeRunPlanKey(config = {}) {
  return JSON.stringify({
    folder1: entryKey(config.folder1),
    folder2: entryKey(config.folder2),
    saveFolder1: entryKey(config.saveFolder1),
    saveFolder2: entryKey(config.saveFolder2),
    saveCopy: !!config.saveCopy,
    suffix: String(config.suffix || ''),
    subfolders: !!config.subfolders,
    sortBy: config.sortBy || 'name_asc',
    crossOrder: config.crossOrder || '1to2',
    mode: config.mode || 'single',
    actions: actionKey(config.actions)
  });
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatTimestamp(date = new Date()) {
  return [
    pad2(date.getFullYear() % 100),
    pad2(date.getMonth() + 1),
    pad2(date.getDate())
  ].join('') + '-' + [
    pad2(date.getHours()),
    pad2(date.getMinutes()),
    pad2(date.getSeconds())
  ].join('');
}

function getRelDirCounts(files, root) {
  const counts = new Map();
  const rootPath = normalizePath(root && root.nativePath);

  files.forEach((file) => {
    const filePath = normalizePath(file && file.nativePath);
    if (!filePath || !rootPath || !filePath.startsWith(rootPath)) return;
    const rel = filePath.slice(rootPath.length).replace(/^\//, '');
    const parts = rel.split('/').filter(Boolean);
    parts.pop();
    const dir = parts.join('/');
    counts.set(dir, (counts.get(dir) || 0) + 1);
  });

  return counts;
}

function validateSubfolderCounts(files1, files2, folder1, folder2, errors) {
  const counts1 = getRelDirCounts(files1, folder1);
  const counts2 = getRelDirCounts(files2, folder2);
  const allDirs = new Set([...counts1.keys(), ...counts2.keys()]);
  const onlyIn1 = [];
  const onlyIn2 = [];
  const countDiffs = [];

  for (const dir of allDirs) {
    const c1 = counts1.get(dir) || 0;
    const c2 = counts2.get(dir) || 0;
    if (c1 === 0) onlyIn2.push(dir);
    else if (c2 === 0) onlyIn1.push(dir);
    else if (c1 !== c2) countDiffs.push({ dir, c1, c2 });
  }

  if (onlyIn1.length > 0 || onlyIn2.length > 0) {
    if (!errors.includes(FILE_COUNT_MISMATCH_MESSAGE)) errors.push(FILE_COUNT_MISMATCH_MESSAGE);
  }

  if (countDiffs.length > 0) {
    if (!errors.includes(FILE_COUNT_MISMATCH_MESSAGE)) errors.push(FILE_COUNT_MISMATCH_MESSAGE);
  }
}

function validateActions(actions, errors) {
  if (!actions || actions.length === 0) {
    errors.push('Action이 지정되지 않았습니다. 최소 1개 필요합니다.');
    return;
  }

  actions.forEach((actionItem, index) => {
    if (!actionItem.setName || !actionItem.actionName) {
      errors.push(`Action ${index + 1}: Set 이름 또는 Action 이름이 비어 있습니다.`);
    }
  });

  if (actions.length > 15) {
    errors.push(`Action은 최대 15개까지 지정할 수 있습니다. (현재 ${actions.length}개)`);
  }
}

function shouldUseTimestampOutput(config = {}, executionMode = 'run') {
  if (executionMode === 'test') return true;
  return !!(config.saveCopy || config.saveFolder1 || config.saveFolder2);
}

async function buildRunPlan(config = {}, options = {}) {
  const {
    folder1 = null,
    folder2 = null,
    actions = [],
    saveCopy = false,
    saveFolder1 = null,
    saveFolder2 = null,
    subfolders = false,
    sortBy = 'name_asc',
    crossOrder = '1to2',
    mode = 'single'
  } = config;

  const errors = [];
  const warnings = [];
  let fileList = [];
  let raw1 = [];
  let raw2 = [];

  if (!folder1) errors.push('Folder 1이 지정되지 않았습니다.');
  validateActions(actions, errors);

  if (folder1) {
    try {
      raw1 = await scanFolder(folder1, subfolders);
    } catch (error) {
      errors.push('Folder 1 스캔 중 오류: ' + error.message);
    }
  }

  if (mode === 'single') {
    if (folder1 && raw1.length === 0) {
      errors.push('Folder 1에 지원 포맷 파일이 없습니다.');
    }
    if (errors.length === 0) fileList = await sortFiles(raw1, sortBy);
  } else if (mode === 'sameFolderPair') {
    if (folder1 && raw1.length === 0) {
      errors.push('Folder 1에 지원 포맷 파일이 없습니다.');
    } else if (folder1 && raw1.length < 2) {
      errors.push('Same folder x2를 사용하려면 Folder 1에 지원 포맷 파일이 최소 2개 필요합니다.');
    } else if (folder1 && raw1.length % 2 !== 0) {
      errors.push(`Same folder x2 오류: Folder 1 파일 수는 짝수여야 합니다. 현재 ${raw1.length}개입니다.`);
    }
    if (errors.length === 0) {
      const sorted1 = await sortFiles(raw1, sortBy);
      fileList = buildSameFolderPairs(sorted1, crossOrder);
    }
  } else if (mode === 'crossFolder') {
    if (!folder2) {
      errors.push('Folder 2가 지정되지 않았습니다.');
    } else {
      try {
        raw2 = await scanFolder(folder2, subfolders);
      } catch (error) {
        errors.push('Folder 2 스캔 중 오류: ' + error.message);
      }

      if (folder1 && raw1.length === 0) errors.push('Folder 1에 지원 포맷 파일이 없습니다.');
      if (folder2 && raw2.length === 0) errors.push('Folder 2에 지원 포맷 파일이 없습니다.');
      if (raw1.length > 0 && raw2.length > 0 && raw1.length !== raw2.length) {
        if (!errors.includes(FILE_COUNT_MISMATCH_MESSAGE)) errors.push(FILE_COUNT_MISMATCH_MESSAGE);
      }
      if (subfolders && raw1.length > 0 && raw2.length > 0) {
        validateSubfolderCounts(raw1, raw2, folder1, folder2, errors);
      }
    }

    if (errors.length === 0) {
      const sorted1 = subfolders
        ? await sortFilesByRelDirGroup(raw1, folder1, sortBy)
        : await sortFiles(raw1, sortBy);
      const sorted2 = subfolders
        ? await sortFilesByRelDirGroup(raw2, folder2, sortBy)
        : await sortFiles(raw2, sortBy);
      fileList = buildCrossPairs(sorted1, sorted2, crossOrder);
    }
  } else {
    errors.push(`지원하지 않는 실행 모드입니다: ${mode}`);
  }

  if (saveCopy && !saveFolder1) {
    warnings.push('Save Copy 결과는 입력 루트 아래 timestamp Run 폴더에 저장됩니다.');
  }
  if (mode === 'crossFolder' && saveFolder1 && !saveFolder2) {
    warnings.push('Save Folder 1만 지정되어 있습니다. Folder 2 파일에는 _D2 suffix가 자동으로 추가됩니다.');
  }
  if (mode === 'crossFolder' && saveFolder2 && !saveFolder1) {
    warnings.push('Save Folder 2만 지정되어 있습니다. Save Folder 1도 지정하는 것을 권장합니다.');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    key: makeRunPlanKey(config),
    timestampToken: options.timestampToken || formatTimestamp(),
    fileList,
    total: fileList.length,
    usesTimestampOutput: shouldUseTimestampOutput(config, 'run'),
    rawCounts: {
      folder1: raw1.length,
      folder2: raw2.length
    }
  };
}

module.exports = {
  buildRunPlan,
  makeRunPlanKey,
  shouldUseTimestampOutput,
  formatTimestamp,
  normalizePath,
  entryKey
};
