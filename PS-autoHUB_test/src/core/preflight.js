/**
 * preflight.js
 * 배치 실행 전 유효성 검사
 */

'use strict';

const { scanFolder } = require('./fileScanner');

function getRelDirs(files, root) {
  const dirs = new Set();

  for (const file of files) {
    try {
      const filePath = (file.nativePath || '').replace(/\\/g, '/');
      const rootPath = (root.nativePath || '').replace(/\\/g, '/');
      if (!filePath.startsWith(rootPath)) continue;

      const rel = filePath.slice(rootPath.length).replace(/^\//, '');
      const parts = rel.split('/');
      parts.pop();
      if (parts.length > 0) dirs.add(parts.join('/'));
    } catch (_) {}
  }

  return dirs;
}

async function preflight(config = {}) {
  const {
    folder1 = null,
    folder2 = null,
    actions = [],
    saveCopy = false,
    saveFolder1 = null,
    saveFolder2 = null,
    subfolders = false,
    mode = 'single'
  } = config;

  const errors = [];
  const warnings = [];

  if (!folder1) {
    errors.push('Folder 1이 지정되지 않았습니다.');
  }

  if (!actions || actions.length === 0) {
    errors.push('Action이 지정되지 않았습니다. 최소 1개 필요합니다.');
  } else {
    actions.forEach((actionItem, index) => {
      if (!actionItem.setName || !actionItem.actionName) {
        errors.push(`Action ${index + 1}: Set 이름 또는 Action 이름이 비어 있습니다.`);
      }
    });
    if (actions.length > 10) {
      errors.push(`Action은 최대 10개까지 지정할 수 있습니다. (현재 ${actions.length}개)`);
    }
  }

  let files1 = [];
  if (folder1) {
    try {
      files1 = await scanFolder(folder1, subfolders);
    } catch (error) {
      errors.push('Folder 1 스캔 중 오류: ' + error.message);
    }
  }

  if (mode === 'single') {
    if (folder1 && files1.length === 0) {
      errors.push('Folder 1에 지원 포맷 파일이 없습니다.');
    }
  } else if (mode === 'sameFolderPair') {
    if (folder1 && files1.length === 0) {
      errors.push('Folder 1에 지원 포맷 파일이 없습니다.');
    } else if (folder1 && files1.length < 2) {
      errors.push('Same folder x2를 사용하려면 Folder 1에 지원 포맷 파일이 최소 2개 필요합니다.');
    } else if (folder1 && files1.length % 2 !== 0) {
      errors.push(`Same folder x2 오류: Folder 1 파일 수는 짝수여야 합니다. 현재 ${files1.length}개입니다.`);
    }
  } else if (mode === 'crossFolder') {
    if (!folder2) {
      errors.push('Folder 2가 지정되지 않았습니다.');
    } else {
      try {
        const files2 = await scanFolder(folder2, subfolders);

        if (folder1 && files1.length === 0) {
          errors.push('Folder 1에 지원 포맷 파일이 없습니다.');
        }
        if (files2.length === 0) {
          errors.push('Folder 2에 지원 포맷 파일이 없습니다.');
        }

        if (files1.length > 0 && files2.length > 0 && files1.length !== files2.length) {
          errors.push(
            `교차 로딩 오류: 두 폴더의 파일 수가 다릅니다.\n` +
            `  Folder 1: ${files1.length}개 / Folder 2: ${files2.length}개`
          );
        }

        if (subfolders && files1.length > 0 && files2.length > 0) {
          const dirs1 = getRelDirs(files1, folder1);
          const dirs2 = getRelDirs(files2, folder2);
          const diff1 = [...dirs1].filter((dir) => !dirs2.has(dir));
          const diff2 = [...dirs2].filter((dir) => !dirs1.has(dir));

          if (diff1.length > 0 || diff2.length > 0) {
            errors.push(
              '교차 로딩 오류: 두 폴더의 하위 폴더 구조가 다릅니다. (Subfolders ON)\n' +
              (diff1.length ? '  Folder 1에만 있음: ' + diff1.slice(0, 3).join(', ') : '') +
              (diff2.length ? '\n  Folder 2에만 있음: ' + diff2.slice(0, 3).join(', ') : '')
            );
          }
        }
      } catch (error) {
        errors.push('Folder 2 스캔 중 오류: ' + error.message);
      }
    }
  } else {
    errors.push(`지원하지 않는 실행 모드입니다: ${mode}`);
  }

  if (saveCopy && !saveFolder1) {
    warnings.push('Save Copy가 켜져 있지만 Save Folder 1이 없습니다. 원본 폴더에 저장됩니다.');
  }

  if (mode === 'crossFolder') {
    if (saveFolder1 && !saveFolder2) {
      warnings.push('Save Folder 1만 지정되어 있습니다. Folder 2 파일에는 _D2 suffix가 자동으로 추가됩니다.');
    }

    if (saveFolder2 && !saveFolder1) {
      warnings.push('Save Folder 2만 지정되어 있습니다. Save Folder 1도 지정하는 것을 권장합니다.');
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = { preflight };
