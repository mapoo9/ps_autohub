
/**
 * saveHandler.js - Auto-HUB v1.1 / build 110
 *
 * 목적:
 * - 패널 저장은 "액션 종료 후 열려 있는 결과 문서"를 기준으로 한다.
 * - Save Copy ON이면 saveAsCopy로 원본을 살린다.
 * - Save Folder / Save Copy timestamp 폴더 정책은 batchController에서 결정한다.
 * - 파일 충돌 시 기존 파일을 rename하지 않고 새 결과 파일에 _000, _001을 붙인다.
 */
'use strict';

const { LOG_STATUS } = require('../constants/logStatus');
const { getExt }     = require('./fileScanner');

function splitNameExt(fileName) {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0) return { base: fileName, ext: '' };
  return { base: fileName.slice(0, dot), ext: fileName.slice(dot + 1) };
}

function buildFileName(baseName, ext, {
  suffix = '',
  isD2 = false,
  isCopy = false,
  isSaveEr = false,
  newIndex = 0
} = {}) {
  let name = baseName;
  if (suffix) name += '_' + suffix;
  if (isD2) name += '_D2';
  if (newIndex > 0) name += '_New' + String(newIndex).padStart(2, '0');
  if (isCopy) name += '_Copy';
  if (isSaveEr) name += '_SaveEr';
  return name + '.' + ext;
}

function normalizePath(p = '') {
  return String(p).replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
}

function getRelativeDir(entry, rootFolder) {
  try {
    const entryPath = normalizePath(entry.nativePath || '');
    const rootPath  = normalizePath(rootFolder.nativePath || '');
    if (!entryPath || !rootPath) return '';
    if (!entryPath.startsWith(rootPath)) return '';
    const rel = entryPath.slice(rootPath.length).replace(/^\//, '');
    const parts = rel.split('/').filter(Boolean);
    parts.pop();
    return parts.join('/');
  } catch (_) {
    return '';
  }
}

async function ensureRelativeFolder(rootFolder, relativeDir = '') {
  if (!relativeDir) return rootFolder;
  const parts = String(relativeDir).split('/').filter(Boolean);
  let current = rootFolder;

  for (const part of parts) {
    let existing = null;
    try {
      existing = await current.getEntry(part);
    } catch (_) {
      existing = null;
    }

    if (existing) {
      if (existing.isFolder) {
        current = existing;
        continue;
      }
      throw new Error(`상대경로 생성 실패: "${part}" 위치에 폴더가 아닌 항목이 있습니다.`);
    }

    current = await current.createFolder(part);
  }
  return current;
}

function buildConflictName(originalName, index = 0) {
  const { base, ext } = splitNameExt(originalName);
  const tag = '_' + String(index).padStart(3, '0');
  return ext ? `${base}${tag}.${ext}` : `${base}${tag}`;
}

function markUsedName(usedNames, name) {
  if (!usedNames) return;
  usedNames.add(String(name).toLowerCase());
}

function hasUsedName(usedNames, name) {
  if (!usedNames) return false;
  return usedNames.has(String(name).toLowerCase());
}

async function getExistingEntry(folder, name) {
  try {
    return await folder.getEntry(name);
  } catch (_) {
    return null;
  }
}

async function reserveNumberedName(folder, desiredName, { usedNames = null, movingEntry = null } = {}) {
  let index = -1;
  while (true) {
    const candidate = index < 0 ? desiredName : buildConflictName(desiredName, index);
    index += 1;

    if (hasUsedName(usedNames, candidate)) continue;

    const existing = await getExistingEntry(folder, candidate);
    if (existing && existing !== movingEntry) {
      if (!existing.isFile) {
        throw new Error(`동일한 이름의 폴더가 있어 파일 저장 불가: ${candidate}`);
      }
      continue;
    }

    markUsedName(usedNames, candidate);
    return candidate;
  }
}

async function reserveNumberedFile(folder, desiredName, { usedNames = null } = {}) {
  const reservedName = await reserveNumberedName(folder, desiredName, { usedNames });
  return await folder.createFile(reservedName, { overwrite: false });
}

async function renameEntryToNumberedName(folder, movingEntry, desiredName, { usedNames = null } = {}) {
  const reservedName = await reserveNumberedName(folder, desiredName, { usedNames, movingEntry });
  if (movingEntry.name === reservedName) return movingEntry;

  await folder.renameEntry(movingEntry, reservedName, { overwrite: false });
  return await folder.getEntry(reservedName);
}

async function savePsd(doc, entry, saveAsCopy = true) {
  await doc.saveAs.psd(entry, {}, saveAsCopy);
}
async function savePsb(doc, entry, saveAsCopy = true) {
  await doc.saveAs.psb(entry, {}, saveAsCopy);
}

async function saveAsPsdOrPsb(doc, entry, saveAsCopy = true, fallback = {}) {
  try {
    await savePsd(doc, entry, saveAsCopy);
    return { status: LOG_STATUS.PROCESSED, format: 'psd', error: null, savedFileName: entry.name };
  } catch (psdErr) {
    let psbEntry = entry;
    if (fallback.folder && fallback.psbName && fallback.psbName !== entry.name) {
      try {
        psbEntry = await renameEntryToNumberedName(fallback.folder, entry, fallback.psbName, {
          usedNames: fallback.usedNames || null
        });
      } catch (renameErr) {
        return {
          status: LOG_STATUS.ERROR,
          format: null,
          error: `PSD 저장 실패 후 PSB 이름 전환 실패: ${renameErr.message}`
        };
      }
    }

    try {
      await savePsb(doc, psbEntry, saveAsCopy);
      return {
        status: LOG_STATUS.SAVE_ER,
        format: 'psb',
        error: `[PSD 실패 후 PSB 저장] ${psdErr.message}`,
        savedFileName: psbEntry.name
      };
    } catch (psbErr) {
      return {
        status: LOG_STATUS.ERROR,
        format: null,
        error: `PSD: ${psdErr.message} / PSB: ${psbErr.message}`
      };
    }
  }
}

module.exports = {
  saveAsPsdOrPsb,
  savePsd,
  savePsb,
  buildFileName,
  buildConflictName,
  ensureRelativeFolder,
  reserveNumberedFile,
  getRelativeDir,
  getExt
};
