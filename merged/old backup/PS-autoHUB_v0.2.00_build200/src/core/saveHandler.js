
/**
 * saveHandler.js — PS-autoHUB v0.2.00 / build 200
 *
 * 목적:
 * - 패널 저장은 "액션 종료 후 열려 있는 결과 문서"를 기준으로 한다.
 * - Save Copy ON이면 원본은 살리고 결과 파일만 _Copy 이름으로 따로 남긴다.
 * - Save Copy OFF이면 _Copy 없이 최종 결과 이름으로 저장한다.
 * - Save Folder가 지정되면 상대경로 하위 폴더를 재생성해 저장한다.
 * - 파일 충돌 시 기존 파일만 _중복 / _중복01 형태로 뒤로 밀고,
 *   새 결과 파일은 항상 규칙 이름을 유지한다.
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
  const tag = index === 0 ? '_중복' : '_중복' + String(index).padStart(2, '0');
  return ext ? `${base}${tag}.${ext}` : `${base}${tag}`;
}

/**
 * reserveRenameForExistingFile
 *
 * overwritePsd: true 인 경우 (소스가 .psd + 저장폴더 미지정)
 *   → 같은 이름 .psd가 있어도 _중복 rename 없이 덮어씀
 *
 * overwritePsd: false (기본)
 *   → 기존 파일을 _중복으로 밀고 새 파일이 규칙 이름을 차지
 */
async function reserveRenameForExistingFile(folder, desiredName, { overwritePsd = false } = {}) {
  let existing = null;
  try {
    existing = await folder.getEntry(desiredName);
  } catch (_) {
    existing = null;
  }

  if (existing) {
    if (!existing.isFile) {
      throw new Error(`동일한 이름의 폴더가 있어 파일 저장 불가: ${desiredName}`);
    }

    // B-01: 소스 .psd + 저장폴더 미지정 케이스 → 덮어쓰기
    if (overwritePsd) {
      return await folder.createFile(desiredName, { overwrite: true });
    }

    let index = 0;
    while (true) {
      const conflictName = buildConflictName(desiredName, index);
      try {
        await folder.getEntry(conflictName);
        index += 1;
      } catch (_) {
        await folder.renameEntry(existing, conflictName, { overwrite: false });
        break;
      }
    }
  }

  return await folder.createFile(desiredName, { overwrite: true });
}

async function renameEntryWithConflict(folder, movingEntry, desiredName, { overwritePsd = false } = {}) {
  let existing = null;
  try {
    existing = await folder.getEntry(desiredName);
  } catch (_) {
    existing = null;
  }

  if (existing && existing !== movingEntry) {
    if (!existing.isFile) {
      throw new Error(`동일한 이름의 폴더가 있어 파일 이름 변경 불가: ${desiredName}`);
    }

    if (!overwritePsd) {
      let index = 0;
      while (true) {
        const conflictName = buildConflictName(desiredName, index);
        try {
          await folder.getEntry(conflictName);
          index += 1;
        } catch (_) {
          await folder.renameEntry(existing, conflictName, { overwrite: false });
          break;
        }
      }
    }
  }

  await folder.renameEntry(movingEntry, desiredName, { overwrite: false });
  return await folder.getEntry(desiredName);
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
        psbEntry = await renameEntryWithConflict(fallback.folder, entry, fallback.psbName, {
          overwritePsd: !!fallback.overwritePsd
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
  ensureRelativeFolder,
  reserveRenameForExistingFile,
  shouldOverwritePsd,
  getRelativeDir,
  getExt
};

/**
 * shouldOverwritePsd
 * B-01: 소스가 .psd이고 저장폴더가 미지정(= 소스폴더와 동일)인 경우
 * 같은 이름 파일을 덮어쓰기 처리한다.
 * SaveCopy ON이면 _Copy 이름으로 새 파일이 생성되므로 덮어쓰기 불필요.
 */
function shouldOverwritePsd(sourceEntry, rootSaveFolder, sourceRootFolder, isSaveCopy) {
  if (isSaveCopy) return false;
  const ext = getExt(sourceEntry ? sourceEntry.name : '');
  if (ext !== 'psd') return false;
  const savePath   = normalizePath((rootSaveFolder   && rootSaveFolder.nativePath)   || '');
  const sourcePath = normalizePath((sourceRootFolder && sourceRootFolder.nativePath) || '');
  return savePath === sourcePath;
}
