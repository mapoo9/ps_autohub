/**
 * preflight.js
 * 배치 실행 전 유효성 검사
 *
 * 검사 항목:
 *   - Folder 1 지정 여부
 *   - Action Set / Action 지정 여부 (최대 10개)
 *   - 교차 로딩 시 Folder 2 지정 여부
 *   - 교차 로딩 시 두 폴더 파일 수 일치
 *   - Save Copy ON + 저장 폴더 미지정 → 경고 (오류 아님)
 *   - Folder 2 (Save) 단독 지정 → _D2 suffix 예고
 */

'use strict';

const { scanFolder } = require('./fileScanner');

/**
 * preflight(config)
 *
 * config:
 *   folder1       {Entry|null}
 *   folder2       {Entry|null}   소스 Folder 2
 *   actions       {Array}        [{ setName, actionName }]
 *   saveCopy      {boolean}
 *   saveFolder1   {Entry|null}
 *   saveFolder2   {Entry|null}
 *   subfolders    {boolean}
 *   crossOrder    {string}       '1to2' | '2to1'
 *
 * 반환값:
 *   {
 *     ok       : boolean,
 *     errors   : string[],   // 실행 불가 항목
 *     warnings : string[]    // 실행은 가능하나 주의 항목
 *   }
 */
async function preflight(config = {}) {
  const {
    folder1     = null,
    folder2     = null,
    actions     = [],
    saveCopy    = false,
    saveFolder1 = null,
    saveFolder2 = null,
    subfolders  = false
  } = config;

  const errors   = [];
  const warnings = [];

  // ── 필수: Folder 1 ──────────────────────────────────────────
  if (!folder1) {
    errors.push('Folder 1이 지정되지 않았습니다.');
  }

  // ── 필수: Action 최소 1개 ────────────────────────────────────
  if (!actions || actions.length === 0) {
    errors.push('Action이 지정되지 않았습니다. 최소 1개 필요합니다.');
  } else {
    actions.forEach((a, i) => {
      if (!a.setName || !a.actionName) {
        errors.push(`Action ${i + 1}: Set 이름 또는 Action 이름이 비어 있습니다.`);
      }
    });
    if (actions.length > 10) {
      errors.push(`Action은 최대 10개까지 지정할 수 있습니다. (현재 ${actions.length}개)`);
    }
  }

  // ── 교차 로딩: Folder 2 지정 시 ─────────────────────────────
  if (folder2) {
    if (!folder1) {
      // folder1 오류가 이미 등록됐으므로 추가 메시지 생략
    } else {
      // 두 폴더 파일 수 일치 확인
      try {
        const { scanFolder: scan } = require('./fileScanner');
        const files1 = await scan(folder1, subfolders);
        const files2 = await scan(folder2, subfolders);

        if (files1.length === 0) {
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

        // B-02: subfolders ON 시 두 폴더의 하위 폴더 구조 일치 검증
        if (subfolders && files1.length > 0 && files2.length > 0) {
          const getRelDirs = (files, root) => {
            const dirs = new Set();
            for (const f of files) {
              try {
                const fp = (f.nativePath || '').replace(/\\/g, '/');
                const rp = (root.nativePath || '').replace(/\\/g, '/');
                if (fp.startsWith(rp)) {
                  const rel = fp.slice(rp.length).replace(/^\//, '');
                  const parts = rel.split('/');
                  parts.pop();
                  if (parts.length > 0) dirs.add(parts.join('/'));
                }
              } catch (_) {}
            }
            return dirs;
          };
          const dirs1 = getRelDirs(files1, folder1);
          const dirs2 = getRelDirs(files2, folder2);
          const diff1 = [...dirs1].filter(d => !dirs2.has(d));
          const diff2 = [...dirs2].filter(d => !dirs1.has(d));
          if (diff1.length > 0 || diff2.length > 0) {
            errors.push(
              '교차 로딩 오류: 두 폴더의 하위 폴더 구조가 다릅니다. (Subfolders ON)\n' +
              (diff1.length ? '  Folder 1에만 있음: ' + diff1.slice(0, 3).join(', ') : '') +
              (diff2.length ? '\n  Folder 2에만 있음: ' + diff2.slice(0, 3).join(', ') : '')
            );
          }
        }
      } catch (e) {
        errors.push('폴더 스캔 중 오류: ' + e.message);
      }
    }
  } else if (folder1) {
    // 단일 폴더 — 파일 수만 확인
    try {
      const files1 = await scanFolder(folder1, subfolders);
      if (files1.length === 0) {
        errors.push('Folder 1에 지원 포맷 파일이 없습니다.');
      }
    } catch (e) {
      errors.push('폴더 스캔 중 오류: ' + e.message);
    }
  }

  // ── Save Copy 관련 ───────────────────────────────────────────
  if (saveCopy) {
    // Save Copy ON인데 저장 폴더 없으면 → 원본 폴더에 저장 (경고만)
    if (!saveFolder1) {
      warnings.push('Save Copy가 켜져 있지만 Save Folder 1이 없습니다. 원본 폴더에 저장됩니다.');
    }

    // Save Folder 1만 지정 + folder2 있음 → Folder 2 파일에 _D2 자동 부여
    if (saveFolder1 && !saveFolder2 && folder2) {
      warnings.push('Save Folder 1만 지정되어 있습니다. Folder 2 파일에는 _D2 suffix가 자동으로 추가됩니다.');
    }
  }

  // ── Save Folder 2만 단독 지정 → 경고 ────────────────────────
  if (saveFolder2 && !saveFolder1) {
    warnings.push('Save Folder 2만 지정되어 있습니다. Save Folder 1도 지정하는 것을 권장합니다.');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = { preflight };
