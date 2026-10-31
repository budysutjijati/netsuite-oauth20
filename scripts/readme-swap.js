'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const README = path.join(ROOT, 'README.md');
const README_NPM = path.join(ROOT, 'readme-npm.md');
const BACKUP = path.join(ROOT, 'readme-full-backup.md.bak');

const mode = process.argv[2];

if (mode === 'prepack') {
  if (fs.existsSync(BACKUP)) {
    throw new Error(
      `${BACKUP} already exists - a previous pack/publish likely failed to ` +
        'restore README.md. Resolve manually (check `git status`/`git diff ' +
        'README.md`) before packing or publishing again.'
    );
  }
  fs.copyFileSync(README, BACKUP);
  fs.copyFileSync(README_NPM, README);
  console.log('[readme-swap] Swapped in readme-npm.md for packing.');
} else if (mode === 'postpack') {
  if (!fs.existsSync(BACKUP)) {
    console.warn('[readme-swap] No backup found at readme-full-backup.md.bak - nothing to restore.');
    process.exit(0);
  }
  fs.copyFileSync(BACKUP, README);
  fs.unlinkSync(BACKUP);
  console.log('[readme-swap] Restored the full README.md.');
} else {
  throw new Error(`[readme-swap] Unknown mode "${mode}" - expected "prepack" or "postpack".`);
}
