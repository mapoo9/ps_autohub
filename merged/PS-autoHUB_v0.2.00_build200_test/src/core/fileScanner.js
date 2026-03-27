/**
 * fileScanner.js
 * 폴더를 스캔하여 지원 포맷 파일 목록을 반환한다.
 *
 * 주요 기능:
 *   - 단일 폴더 또는 두 폴더(교차 로딩) 스캔
 *   - 지원 확장자 필터링
 *   - 정렬 (name_asc / name_desc / date_modified)
 *   - Subfolders 옵션 (재귀 탐색)
 *   - 교차 로딩 시 파일 수 일치 검증
 */

'use strict';

const uxp = require('uxp');
const fs  = uxp.storage.localFileSystem;

// ── 지원 확장자 ────────────────────────────────────────────────
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

// ── 확장자 추출 ────────────────────────────────────────────────
function getExt(name) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

// ── 단일 폴더 스캔 (재귀 옵션 포함) ───────────────────────────
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

// ── 정렬 ──────────────────────────────────────────────────────
// UXP Entry에서 date_modified는 entry.getMetadata() 로 가져옴
// name 정렬은 동기로 처리, date 정렬은 비동기 메타데이터 필요
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
    // 메타데이터를 한 번에 가져와서 정렬
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
      .map(item => item.entry);
  }

  // 기본값: name_asc
  return [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}

// ── 교차 로딩 쌍 생성 ─────────────────────────────────────────
// crossOrder: '1to2' → [sf1[i], sf2[i]] 순
//             '2to1' → [sf2[i], sf1[i]] 순
function buildCrossPairs(files1, files2, crossOrder = '1to2') {
  if (files1.length !== files2.length) {
    throw new Error(
      `교차 로딩 오류: 폴더 파일 수가 다릅니다.\n` +
      `Folder 1: ${files1.length}개 / Folder 2: ${files2.length}개`
    );
  }

  return files1.map((_, i) => {
    return crossOrder === '1to2'
      ? { primary: files1[i], secondary: files2[i] }
      : { primary: files2[i], secondary: files1[i] };
  });
}

// ── 메인 스캔 함수 ─────────────────────────────────────────────
/**
 * scanFiles(options)
 *
 * options:
 *   folder1     {Entry}   필수 — 소스 폴더 1
 *   folder2     {Entry}   옵션 — 소스 폴더 2 (교차 로딩용)
 *   subfolders  {boolean} 기본 false
 *   sortBy      {string}  'name_asc' | 'name_desc' | 'date_modified'
 *   crossOrder  {string}  '1to2' | '2to1'  (folder2 있을 때만 유효)
 *
 * 반환값:
 *   folder2 없음 → Entry[] (단순 목록)
 *   folder2 있음 → { primary: Entry, secondary: Entry }[]
 */
async function scanFiles(options = {}) {
  const {
    folder1,
    folder2    = null,
    subfolders = false,
    sortBy     = 'name_asc',
    crossOrder = '1to2'
  } = options;

  if (!folder1) throw new Error('Folder 1이 지정되지 않았습니다.');

  // 폴더 1 스캔 + 정렬
  const raw1    = await scanFolder(folder1, subfolders);
  const sorted1 = await sortFiles(raw1, sortBy);

  // 단일 폴더
  if (!folder2) return sorted1;

  // 교차 로딩
  const raw2    = await scanFolder(folder2, subfolders);
  const sorted2 = await sortFiles(raw2, sortBy);

  return buildCrossPairs(sorted1, sorted2, crossOrder);
}

module.exports = {
  scanFiles,
  scanFolder,
  sortFiles,
  buildCrossPairs,
  SUPPORTED_EXTENSIONS,
  getExt
};
