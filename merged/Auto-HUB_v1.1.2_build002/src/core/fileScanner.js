/**
 * fileScanner.js
 * 폴더를 스캔하여 지원 포맷 파일 목록을 반환한다.
 *
 * 주요 기능:
 *   - single / sameFolderPair / crossFolder 모드 스캔
 *   - 지원 확장자 필터링
 *   - 정렬 (name_asc / name_desc / date_modified)
 *   - Subfolders 옵션 (재귀 탐색)
 */

'use strict';

const FILE_COUNT_MISMATCH_MESSAGE = '파일개수가 일치 하지 않습니다. 확인하세요';

const SUPPORTED_EXTENSIONS = new Set([
  'psd', 'psb',
  'jpg', 'jpeg',
  'png',
  'tif', 'tiff',
  'heic', 'heif',
  'webp',
  'avif',
  'bmp',
  'gif',
  'pdf',
  'raw', 'arw', 'cr2', 'cr3', 'nef', 'orf', 'raf', 'rw2', 'dng'
]);

function getExt(name) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

async function scanFolder(folderEntry, subfolders = false) {
  const entries = await folderEntry.getEntries();
  let files = [];

  for (const entry of entries) {
    if (entry.isFolder) {
      if (subfolders) {
        const sub = await scanFolder(entry, true);
        files = files.concat(sub);
      }
    } else {
      const ext = getExt(entry.name);
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        files.push(entry);
      }
    }
  }

  return files;
}

async function sortFiles(files, sortBy = 'name_asc') {
  if (sortBy === 'name_asc') {
    return [...files].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  }

  if (sortBy === 'name_desc') {
    return [...files].sort((a, b) =>
      b.name.localeCompare(a.name, undefined, { sensitivity: 'base' })
    );
  }

  if (sortBy === 'date_modified') {
    const withMeta = await Promise.all(
      files.map(async (entry) => {
        try {
          const meta = await entry.getMetadata();
          return { entry, mtime: meta.modificationDate || 0 };
        } catch {
          return { entry, mtime: 0 };
        }
      })
    );

    return withMeta
      .sort((a, b) => a.mtime - b.mtime)
      .map((item) => item.entry);
  }

  return [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}

function getRelDirOfEntry(entry, rootFolder) {
  try {
    const entryPath = String(entry.nativePath || '').replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
    const rootPath = String(rootFolder.nativePath || '').replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
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

async function sortFilesByRelDirGroup(files, rootFolder, sortBy) {
  const groups = new Map();
  for (const file of files) {
    const relDir = getRelDirOfEntry(file, rootFolder);
    if (!groups.has(relDir)) groups.set(relDir, []);
    groups.get(relDir).push(file);
  }

  const sortedDirs = [...groups.keys()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  const result = [];
  for (const dir of sortedDirs) {
    const sorted = await sortFiles(groups.get(dir), sortBy);
    result.push(...sorted);
  }
  return result;
}

function buildCrossPairs(files1, files2, crossOrder = '1to2') {
  if (files1.length !== files2.length) {
    throw new Error(FILE_COUNT_MISMATCH_MESSAGE);
  }

  return files1.map((_, i) => {
    return crossOrder === '1to2'
      ? { primary: files1[i], secondary: files2[i] }
      : { primary: files2[i], secondary: files1[i] };
  });
}

function buildSameFolderPairs(files, crossOrder = '1to2') {
  if (files.length < 2) {
    throw new Error('Same folder x2를 사용하려면 Folder 1에 지원 포맷 파일이 최소 2개 필요합니다.');
  }

  if (files.length % 2 !== 0) {
    throw new Error(`Same folder x2 오류: Folder 1 파일 수는 짝수여야 합니다. 현재 ${files.length}개입니다.`);
  }

  const pairs = [];
  for (let i = 0; i < files.length; i += 2) {
    const first = files[i];
    const second = files[i + 1];
    pairs.push(
      crossOrder === '1to2'
        ? { primary: first, secondary: second }
        : { primary: second, secondary: first }
    );
  }
  return pairs;
}

async function scanFiles(options = {}) {
  const {
    folder1,
    folder2 = null,
    subfolders = false,
    sortBy = 'name_asc',
    crossOrder = '1to2',
    mode = 'single'
  } = options;

  if (!folder1) throw new Error('Folder 1이 지정되지 않았습니다.');

  const raw1 = await scanFolder(folder1, subfolders);

  if (mode === 'single') {
    return await sortFiles(raw1, sortBy);
  }

  if (mode === 'sameFolderPair') {
    const sorted1 = await sortFiles(raw1, sortBy);
    return buildSameFolderPairs(sorted1, crossOrder);
  }

  if (mode === 'crossFolder') {
    if (!folder2) throw new Error('Folder 2가 지정되지 않았습니다.');
    const raw2 = await scanFolder(folder2, subfolders);
    const sorted1 = subfolders
      ? await sortFilesByRelDirGroup(raw1, folder1, sortBy)
      : await sortFiles(raw1, sortBy);
    const sorted2 = subfolders
      ? await sortFilesByRelDirGroup(raw2, folder2, sortBy)
      : await sortFiles(raw2, sortBy);
    return buildCrossPairs(sorted1, sorted2, crossOrder);
  }

  throw new Error(`지원하지 않는 스캔 모드입니다: ${mode}`);
}

module.exports = {
  scanFiles,
  scanFolder,
  sortFiles,
  sortFilesByRelDirGroup,
  getRelDirOfEntry,
  buildCrossPairs,
  buildSameFolderPairs,
  SUPPORTED_EXTENSIONS,
  getExt
};
