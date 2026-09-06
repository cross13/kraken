// Seeding the bundled library (agents, skills, steering, hooks) has to answer a
// question a plain `if (!existsSync(file))` can't: is the file on disk *the
// user's*, or is it a default they never touched? Only the second kind may be
// overwritten when Octo ships a better default.
//
// Two signals answer it:
//
// 1. **The ledger** — every time we write a default we remember the hash of what
//    we wrote (persisted in electron-store, keyed by absolute path). If the file
//    still hashes to that, nothing has edited it since, so an upgrade is safe.
// 2. **`SHIPPED_DEFAULT_HASHES`** — every body Octo has ever shipped for that
//    file. The ledger is keyed by absolute path *on this machine*, so it says
//    nothing about a workspace someone cloned: there, this constant is the only
//    thing that can recognise a default. It only ever grows.
//
// Anything else — a hash we've never shipped — is the user's file and is left
// exactly as it is. Seeding never destroys work.

import { createHash } from 'node:crypto';
import { existsSync, promises as fs } from 'node:fs';
import type { SeedReport } from './shared/types.js';

/** Short content hash — 16 hex chars of sha256 is plenty to fingerprint a file. */
export function defaultHash(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('hex').slice(0, 16);
}

/**
 * Every default body Octo has shipped, keyed by the same relative key the
 * seeders use (`agents/spec-planner.md`, `skills/sdd-feature/SKILL.md`, …).
 *
 * **This list is not frozen, and every body you ship must be added to it.** The
 * ledger only covers the machine that did the seeding; a teammate who clones a
 * repo with `.claude/` committed has no ledger entry, so an unlisted body is
 * classified as *their* file and kept forever — which is exactly the case the
 * upgrade path exists for. `npm run hashes` prints the entries for the bodies
 * currently in `main.ts`; paste in the new ones and keep the old.
 *
 * Retired defaults (`spec-design-architect`, `spec-task-planner`) stay listed:
 * their files may still sit in an old workspace, and knowing they are untouched
 * defaults is what lets a future cleanup tell them from a user's own agent.
 */
export const SHIPPED_DEFAULT_HASHES: Record<string, string[]> = {
  'agents/backend-expert.md': ['0acb88f329d36641'],
  'agents/bug-analyzer.md': ['7ed0bd4bb160a72e'],
  'agents/code-reviewer.md': ['2501bc1747248187'],
  'agents/codebase-explorer.md': ['9700b5f97ef10c50', 'e44ca55c21ab46c3'],
  'agents/database-expert.md': ['78c842245ac5ab2b'],
  'agents/docs-expert.md': ['11695ac306f3ab0e'],
  'agents/frontend-expert.md': ['49bb76abb7c5f341'],
  'agents/spec-design-architect.md': ['5e445f5bb3dfc149'],
  'agents/spec-doctor.md': ['e1bbafc5f472da86', '7aba624680937383', '6d26057aaac7fb6f', 'ac7322088c8c6d47'],
  'agents/spec-planner.md': ['79f7d117bd7860c1', 'c324e7d16f2cefec', 'c815ce026312ce6f'],
  'agents/spec-requirements-writer.md': ['b01cf9e815d04199', 'ca91979776caecbe', '015e57e235b744de'],
  'agents/spec-task-executor.md': ['cd8d3098bab6325c', 'c4f2816c69be50cb', '9aead48bcfc8ed6a'],
  'agents/spec-task-planner.md': ['0225af6b5d8ee526'],
  'agents/test-generator.md': ['b68d0563969bd131', '89b2901374b4ab1a', '8a1a1c1f38e5f8db'],
  'hooks/code-validate-improve.json': ['69cd62fae6ff7650'],
  'hooks/docs-changelog.json': ['971c3dc25583595c', 'ce83c2e74a871225'],
  'hooks/spec-format-audit.json': ['6c29f0489e73ebe5'],
  'skills/sdd-bugfix/SKILL.md': ['fe9ab1d9d516c11c', '224f208f63ac623e'],
  'skills/sdd-feature/SKILL.md': ['b06bfbf925d9e768', 'fcc0e2d87ff3d8f0', '4ffcf29f6dc3f86e'],
  'skills/spec-bugfix-format/SKILL.md': ['1dd262bded00177c'],
  'skills/spec-plan-format/SKILL.md': ['1b157af7850a9ad6'],
  'skills/spec-requirements-format/SKILL.md': ['d271b8a6938d3ae2'],
  'skills/spec-tasks-format/SKILL.md': ['cfc74da4db25642d'],
  'steering/product.md': ['d5bdb7ca59fc2235'],
  'steering/structure.md': ['0ad1c7abae70b403'],
  'steering/tech.md': ['37d82a9678afd34e'],
};

/** Where the "what we last wrote" hashes live (electron-store, in main). */
export interface SeedLedger {
  get(file: string): string | undefined;
  set(file: string, hash: string): void;
  /**
   * Persist everything `set` has buffered. Seeding touches ~20 files and the
   * up-to-date path records a hash for each, so writing the store per file is
   * ~20 disk writes on an operation that usually changes nothing — the seeders
   * call this once at the end instead.
   */
  flush(): void;
}

/** An empty report, so each seeder can accumulate into one. */
export function emptyReport(): SeedReport {
  return { created: [], upgraded: [], kept: [] };
}

/**
 * Write one bundled default, unless the file on disk carries the user's edits.
 *
 * - missing → written (`created`), or skipped entirely under `upgradeOnly`
 * - identical to the current default → nothing to do
 * - a default we recognise (ledger or `SHIPPED_DEFAULT_HASHES`) → rewritten (`upgraded`)
 * - anything else → left alone (`kept`)
 *
 * `upgradeOnly` is what makes seeding safe to run unattended: opening a
 * workspace may bring an untouched default up to date, but it must never
 * install the library into someone's tracked tree behind their back — that is
 * the first-run card's job to ask for.
 */
export async function seedDefaultFile(
  file: string,
  key: string,
  body: string,
  ledger: SeedLedger,
  report: SeedReport,
  opts?: { upgradeOnly?: boolean }
): Promise<void> {
  const next = defaultHash(body);

  if (existsSync(file)) {
    const current = await fs.readFile(file, 'utf8');
    const currentHash = defaultHash(current);
    if (currentHash === next) {
      // Already the current default — record it so a later upgrade is allowed
      // even in a workspace seeded before the ledger.
      ledger.set(file, next);
      return;
    }
    const known =
      ledger.get(file) === currentHash ||
      (SHIPPED_DEFAULT_HASHES[key] ?? []).includes(currentHash);
    if (!known) {
      report.kept.push(key);
      return;
    }
    await fs.writeFile(file, body, 'utf8');
    ledger.set(file, next);
    report.upgraded.push(key);
    return;
  }

  if (opts?.upgradeOnly) return;

  await fs.writeFile(file, body, 'utf8');
  ledger.set(file, next);
  report.created.push(key);
}
