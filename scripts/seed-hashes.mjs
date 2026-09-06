// Fingerprint every bundled default so `SHIPPED_DEFAULT_HASHES` can recognise it.
//
// That constant is not bookkeeping — it is the only thing that identifies a
// default in a workspace this machine never seeded (the ledger is keyed by
// absolute path, so a teammate's clone has no entry). A body that isn't listed
// is treated as the user's file and never upgraded.
//
// Usage:
//   npm run hashes            # print the merged constant, ready to paste
//   npm run hashes -- --check # exit 1 if any current body is unlisted (CI-able)
//
// Loads the TypeScript sources directly via Node's type stripping — no build,
// no Electron. That is why `electron/defaultLibrary.ts` must stay dependency-free.

import { defaultLibraryEntries } from '../electron/defaultLibrary.ts';
import { SHIPPED_DEFAULT_HASHES, defaultHash } from '../electron/seedDefaults.ts';

const check = process.argv.includes('--check');
const entries = defaultLibraryEntries();

// Merge: keep every hash already listed (old versions still sit in old
// workspaces) and add the current body's hash if it is new.
const merged = { ...SHIPPED_DEFAULT_HASHES };
const added = [];
for (const { key, body } of entries) {
  const hash = defaultHash(body);
  const known = merged[key] ?? [];
  if (!known.includes(hash)) {
    merged[key] = [...known, hash];
    added.push({ key, hash, isNew: known.length === 0 });
  }
}

if (check) {
  if (!added.length) {
    console.log(`✓ all ${entries.length} bundled defaults are listed in SHIPPED_DEFAULT_HASHES`);
    process.exit(0);
  }
  console.error(`✗ ${added.length} bundled default(s) not listed in SHIPPED_DEFAULT_HASHES:\n`);
  for (const a of added) console.error(`    ${a.key}  ${a.hash}${a.isNew ? '  (new file)' : '  (changed body)'}`);
  console.error('\nRun `npm run hashes` and paste the result into electron/seedDefaults.ts.');
  process.exit(1);
}

const lines = Object.keys(merged)
  .sort()
  .map((k) => `  '${k}': [${merged[k].map((h) => `'${h}'`).join(', ')}],`);

console.log('export const SHIPPED_DEFAULT_HASHES: Record<string, string[]> = {');
console.log(lines.join('\n'));
console.log('};');

if (added.length) {
  console.error(`\n// ${added.length} entr${added.length === 1 ? 'y' : 'ies'} added:`);
  for (const a of added) console.error(`//   ${a.key}  ${a.hash}${a.isNew ? '  (new file)' : '  (changed body)'}`);
} else {
  console.error('\n// no changes — every current body was already listed.');
}
