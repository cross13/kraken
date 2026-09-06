import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { BranchCommit, BranchFile, BranchSummary } from './shared/types.js';

export interface GitStatus {
  isRepo: boolean;
  branch: string | null;
  hasChanges: boolean;
  staged: number;
  unstaged: number;
  untracked: number;
  ahead: number;
  behind: number;
  upstream: string | null;
  hasOrigin: boolean;
  error?: string;
}

export interface GitOpResult {
  ok: boolean;
  error?: string;
  output: string;
}

function git(cwd: string, args: string[], timeoutMs = 15000) {
  return spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
  });
}

function emptyStatus(): GitStatus {
  return {
    isRepo: false,
    branch: null,
    hasChanges: false,
    staged: 0,
    unstaged: 0,
    untracked: 0,
    ahead: 0,
    behind: 0,
    upstream: null,
    hasOrigin: false,
  };
}

export function gitStatus(cwd: string): GitStatus {
  if (!cwd || !existsSync(cwd)) return emptyStatus();
  const isRepo = git(cwd, ['rev-parse', '--is-inside-work-tree']);
  if (isRepo.status !== 0) return emptyStatus();

  const branch =
    git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim() || null;

  const upstreamRes = git(cwd, [
    'rev-parse',
    '--abbrev-ref',
    '--symbolic-full-name',
    '@{u}',
  ]);
  const upstream = upstreamRes.status === 0 ? upstreamRes.stdout.trim() : null;

  let ahead = 0;
  let behind = 0;
  if (upstream && branch) {
    const lc = git(cwd, [
      'rev-list',
      '--left-right',
      '--count',
      `${branch}...${upstream}`,
    ]).stdout.trim();
    const [a, b] = lc.split('\t').map((n) => parseInt(n, 10) || 0);
    ahead = a;
    behind = b;
  }

  let staged = 0;
  let unstaged = 0;
  let untracked = 0;
  const status = git(cwd, ['status', '--porcelain']).stdout;
  for (const line of status.split('\n').filter(Boolean)) {
    const code = line.slice(0, 2);
    if (code === '??') untracked++;
    else {
      if (code[0] !== ' ') staged++;
      if (code[1] !== ' ') unstaged++;
    }
  }

  const remotes = git(cwd, ['remote']).stdout
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    isRepo: true,
    branch,
    hasChanges: staged + unstaged + untracked > 0,
    staged,
    unstaged,
    untracked,
    ahead,
    behind,
    upstream,
    hasOrigin: remotes.includes('origin'),
  };
}

export interface ChangedFile {
  path: string;
  /** two-char porcelain code (e.g. " M", "M ", "??", "MM") */
  status: string;
  /** has changes staged in the index */
  staged: boolean;
  /** has changes in the working tree not yet staged */
  unstaged: boolean;
  untracked: boolean;
}

export interface ChangesResult {
  ok: boolean;
  files: ChangedFile[];
  error?: string;
}

/** Parse `git status --porcelain` into per-file staged/unstaged flags. */
export function gitListChanges(cwd: string): ChangesResult {
  if (!cwd || !existsSync(cwd)) return { ok: false, files: [] };
  if (git(cwd, ['rev-parse', '--is-inside-work-tree']).status !== 0) {
    return { ok: false, files: [], error: 'Not a git repository.' };
  }
  const res = git(cwd, ['status', '--porcelain']);
  if (res.status !== 0) {
    return { ok: false, files: [], error: res.stderr.trim() };
  }
  const files: ChangedFile[] = [];
  for (const line of res.stdout.split('\n')) {
    if (!line) continue;
    const code = line.slice(0, 2);
    const x = code[0];
    const y = code[1];
    let p = line.slice(3);
    // Renames/copies render as "old -> new"; track the destination path.
    const arrow = p.indexOf(' -> ');
    if (arrow !== -1) p = p.slice(arrow + 4);
    // Strip surrounding quotes git adds for paths with special chars.
    if (p.startsWith('"') && p.endsWith('"')) p = p.slice(1, -1);
    const untracked = code === '??';
    files.push({
      path: p,
      status: code,
      staged: !untracked && x !== ' ',
      unstaged: untracked || y !== ' ',
      untracked,
    });
  }
  return { ok: true, files };
}

/** Stage specific paths (git add). */
export function gitStage(cwd: string, paths: string[]): GitOpResult {
  if (!paths.length) return { ok: true, output: '' };
  const res = git(cwd, ['add', '--', ...paths]);
  const output = `$ git add -- ${paths.join(' ')}\n${res.stdout}${res.stderr}`;
  return res.status === 0
    ? { ok: true, output }
    : { ok: false, error: res.stderr.trim() || 'git add failed', output };
}

/** Unstage specific paths — works before the first commit too. */
export function gitUnstage(cwd: string, paths: string[]): GitOpResult {
  if (!paths.length) return { ok: true, output: '' };
  const hasHead = git(cwd, ['rev-parse', '--verify', 'HEAD']).status === 0;
  const args = hasHead
    ? ['reset', '-q', 'HEAD', '--', ...paths]
    : ['rm', '--cached', '-q', '--', ...paths];
  const res = git(cwd, args);
  const output = `$ git ${args.join(' ')}\n${res.stdout}${res.stderr}`;
  return res.status === 0
    ? { ok: true, output }
    : { ok: false, error: res.stderr.trim() || 'git unstage failed', output };
}

/** Stage everything (git add -A). */
export function gitStageAll(cwd: string): GitOpResult {
  const res = git(cwd, ['add', '-A']);
  const output = `$ git add -A\n${res.stdout}${res.stderr}`;
  return res.status === 0
    ? { ok: true, output }
    : { ok: false, error: res.stderr.trim() || 'git add failed', output };
}

/** Unstage everything. */
export function gitUnstageAll(cwd: string): GitOpResult {
  const hasHead = git(cwd, ['rev-parse', '--verify', 'HEAD']).status === 0;
  const args = hasHead ? ['reset', '-q', 'HEAD', '--'] : ['rm', '-r', '--cached', '-q', '--', '.'];
  const res = git(cwd, args);
  const output = `$ git ${args.join(' ')}\n${res.stdout}${res.stderr}`;
  return res.status === 0
    ? { ok: true, output }
    : { ok: false, error: res.stderr.trim() || 'git unstage failed', output };
}

export function gitInit(cwd: string): GitOpResult {
  const res = git(cwd, ['init']);
  return {
    ok: res.status === 0,
    error: res.status !== 0 ? res.stderr.trim() || 'git init failed' : undefined,
    output: `$ git init\n${res.stdout}${res.stderr}`,
  };
}

export interface CreateBranchResult extends GitOpResult {
  branch?: string;
  existed?: boolean;
}

export function gitCreateBranch(cwd: string, name: string): CreateBranchResult {
  let output = '';
  // Initialise the repo if missing.
  if (git(cwd, ['rev-parse', '--is-inside-work-tree']).status !== 0) {
    const init = gitInit(cwd);
    output += init.output + '\n';
    if (!init.ok) return { ok: false, error: init.error, output };
  }

  // Does the branch already exist?
  const exists = git(cwd, ['rev-parse', '--verify', `refs/heads/${name}`]);
  if (exists.status === 0) {
    const sw = git(cwd, ['checkout', name]);
    output += `$ git checkout ${name}\n${sw.stdout}${sw.stderr}\n`;
    if (sw.status !== 0) return { ok: false, error: sw.stderr.trim(), output };
    return { ok: true, output, branch: name, existed: true };
  }

  // Need at least one commit to branch from on some git versions; the user
  // probably has commits already, but if HEAD doesn't resolve we create the
  // branch with --orphan as a fallback.
  const head = git(cwd, ['rev-parse', 'HEAD']);
  const args =
    head.status === 0 ? ['checkout', '-b', name] : ['checkout', '--orphan', name];
  const create = git(cwd, args);
  output += `$ git ${args.join(' ')}\n${create.stdout}${create.stderr}\n`;
  if (create.status !== 0) return { ok: false, error: create.stderr.trim(), output };
  return { ok: true, output, branch: name, existed: false };
}

export interface BranchInfo {
  name: string;
  current: boolean;
  /** upstream tracking ref, if any */
  upstream?: string;
}

export interface ListBranchesResult {
  ok: boolean;
  branches: BranchInfo[];
  current: string | null;
  error?: string;
}

/** Local branches, current first-class, sorted by most recent commit. */
export function gitListBranches(cwd: string): ListBranchesResult {
  if (!cwd || !existsSync(cwd)) return { ok: false, branches: [], current: null };
  if (git(cwd, ['rev-parse', '--is-inside-work-tree']).status !== 0) {
    return { ok: false, branches: [], current: null, error: 'Not a git repository.' };
  }
  // %(HEAD) is "*" for the current branch; sort newest commit first.
  const res = git(cwd, [
    'for-each-ref',
    '--sort=-committerdate',
    'refs/heads/',
    '--format=%(HEAD)\t%(refname:short)\t%(upstream:short)',
  ]);
  if (res.status !== 0) {
    return { ok: false, branches: [], current: null, error: res.stderr.trim() };
  }
  const branches: BranchInfo[] = [];
  let current: string | null = null;
  for (const line of res.stdout.split('\n').filter(Boolean)) {
    const [head, name, upstream] = line.split('\t');
    if (!name) continue;
    const isCurrent = head === '*';
    if (isCurrent) current = name;
    branches.push({ name, current: isCurrent, upstream: upstream || undefined });
  }
  return { ok: true, branches, current };
}

export interface CheckoutResult extends GitOpResult {
  branch?: string;
}

/** Switch to an existing local branch. */
export function gitCheckoutBranch(cwd: string, name: string): CheckoutResult {
  if (!cwd || !existsSync(cwd)) {
    return { ok: false, error: 'Workspace not found.', output: '' };
  }
  const res = git(cwd, ['checkout', name]);
  const output = `$ git checkout ${name}\n${res.stdout}${res.stderr}`;
  if (res.status !== 0) {
    return {
      ok: false,
      error:
        res.stderr.trim() ||
        `Could not switch to ${name} (you may have uncommitted changes that would be overwritten).`,
      output,
    };
  }
  return { ok: true, output, branch: name };
}

/** Current checked-out branch, or null if detached / not a repo. */
export function gitCurrentBranch(cwd: string): string | null {
  if (!cwd || !existsSync(cwd)) return null;
  const res = git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (res.status !== 0) return null;
  const branch = res.stdout.trim();
  return branch && branch !== 'HEAD' ? branch : null;
}

/** URL of the `origin` remote, or null if there is none. */
export function gitRemoteUrl(cwd: string, remote = 'origin'): string | null {
  if (!cwd || !existsSync(cwd)) return null;
  const res = git(cwd, ['remote', 'get-url', remote]);
  if (res.status !== 0) return null;
  return res.stdout.trim() || null;
}

export interface PushResult extends GitOpResult {
  pushed?: boolean;
  branch?: string;
}

/**
 * Push the current branch to origin, setting upstream if missing. Used before
 * opening a PR so the head branch exists on the remote.
 */
export function gitPushCurrent(cwd: string): PushResult {
  const branch = gitCurrentBranch(cwd);
  if (!branch) {
    return { ok: false, error: 'Not on a branch (detached HEAD?).', output: '' };
  }
  const upstream = git(cwd, [
    'rev-parse',
    '--abbrev-ref',
    '--symbolic-full-name',
    '@{u}',
  ]);
  const args =
    upstream.status === 0 ? ['push'] : ['push', '-u', 'origin', branch];
  const res = git(cwd, args, 30000);
  const output = `$ git ${args.join(' ')}\n${res.stdout}${res.stderr}`;
  if (res.status !== 0) {
    return {
      ok: false,
      error: res.stderr.trim() || 'git push failed.',
      output,
      branch,
      pushed: false,
    };
  }
  return { ok: true, output, branch, pushed: true };
}

/** Fetch all remotes and prune deleted refs, to refresh ahead/behind counts. */
export function gitFetch(cwd: string): GitOpResult {
  if (!cwd || !existsSync(cwd)) {
    return { ok: false, error: 'Workspace not found.', output: '' };
  }
  const res = git(cwd, ['fetch', '--all', '--prune'], 30000);
  const output = `$ git fetch --all --prune\n${res.stdout}${res.stderr}`;
  if (res.status !== 0) {
    return { ok: false, error: res.stderr.trim() || 'git fetch failed.', output };
  }
  return { ok: true, output };
}

export interface PullResult extends GitOpResult {
  branch?: string;
}

/** Pull the current branch from its upstream (no-edit so it never opens an editor). */
export function gitPull(cwd: string): PullResult {
  const branch = gitCurrentBranch(cwd);
  if (!branch) {
    return { ok: false, error: 'Not on a branch (detached HEAD?).', output: '' };
  }
  const upstream = git(cwd, [
    'rev-parse',
    '--abbrev-ref',
    '--symbolic-full-name',
    '@{u}',
  ]);
  if (upstream.status !== 0) {
    return {
      ok: false,
      branch,
      error: `No upstream is set for ${branch}. Push it first to create the tracking branch.`,
      output: '',
    };
  }
  const res = git(cwd, ['pull', '--no-edit'], 60000);
  const output = `$ git pull --no-edit\n${res.stdout}${res.stderr}`;
  if (res.status !== 0) {
    return {
      ok: false,
      branch,
      error:
        res.stderr.trim() ||
        'git pull failed (you may have local changes that conflict — commit or stash them first).',
      output,
    };
  }
  return { ok: true, branch, output };
}

export interface CommitPushResult extends GitOpResult {
  commitHash?: string;
  pushed?: boolean;
  nothingToCommit?: boolean;
}

export function gitCommitPush(
  cwd: string,
  message: string,
  opts: { paths?: string[]; push?: boolean; stageAll?: boolean } = {}
): CommitPushResult {
  let output = '';

  // Stage. With explicit paths, add them. With stageAll !== false (default),
  // stage everything. With stageAll === false, commit only what's already staged.
  if (opts.paths && opts.paths.length) {
    const addRes = git(cwd, ['add', ...opts.paths]);
    output += `$ git add ${opts.paths.join(' ')}\n${addRes.stdout}${addRes.stderr}`;
    if (addRes.status !== 0) {
      return { ok: false, error: addRes.stderr.trim() || 'git add failed', output };
    }
  } else if (opts.stageAll !== false) {
    const addRes = git(cwd, ['add', '-A']);
    output += `$ git add -A\n${addRes.stdout}${addRes.stderr}`;
    if (addRes.status !== 0) {
      return { ok: false, error: addRes.stderr.trim() || 'git add failed', output };
    }
  }

  // Anything staged?
  const diff = git(cwd, ['diff', '--cached', '--quiet']);
  if (diff.status === 0) {
    return {
      ok: false,
      nothingToCommit: true,
      error: 'Nothing to commit — no staged changes.',
      output,
    };
  }

  // Commit
  const commitRes = git(cwd, ['commit', '-m', message]);
  output += `$ git commit -m "${message}"\n${commitRes.stdout}${commitRes.stderr}`;
  if (commitRes.status !== 0) {
    return { ok: false, error: commitRes.stderr.trim() || 'git commit failed', output };
  }

  const hash = git(cwd, ['rev-parse', 'HEAD']).stdout.trim().slice(0, 12);

  if (opts.push === false) {
    return { ok: true, output, commitHash: hash, pushed: false };
  }

  // Push — set upstream if missing
  const upstream = git(cwd, [
    'rev-parse',
    '--abbrev-ref',
    '--symbolic-full-name',
    '@{u}',
  ]);
  const pushArgs = upstream.status === 0 ? ['push'] : ['push', '-u', 'origin', 'HEAD'];
  const pushRes = git(cwd, pushArgs, 30000);
  output += `$ git ${pushArgs.join(' ')}\n${pushRes.stdout}${pushRes.stderr}`;
  if (pushRes.status !== 0) {
    return {
      ok: false,
      error:
        pushRes.stderr.trim() ||
        'git push failed (you may need to set an origin remote first).',
      output,
      commitHash: hash,
      pushed: false,
    };
  }

  return { ok: true, output, commitHash: hash, pushed: true };
}

// ---------- What a branch actually contains ----------


function emptyBranchSummary(error?: string): BranchSummary {
  return {
    ok: false,
    branch: null,
    base: null,
    baseGuessed: false,
    commits: [],
    files: [],
    added: 0,
    deleted: 0,
    dirty: false,
    error,
  };
}

/**
 * Resolve the branch this one should be compared against.
 *
 * `origin/HEAD` is the honest answer when it is set, because it is what the
 * remote itself calls default. It frequently isn't set on a fresh clone, so we
 * fall back to the usual names and say so via `baseGuessed` rather than
 * pretending we know.
 */
function resolveBase(cwd: string, preferred?: string): { base: string | null; guessed: boolean } {
  const exists = (ref: string) => git(cwd, ['rev-parse', '--verify', '--quiet', ref]).status === 0;

  if (preferred && exists(preferred)) return { base: preferred, guessed: false };

  const head = git(cwd, ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']);
  if (head.status === 0) {
    const ref = head.stdout.trim().replace('refs/remotes/', '');
    if (ref && exists(ref)) return { base: ref, guessed: false };
  }
  for (const ref of ['origin/main', 'origin/master', 'main', 'master']) {
    if (exists(ref)) return { base: ref, guessed: true };
  }
  return { base: null, guessed: false };
}

/**
 * Everything the current branch adds on top of its base: the commits, and the
 * per-file line counts.
 *
 * The diff uses three dots (`base...HEAD`), i.e. against the merge base — the
 * changes *this branch introduced*, not the ones that happened on the base
 * meanwhile. That is the difference between a PR description and a diff against
 * whatever main looks like today.
 */
export function gitBranchSummary(cwd: string, preferredBase?: string): BranchSummary {
  if (!cwd || !existsSync(cwd)) return emptyBranchSummary();
  if (git(cwd, ['rev-parse', '--is-inside-work-tree']).status !== 0) {
    return emptyBranchSummary('Not a git repository.');
  }

  const branch = gitCurrentBranch(cwd);
  const { base, guessed } = resolveBase(cwd, preferredBase);
  const dirty = git(cwd, ['status', '--porcelain']).stdout.trim().length > 0;

  if (!base) {
    return {
      ...emptyBranchSummary('No base branch to compare against (no origin/HEAD, main or master).'),
      branch,
      dirty,
    };
  }
  // A branch that has never diverged (or a repo with no commits) is not an error.
  const range = `${base}...HEAD`;

  // Unit separator between fields, record separator between commits: a commit
  // subject can contain anything, tabs and newlines included.
  const log = git(cwd, ['log', `--format=%H%x1f%s%x1f%an%x1f%aI%x1e`, `${base}..HEAD`]);
  if (log.status !== 0) {
    return { ...emptyBranchSummary(log.stderr.trim() || 'Could not read the branch log.'), branch, dirty };
  }
  const commits: BranchCommit[] = log.stdout
    .split('\x1e')
    .map((rec) => rec.replace(/^\n/, ''))
    .filter((rec) => rec.trim())
    .map((rec) => {
      const [hash, subject, author, date] = rec.split('\x1f');
      return { hash: hash ?? '', subject: subject ?? '', author: author ?? '', date: date ?? '' };
    });

  const numstat = git(cwd, ['diff', '--numstat', range]);
  const namestat = git(cwd, ['diff', '--name-status', range]);
  const statusByPath = new Map<string, string>();
  for (const line of namestat.stdout.split('\n')) {
    if (!line.trim()) continue;
    const [code, ...rest] = line.split('\t');
    // Renames come through as `R100\told\tnew`; key on the destination.
    statusByPath.set(rest[rest.length - 1], (code ?? '').charAt(0));
  }

  const files: BranchFile[] = [];
  let added = 0;
  let deleted = 0;
  for (const line of numstat.stdout.split('\n')) {
    if (!line.trim()) continue;
    const [a, d, ...rest] = line.split('\t');
    let p = rest[rest.length - 1];
    if (p?.startsWith('"') && p.endsWith('"')) p = p.slice(1, -1);
    const binary = a === '-' || d === '-';
    const na = binary ? 0 : Number(a) || 0;
    const nd = binary ? 0 : Number(d) || 0;
    added += na;
    deleted += nd;
    files.push({ path: p, status: statusByPath.get(p) ?? 'M', added: na, deleted: nd, binary });
  }
  files.sort((x, y) => y.added + y.deleted - (x.added + x.deleted));

  return { ok: true, branch, base, baseGuessed: guessed, commits, files, added, deleted, dirty };
}
